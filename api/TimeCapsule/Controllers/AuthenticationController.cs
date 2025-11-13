using System.ComponentModel;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using RestSharp;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Defined;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Core.Utils.Security;
using TimeCapsule.Models.Options;
using TimeCapsule.Services.Api;
using TimeCapsule.Utils.Extension;
using TimeCapsule.Utils.Middleware;

namespace TimeCapsule.Controllers;

/// <summary>
/// 权限管理
/// </summary>
[ApiController]
[DisplayName("权限管理")]
[Route("[controller]/[action]")]
public class AuthenticationController : ControllerBase
{
    private ISqlSugarClient Db { get; } = DbScoped.SugarScope;
    private readonly SystemOptions _systemOptions;
    private readonly TokenOptions _tokenOptions;
    private readonly OidcOptions _oidcOptions;
    private readonly SmtpApi _smtpApi;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    /// <param name="tokenOptions"></param>
    /// <param name="oidcOptions"></param>
    public AuthenticationController(IOptions<SystemOptions> systemOptions, IOptions<TokenOptions> tokenOptions,
        IOptions<OidcOptions> oidcOptions)
    {
        _systemOptions = systemOptions.Value;
        _tokenOptions = tokenOptions.Value;
        _oidcOptions = oidcOptions.Value;
        _smtpApi = new SmtpApi();
    }

