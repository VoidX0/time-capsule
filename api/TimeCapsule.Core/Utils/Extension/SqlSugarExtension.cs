using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using SqlSugar;
using TimeCapsule.Core.Defined;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Core.Utils.Security;

namespace TimeCapsule.Core.Utils.Extension;

/// <summary>
/// SqlSugar扩展
/// </summary>
public static class SqlSugarExtension
{
    /// <summary>
    /// 绝对值
    /// </summary>
    /// <param name="value"></param>
    /// <returns></returns>
    private static int SafeAbs(int value) => value == int.MinValue ? int.MaxValue : Math.Abs(value);

    /// <summary>
    /// 根据Instance生成DataCenterId
    /// </summary>
    /// <returns></returns>
    public static int GetDataCenterId(string instance)
    {
        var bytes = MD5.HashData(Encoding.UTF8.GetBytes(instance));
        var code = BitConverter.ToInt32(bytes, 0); // 使用前 4 字节
        return SafeAbs((code >> 16) & 0xFFFF) % 32;
    }

    /// <summary>
    /// 根据Instance生成WorkId
    /// </summary>
    /// <returns></returns>
    public static int GetWorkId(string instance)
    {
        var bytes = MD5.HashData(Encoding.UTF8.GetBytes(instance));
        var code = BitConverter.ToInt32(bytes, 4); // 使用接下来的 4 字节
        return SafeAbs(code & 0xFFFF) % 32;
    }

    /// <summary>
    /// 初始化数据库
    /// </summary>
    /// <param name="db"></param>
    /// <param name="initSucceeded">配置成功</param>
    /// <param name="initFailed">配置失败</param>
    public static void InitDb(this ISqlSugarClient db,
        Action<string>? initSucceeded = null, Action<Exception, string>? initFailed = null)
    {
        try
        {
            //建库
            db.DbMaintenance.CreateDatabase();

            //建表
            var types = typeof(SystemController).Assembly.GetTypes()
                .Where(x => x is { IsPublic: true, IsClass: true, IsAbstract: false }
                            && x.Namespace == typeof(SystemController).Namespace) //命名空间过滤
                .Where(x => x.GetCustomAttribute<SugarTable>() != null) //SugarTable特性过滤
                .ToArray();
            db.CodeFirst.SplitTables().InitTables(types); //根据types创建表
            initSucceeded?.Invoke("Database init succeeded");
        }
        catch (Exception ex)
        {
            initFailed?.Invoke(ex, "Database init failed");
        }
    }

    /// <summary>
    /// 初始化系统信息
    /// </summary>
    /// <param name="db"></param>
    /// <param name="defaultUser">默认用户</param>
    /// <param name="defaultPassword">默认密码</param>
    /// <param name="controllers">控制器信息</param>
    /// <param name="initSucceeded">初始化成功</param>
    /// <param name="initFailed">初始化失败</param>
    public static void InitSystem(this ISqlSugarClient db, string defaultUser, string defaultPassword,
        List<SystemController> controllers,
        Action<string>? initSucceeded = null, Action<Exception, string>? initFailed = null)
    {
        try
        {
            //检查管理员角色
            const string admin = "管理员";
            var adminRole = db.Queryable<SystemRole>().First(it => it.Name == admin);
            if (adminRole is null)
            {
                //添加管理员角色
                adminRole = new SystemRole { Name = admin };
                db.Insertable(adminRole).ExecuteReturnSnowflakeId();
            }

            PreDefinedRole.AdminId = adminRole.Id; //预定义管理员角色Id
            //检查管理员用户
            if (!db.Queryable<SystemUser>().ToList().Any(x => x.Role.Contains(PreDefinedRole.AdminId)))
                db.Insertable(new SystemUser
                    {
                        Email = $"{defaultUser}@{defaultUser}.org",
                        NickName = defaultUser,
                        Password = SecurityAes.Encrypt(defaultPassword),
                        Role = [PreDefinedRole.AdminId]
                    })
                    .ExecuteReturnSnowflakeId();
            //控制器信息
            var dbControllers = db.Queryable<SystemController>().ToList();
            //新增控制器
            var addControllers = controllers.Where(it =>
                dbControllers.All(x => x.Controller != it.Controller)).ToList();
            db.Insertable(addControllers).ExecuteReturnSnowflakeIdList();
            //修改控制器
            var modifyControllers = dbControllers.Where(it =>
                controllers.Any(x => x.Controller == it.Controller && x.Title != it.Title)).ToList();
            modifyControllers.ForEach(it => it.Title = controllers.First(x => x.Controller == it.Controller).Title);
            db.Updateable(modifyControllers).ExecuteCommand();
            //删除控制器(及其关联的授权)
            var deleteControllers = dbControllers.Where(it =>
                controllers.All(x => x.Controller != it.Controller)).ToList();
            var deleteControllersId = deleteControllers.Select(it => it.Id);
            var deleteGrantUsers = db.Queryable<SystemGrantUser>().Where(it =>
                deleteControllersId.Contains(it.ControllerId)).ToList();
            var deleteGrantRoles = db.Queryable<SystemGrantRole>().Where(it =>
                deleteControllersId.Contains(it.ControllerId)).ToList();
            db.Deleteable(deleteControllers).ExecuteCommand();
            db.Deleteable(deleteGrantUsers).ExecuteCommand();
            db.Deleteable(deleteGrantRoles).ExecuteCommand();

            initSucceeded?.Invoke("System info init succeeded");
        }
        catch (Exception ex)
        {
            initFailed?.Invoke(ex, "System info init failed");
        }
    }
}