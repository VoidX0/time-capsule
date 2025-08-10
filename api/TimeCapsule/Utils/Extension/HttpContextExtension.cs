using SqlSugar;
using TimeCapsule.Core.Defined;
using TimeCapsule.Core.Models.Db;

namespace TimeCapsule.Utils.Extension;

/// <summary>
/// HttpContext扩展
/// </summary>
public static class HttpContextExtension
{
    /// <summary>
    /// 认证用户是否授权控制器
    /// </summary>
    /// <param name="httpContext"></param>
    /// <param name="db">当前Context</param>
    /// <param name="controllerId">控制器Id</param>
    /// <returns>授权结果</returns>
    public static bool Authenticate(this HttpContext httpContext, ISqlSugarClient db, long controllerId)
    {
        //获取用户信息
        var user = httpContext.User.Claims.Parsing();
        if (user is null) return false;
        if (user.Role.Contains(PreDefinedRole.AdminId)) return true; //管理员权限
        //在用户授权中查找
        if (db.Queryable<SystemGrantUser>().Any(x => x.UserId == user.Id && x.ControllerId == controllerId))
            return true;
        //在角色授权中查找
        return user.Role.Any(roleId =>
            db.Queryable<SystemGrantRole>().Any(x => x.RoleId == roleId && x.ControllerId == controllerId));
    }

    /// <summary>
    /// 认证用户是否授权控制器
    /// </summary>
    /// <param name="httpContext"></param>
    /// <param name="db">当前Context</param>
    /// <param name="controller">控制器</param>
    /// <returns>授权结果</returns>
    public static bool Authenticate(this HttpContext httpContext, ISqlSugarClient db, string? controller = null)
    {
        //获取用户信息
        var user = httpContext.User.Claims.Parsing();
        if (user is null) return false;
        if (user.Role.Contains(PreDefinedRole.AdminId)) return true; //管理员权限
        //获取默认控制器名称
        if (string.IsNullOrEmpty(controller))
            controller = httpContext.Request.RouteValues["controller"]?.ToString();
        if (controller != null && !controller.EndsWith("Controller")) controller = $"{controller}Controller";
        //查找控制器
        var dbController = db.Queryable<SystemController>().First(x => x.Controller == controller);
        //检查授权
        return dbController != null && Authenticate(httpContext, db, dbController.Id);
    }

    /// <summary>
    /// 判断用户是否登录
    /// </summary>
    /// <param name="httpContext"></param>
    /// <returns></returns>
    public static bool IsLogin(this HttpContext httpContext)
    {
        var user = httpContext.User.Claims.Parsing();
        return user is not null;
    }
}