    /// <summary>
    /// 邮箱格式验证
    /// </summary>
    private static bool IsEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var regex = new Regex(@"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$");
        return regex.IsMatch(email);
    }

    /// <summary>
    /// 生成验证码
    /// </summary>
    /// <param name="length">验证码长度</param>
    /// <returns></returns>
    private static string GenVerifyCode(int length = 6)
    {
        const string chars = "0123456789";
        var code = new char[length];
        var random = new Random();
        for (var i = 0; i < code.Length; i++)
            code[i] = chars[random.Next(chars.Length)];
        return new string(code);
    }

    #region POST

    /// <summary>
    /// 发送验证码
    /// </summary>
    /// <param name="dto">登录信息</param>
    /// <param name="verifyType">验证方式</param>
    /// <returns></returns>
    [HttpPost]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult> SendVerifyCode(SystemUser dto, UserVerifyType verifyType)
    {
        //获取用户
        var user = await Db.Queryable<SystemUser>().FirstAsync(x => x.Email == dto.Email);
        var isRegister = user is null;
        //获取验证账号
        var account = verifyType switch
        {
            UserVerifyType.Email => dto.Email,
            _ => null
        };
        if (string.IsNullOrWhiteSpace(account)) return BadRequest("验证账号不能为空");
        //邮箱格式验证
        if (verifyType == UserVerifyType.Email && !IsEmail(dto.Email)) return BadRequest("邮箱格式错误");
        //查找验证码
        var now = DateTimeOffset.Now;
        var verify = await Db.Queryable<SystemUserVerify>()
            .Where(x => x.VerifyType == verifyType && x.VerifyAccount == account &&
                        now.AddHours(-1) <= x.CreateTime && x.CreateTime <= now)
            .OrderBy(x => x.CreateTime)
            .ToListAsync();
        //检查未使用的验证码，是否频繁发送
        var lastVerify = verify.LastOrDefault(x => !x.IsVerified);
        if (lastVerify != null && now - lastVerify.CreateTime < TimeSpan.FromMinutes(3))
            return BadRequest("发送验证码过于频繁，请稍后再试");
        //检查所有验证码，是否超过限制
        if (verify.Count >= 5) return BadRequest("一小时内最多发送5次验证码，请稍后再试");
        // 发送验证码
        var code = GenVerifyCode();
        var send = verifyType switch
        {
            UserVerifyType.Email => await _smtpApi.SendMessage(
                x => isRegister ? x.TemplateRegisterConfirm : x.TemplateLoginConfirm,
                [account], new Dictionary<string, string> { { "code", code } }),
            _ => null
        };
        if (send is null || !send.IsSuccess) return BadRequest($"验证码发送失败：{send?.Message}");
        // 记录验证码
        var newVerify = new SystemUserVerify
        {
            UserId = user?.Id ?? 0,
            VerifyType = verifyType,
            VerifyAccount = account,
            VerifyValue = code
        };
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Insertable(newVerify).ExecuteReturnSnowflakeIdAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 用户登录
    /// </summary>
    /// <param name="dto">登录信息</param>
    /// <returns></returns>
    [HttpPost]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult<string>> Login(SystemUser dto)
    {
        //获取用户
        var user = await Db.Queryable<SystemUser>().FirstAsync(x => x.Email == dto.Email);
        if (user is null) return BadRequest("用户不存在");
        //检查密码
        if (SecurityAes.Decrypt(user.Password) == SecurityRsa.Decrypt(dto.Password))
            return Ok(await _tokenOptions.GenerateToken(user, Db));
        //检查验证码
        var verify = await Db.Queryable<SystemUserVerify>()
            .FirstAsync(x => x.UserId == user.Id && !x.IsVerified && DateTimeOffset.Now <= x.ExpireTime);
        if (verify is null || verify.VerifyValue != dto.Password) return BadRequest("密码或验证码错误");
        //更新验证码
        verify.IsVerified = true;
        await Db.AsTenant().UseTranAsync(async () => { await Db.Updateable(verify).ExecuteCommandAsync(); });
        return Ok(await _tokenOptions.GenerateToken(user, Db));
    }

    /// <summary>
    /// 设置用户头像
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> SetAvatar(IFormFile file)
    {
        var currentUser = HttpContext.User.Claims.Parsing();
        if (currentUser is null) return BadRequest("用户未授权");
        switch (file.Length)
        {
            case 0:
                return BadRequest("头像文件不能为空");
            // 限制文件大小 10MB
            case > 10 * 1024 * 1024:
                return BadRequest("头像文件不能超过10MB");
        }

        // 创建目录
        var avatarDir = Path.Combine(_systemOptions.StoragePath, "Avatar");
        if (!Directory.Exists(avatarDir)) Directory.CreateDirectory(avatarDir);
        // 允许的扩展名
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (ext != ".jpg" && ext != ".png") ext = ".png"; // 默认用 png
        // 删除已有的头像
        var existJpg = Path.Combine(avatarDir, $"{currentUser.Id}.jpg");
        var existPng = Path.Combine(avatarDir, $"{currentUser.Id}.png");
        if (System.IO.File.Exists(existJpg)) System.IO.File.Delete(existJpg);
        if (System.IO.File.Exists(existPng)) System.IO.File.Delete(existPng);
        // 保存新头像
        var filePath = Path.Combine(avatarDir, $"{currentUser.Id}{ext}");
        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok();
    }

    /// <summary>
    /// 添加角色
    /// </summary>
    /// <param name="dto">角色信息</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<ActionResult> AddRole(SystemRole dto)
    {
        //查找角色
        if (await Db.Queryable<SystemRole>().FirstAsync(x => x.Name == dto.Name) != null) return BadRequest("角色已存在");
        //添加角色
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            dto.Id = 0;
            await Db.Insertable(dto).ExecuteReturnSnowflakeIdAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 用户注册
    /// </summary>
    /// <param name="dto">注册信息</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<ActionResult> Register(SystemUser dto)
    {
        //邮箱格式验证
        if (!IsEmail(dto.Email)) return BadRequest("邮箱格式错误");
        //查找用户
        if (await Db.Queryable<SystemUser>().FirstAsync(x => x.Email == dto.Email) != null)
            return BadRequest("邮箱已存在");
        //rsa解密
        var password = SecurityRsa.Decrypt(dto.Password);
        if (string.IsNullOrWhiteSpace(password)) return BadRequest("RSA解密失败");
        //添加用户
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Insertable(new SystemUser
            {
                Email = dto.Email,
                NickName = dto.NickName,
                Password = SecurityAes.Encrypt(password),
                Role = dto.Role
            }).ExecuteReturnSnowflakeIdAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 向角色授权控制器
    /// </summary>
    /// <param name="roleId">角色ID</param>
    /// <param name="controllerId">控制器ID</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<ActionResult> AddRoleGrant(long roleId, long controllerId)
    {
        if (await Db.Queryable<SystemRole>().InSingleAsync(roleId) == null) return BadRequest("角色不存在");
        if (await Db.Queryable<SystemController>().InSingleAsync(controllerId) == null) return BadRequest("控制器不存在");
        if (await Db.Queryable<SystemGrantRole>().AnyAsync(x => x.RoleId == roleId && x.ControllerId == controllerId))
            return BadRequest("角色已授权该控制器");
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Insertable(new SystemGrantRole
            {
                RoleId = roleId,
                ControllerId = controllerId
            }).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 向用户授权控制器
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <param name="controllerId">控制器ID</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<ActionResult> AddUserGrant(long userId, long controllerId)
    {
        if (await Db.Queryable<SystemUser>().InSingleAsync(userId) == null) return BadRequest("用户不存在");
        if (await Db.Queryable<SystemController>().InSingleAsync(controllerId) == null) return BadRequest("控制器不存在");
        if (await Db.Queryable<SystemGrantUser>().AnyAsync(x => x.UserId == userId && x.ControllerId == controllerId))
            return BadRequest("用户已授权该控制器");
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Insertable(new SystemGrantUser
            {
                UserId = userId,
                ControllerId = controllerId
            }).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    #endregion

    #region DELETE

    /// <summary>
    /// 删除角色
    /// </summary>
    /// <param name="roleId">角色ID</param>
    /// <returns></returns>
    [HttpDelete]
    public async Task<ActionResult> DeleteRole(long roleId)
    {
        //检查权限
        if (roleId == PreDefinedRole.AdminId) return BadRequest("禁止删除管理员角色");
        //获取角色相关信息
        var role = await Db.Queryable<SystemRole>().InSingleAsync(roleId);
        if (role is null) return BadRequest("角色不存在");
        var roleGrants = await Db.Queryable<SystemGrantRole>().Where(x => x.RoleId == role.Id).ToListAsync();
        //获取用户相关信息
        var users = (await Db.Queryable<SystemUser>().ToListAsync())
            .Where(x => x.Role.Contains(role.Id)).ToList();
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            // 角色相关
            await Db.Deleteable(role).ExecuteCommandAsync();
            await Db.Deleteable(roleGrants).ExecuteCommandAsync();
            // 用户相关
            foreach (var user in users) user.Role.Remove(role.Id);
            await Db.Updateable(users).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 删除用户
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns></returns>
    [HttpDelete]
    public async Task<ActionResult> DeleteUser(long userId)
    {
        var user = HttpContext.User.Claims.Parsing();
        if (user is null) return BadRequest("用户未授权");
        //获取用户
        var deleteUser = await Db.Queryable<SystemUser>().InSingleAsync(userId);
        if (deleteUser is null) return BadRequest("用户不存在");
        //检查
        if (user.Id == deleteUser.Id) return BadRequest("禁止删除当前登录用户");
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Deleteable(deleteUser).ExecuteCommandAsync();
            await Db.Deleteable<SystemGrantUser>().Where(x => x.UserId == deleteUser.Id).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 删除角色授权
    /// </summary>
    /// <param name="roleId">角色ID</param>
    /// <param name="controllerId">控制器ID</param>
    /// <returns></returns>
    [HttpDelete]
    public async Task<ActionResult> DeleteRoleGrant(long roleId, long controllerId)
    {
        //获取用户role
        var grant = await Db.Queryable<SystemGrantRole>()
            .FirstAsync(x => x.RoleId == roleId && x.ControllerId == controllerId);
        if (grant == null) return BadRequest("该授权不存在");
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Deleteable(grant).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 删除用户授权
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <param name="controllerId">控制器ID</param>
    /// <returns></returns>
    [HttpDelete]
    public async Task<ActionResult> DeleteUserGrant(long userId, long controllerId)
    {
        //获取用户role
        var grant = await Db.Queryable<SystemGrantUser>()
            .FirstAsync(x => x.UserId == userId && x.ControllerId == controllerId);
        if (grant == null) return BadRequest("该授权不存在");
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Deleteable(grant).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    #endregion

    #region PUT

    /// <summary>
    /// 修改角色
    /// </summary>
    /// <param name="dto">角色信息</param>
    /// <returns></returns>
    [HttpPut]
    public async Task<ActionResult> ModifyRole(SystemRole dto)
    {
        //查找角色
        var role = await Db.Queryable<SystemRole>().InSingleAsync(dto.Id);
        if (role == null) return BadRequest("角色不存在");
        //修改角色
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            role.Name = dto.Name;
            await Db.Updateable(role).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 修改用户
    /// </summary>
    /// <param name="dto">用户信息</param>
    /// <returns></returns>
    [HttpPut]
    [TypeFilter(typeof(AllowLoginFilter))]
    public async Task<ActionResult> ModifyUser(SystemUser dto)
    {
        //查找用户
        var user = await Db.Queryable<SystemUser>().InSingleAsync(dto.Id);
        if (user == null) return BadRequest("用户不存在");
        //检查权限
        var currentUser = HttpContext.User.Claims.Parsing();
        if (user.Id != currentUser?.Id && currentUser?.Role.Contains(PreDefinedRole.AdminId) != true)
            return BadRequest("没有权限修改该用户");
        //邮箱格式验证
        if (!IsEmail(dto.Email)) return BadRequest("邮箱格式错误");
        //查找邮箱
        if (await Db.Queryable<SystemUser>().FirstAsync(x => x.Email == dto.Email && x.Id != dto.Id) != null)
            return BadRequest("邮箱已存在");
        //rsa解密
        var password = SecurityRsa.Decrypt(dto.Password); //解密密码
        if (string.IsNullOrWhiteSpace(password)) return BadRequest("RSA解密失败");
        //检查是否修改了密码
        if (password.Replace("*", "").Length == 0) password = SecurityAes.Decrypt(user.Password);
        //修改用户
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            user.Email = dto.Email;
            user.NickName = dto.NickName;
            user.Password = SecurityAes.Encrypt(password);
            user.Role = dto.Role;
            await Db.Updateable(user).ExecuteCommandAsync();
        });
        return result.IsSuccess ? Ok() : BadRequest(result.ErrorMessage);
    }

    #endregion

    #region GET

    /// <summary>
    /// 获取RSA公钥
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult<string>> GetKey()
    {
        await Task.CompletedTask;
        return Ok(SecurityRsa.PublicKeyString);
    }

    /// <summary>
    /// 获取所有用户列表
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<SystemUser>>> Users()
    {
        var users = await Db.Queryable<SystemUser>().OrderBy(x => x.Id).ToListAsync();
        foreach (var u in users) u.Password = new string('*', u.Password.Length);
        return Ok(users);
    }

    /// <summary>
    /// 获取所有角色列表
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<SystemRole>>> Roles()
    {
        return Ok(await Db.Queryable<SystemRole>().OrderBy(x => x.Id).ToListAsync());
    }

    /// <summary>
    /// 获取用户控制器列表
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <param name="isGranted">是否授权</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<SystemController>>> UserControllers(string userId, bool isGranted)
    {
        var userIdActual = long.TryParse(userId, out var id) ? id : 0;
        var user = await Db.Queryable<SystemUser>().InSingleAsync(userIdActual);
        if (user is null) return BadRequest("用户不存在");
        //获取用户授权的控制器
        var keys = await Db.Queryable<SystemGrantUser>()
            .Where(x => x.UserId == user.Id)
            .Select(x => x.ControllerId)
            .ToListAsync();
        //获取所有控制器
        var controllers = await Db.Queryable<SystemController>()
            .OrderBy(x => x.Id)
            .ToListAsync();
        //过滤控制器
        var filteredControllers = isGranted
            ? controllers.Where(x => keys.Contains(x.Id)).ToList()
            : controllers.Where(x => !keys.Contains(x.Id)).ToList();
        //返回结果
        return Ok(filteredControllers);
    }

    /// <summary>
    /// 获取角色控制器列表
    /// </summary>
    /// <param name="roleId">角色ID</param>
    /// <param name="isGranted">是否授权</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<SystemController>>> RoleControllers(string roleId, bool isGranted)
    {
        var roleIdActual = long.TryParse(roleId, out var id) ? id : 0;
        var role = await Db.Queryable<SystemRole>().InSingleAsync(roleIdActual);
        if (role is null) return BadRequest("角色不存在");
        //获取角色授权的控制器
        var keys = await Db.Queryable<SystemGrantRole>()
            .Where(x => x.RoleId == role.Id)
            .Select(x => x.ControllerId)
            .ToListAsync();
        //获取所有控制器
        var controllers = await Db.Queryable<SystemController>()
            .OrderBy(x => x.Id)
            .ToListAsync();
        //过滤控制器
        var filteredControllers = isGranted
            ? controllers.Where(x => keys.Contains(x.Id)).ToList()
            : controllers.Where(x => !keys.Contains(x.Id)).ToList();
        //返回结果
        return Ok(filteredControllers);
    }

    /// <summary>
    /// 获取当前用户信息
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowLoginFilter))]
    public async Task<ActionResult<SystemUser>> CurrentUser()
    {
        //解析JWT
        var user = HttpContext.User.Claims.Parsing();
        if (user is null) return BadRequest("用户未授权");
        //获取用户信息
        var dbUser = await Db.Queryable<SystemUser>().InSingleAsync(user.Id);
        if (dbUser is null) return BadRequest("用户不存在");
        dbUser.Password = new string('*', dbUser.Password.Length); //隐藏密码
        return Ok(dbUser);
    }

    /// <summary>
    /// 获取用户头像
    /// </summary>
    /// <param name="id">用户ID</param>
    /// <param name="token">token</param>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<IActionResult> GetAvatar(string id, string token)
    {
        // 验证token
        var isValid = long.TryParse(SecurityRsa.Decrypt(token), out var ticks) &&
                      DateTimeOffset.Now - DateTimeOffset.FromUnixTimeMilliseconds(ticks).ToLocalTime() <
                      TimeSpan.FromMinutes(5);
        if (!isValid) return BadRequest("token invalid or expired");
        // 查找头像文件
        var avatarDir = Path.Combine(_systemOptions.StoragePath, "Avatar");
        var jpgPath = Path.Combine(avatarDir, $"{id}.jpg");
        var pngPath = Path.Combine(avatarDir, $"{id}.png");
        string? filePath = null;
        if (System.IO.File.Exists(jpgPath)) filePath = jpgPath;
        else if (System.IO.File.Exists(pngPath)) filePath = pngPath;
        if (filePath == null) return BadRequest("用户未设置头像");
        // 返回文件
        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(filePath, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(fileBytes, contentType);
    }

    /// <summary>
    /// 获取已授权的控制器
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowLoginFilter))]
    public async Task<ActionResult<List<SystemController>>> Granted()
    {
        //解析JWT
        var user = HttpContext.User.Claims.Parsing();
        if (user is null || user.Role.Count == 0) return BadRequest("用户未授权");
        //管理员
        if (user.Role.Contains(PreDefinedRole.AdminId))
            return Ok(await Db.Queryable<SystemController>().OrderBy(x => x.Id).ToListAsync());
        //非管理员
        var roleKeys = await Db.Queryable<SystemGrantRole>().Where(x => user.Role.Contains(x.RoleId))
            .Select(x => x.ControllerId)
            .ToListAsync();
        var userKeys = await Db.Queryable<SystemGrantUser>().Where(x => x.UserId == user.Id)
            .Select(x => x.ControllerId)
            .ToListAsync();
        var finalKeys = roleKeys.Union(userKeys).Distinct().ToList();
        return Ok(await Db.Queryable<SystemController>()
            .Where(x => finalKeys.Contains(x.Id))
            .OrderBy(x => x.Id)
            .ToListAsync());
    }

    /// <summary>
    /// 刷新token
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowLoginFilter))]
    public async Task<ActionResult<string>> RefreshToken()
    {
        //解析JWT
        var user = HttpContext.User.Claims.Parsing();
        if (user is null) return BadRequest("用户未授权");
        var dbUser = await Db.Queryable<SystemUser>().InSingleAsync(user.Id);
        if (dbUser is null) return BadRequest("用户不存在");
        return Ok(await _tokenOptions.GenerateToken(dbUser, Db));
    }

    /// <summary>
    /// 获取OIDC登录地址
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult<string>> OidcLoginAddress()
    {
        await Task.CompletedTask;
        if (string.IsNullOrWhiteSpace(_oidcOptions.RedirectUri) ||
            string.IsNullOrWhiteSpace(_oidcOptions.ClientId) ||
            string.IsNullOrWhiteSpace(_oidcOptions.ClientSecret) ||
            string.IsNullOrWhiteSpace(_oidcOptions.AuthorizationEndpoint) ||
            string.IsNullOrWhiteSpace(_oidcOptions.TokenEndpoint) ||
            string.IsNullOrWhiteSpace(_oidcOptions.UserInfoEndpoint))
            return Ok("");
        return Ok($"{_oidcOptions.RedirectUri}/Authentication/OidcLogin");
    }

    /// <summary>
    /// OIDC登录
    /// </summary>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<IActionResult> OidcLogin()
    {
        await Task.CompletedTask;
        // 生成验证信息
        var state = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        // 组装验证参数
        var query = new Dictionary<string, string?>
        {
            ["client_id"] = _oidcOptions.ClientId,
            ["response_type"] = "code", // 授权码模式
            ["scope"] = "openid profile email", // 请求的权限范围
            ["redirect_uri"] = $"{_oidcOptions.RedirectUri}/Authentication/OidcCallback", // 回调地址
            ["state"] = state,
            ["nonce"] = nonce
        };
        // 重定向到OIDC授权端点
        var authorizeUrl = QueryHelpers.AddQueryString(_oidcOptions.AuthorizationEndpoint, query);
        return Redirect(authorizeUrl);
    }

    /// <summary>
    /// OIDC回调处理
    /// </summary>
    /// <param name="code">回调中的授权码</param>
    /// <param name="state">回调中的状态参数</param>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<IActionResult> OidcCallback(string code, string state)
    {
        ContentResult GenerateResponse(string token, string error) => Content($@"
        <html>
        <body>
            <script>
                window.opener.postMessage({{ token: '{token}', error: '{error}' }}, '*');
                window.close();
            </script>
        </body>
        </html>", "text/html");


        // 请求令牌
        string accessToken;
        var client = new RestClient(_oidcOptions.TokenEndpoint);
        var request = new RestRequest()
            .AddParameter("grant_type", "authorization_code")
            .AddParameter("code", code)
            .AddParameter("redirect_uri", $"{_oidcOptions.RedirectUri}/Authentication/OidcCallback")
            .AddParameter("client_id", _oidcOptions.ClientId)
            .AddParameter("client_secret", _oidcOptions.ClientSecret);
        try
        {
            var response = await client.PostAsync(request);
            if (!response.IsSuccessful || response.Content == null)
                return GenerateResponse(string.Empty, "Error fetching access token");
            var json = JsonDocument.Parse(response.Content);
            accessToken = json.RootElement.GetProperty("access_token").GetString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(accessToken)) throw new Exception("Access token is empty");
        }
        catch (Exception e)
        {
            return GenerateResponse(string.Empty, $"Error fetching access token: {e.Message}");
        }

        // 请求用户信息
        string email;
        client = new RestClient(_oidcOptions.UserInfoEndpoint);
        request = new RestRequest()
            .AddHeader("Authorization", $"Bearer {accessToken}");
        try
        {
            var response = await client.GetAsync(request);
            if (!response.IsSuccessful || response.Content == null)
                return GenerateResponse(string.Empty, "Error fetching user info");
            var json = JsonDocument.Parse(response.Content);
            email = json.RootElement.GetProperty("email").GetString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(email)) throw new Exception("Email is empty");
        }
        catch (Exception e)
        {
            return GenerateResponse(string.Empty, $"Error fetching user info: {e.Message}");
        }

        // 查找用户
        var user = await Db.Queryable<SystemUser>().FirstAsync(x => x.Email == email);
        if (user is null) return GenerateResponse(string.Empty, "User not found");
        var token = await _tokenOptions.GenerateToken(user, Db);
        return GenerateResponse(token, string.Empty);
    }

    #endregion
}