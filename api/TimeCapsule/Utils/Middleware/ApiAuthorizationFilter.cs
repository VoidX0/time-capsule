using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using SqlSugar.IOC;
using TimeCapsule.Utils.Extension;

namespace TimeCapsule.Utils.Middleware;

/// <summary>
/// 允许登录用户访问
/// </summary>
public class AllowLoginFilter : IFilterMetadata;

/// <summary>
/// 自定义授权过滤
/// </summary>
public class ApiAuthorizationFilter : IAuthorizationFilter
{
    /// <summary>
    /// 授权过滤
    /// </summary>
    /// <param name="context"></param>
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        //验证开发者模式
        if (App.Application?.Environment.IsDevelopment() == true) return;
        //验证是否所有人可访问
        if (context.Filters.Any(x => x is IAllowAnonymousFilter)) return;
        //验证是否登录用户可访问
        if (context.Filters.Any(x => x is AllowLoginFilter) && context.HttpContext.IsLogin()) return;
        //验证控制器权限
        if (!context.HttpContext.Authenticate(DbScoped.SugarScope))
            context.Result = new UnauthorizedObjectResult("Unauthorized");
    }
}