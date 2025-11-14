using System.ComponentModel;
using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Controllers;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;
using TimeCapsule.Utils.Middleware;

namespace TimeCapsule.Utils;

/// <summary>
/// Markdown描述信息
/// </summary>
internal sealed class MarkdownDescriptionTransformer : IOpenApiDocumentTransformer
{
    /// <summary>
    /// TransformAsync
    /// </summary>
    /// <param name="document"></param>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    public async Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        const string componentDoc = """
                                    ## 组件列表
                                    > [SerilogUi](/serilog-ui)
                                    >
                                    > [Hangfire](/hangfire)
                                    """;
        document.Info.Description = $"""
                                     {componentDoc}
                                     {StatisticsDoc()}
                                     {DeveloperTokenDoc()}
                                     """;
    }

    /// <summary>
    /// 接口统计
    /// </summary>
    /// <returns></returns>
    private static string StatisticsDoc()
    {
        // 获取所有控制器
        var controllers = typeof(SettingsController).Assembly.GetTypes()
            .Where(x => x is { IsPublic: true, IsClass: true, IsAbstract: false }
                        && x.Namespace?.StartsWith(typeof(SettingsController).Namespace ?? "unknown namespace") ==
                        true) //命名空间过滤
            .Where(x => typeof(ControllerBase).IsAssignableFrom(x))
            .ToList();
        // 统计方法数量
        var dict = new Dictionary<List<string>, int>();
        foreach (var controller in controllers)
        {
            var methods = controller.GetMethods(BindingFlags.Instance | BindingFlags.Public)
                .Where(x => x is { IsPublic: true, IsSpecialName: false } &&
                            !x.IsDefined(typeof(NonActionAttribute)))
                .ToList();
            // 获取控制器显示名称
            var displayAttrs = controller.GetCustomAttributes(typeof(DisplayNameAttribute), false);
            var displayName = displayAttrs.Length > 0
                ? ((DisplayNameAttribute)displayAttrs[0]).DisplayName
                : string.Empty;
            var methodCount = 0;
            // 获取授权方式
            var typeFilterAttributes = controller.GetCustomAttributes(typeof(TypeFilterAttribute), inherit: false)
                .OfType<TypeFilterAttribute>().ToList();
            var allowAnonymous = typeFilterAttributes
                .Any(attr => attr.ImplementationType == typeof(AllowAnonymousFilter));
            var allowLogin = typeFilterAttributes
                .Any(attr => attr.ImplementationType == typeof(AllowLoginFilter));
            var auth = allowAnonymous
                ? "匿名访问"
                : allowLogin
                    ? "登录访问"
                    : "授权访问";
            // 统计方法数量
            foreach (var method in methods)
            {
                var delete = method.GetCustomAttribute<HttpDeleteAttribute>();
                var get = method.GetCustomAttribute<HttpGetAttribute>();
                var post = method.GetCustomAttribute<HttpPostAttribute>();
                var put = method.GetCustomAttribute<HttpPutAttribute>();
                if (delete == null && get == null && post == null && put == null) continue;
                methodCount++;
            }

            dict.Add([controller.Name, auth, displayName], methodCount);
        }

        dict = dict.Where(x => x.Value > 0)
            .OrderBy(x => x.Key[0])
            .ToDictionary();
        // 生成接口统计表
        var sb = new StringBuilder();
        sb.AppendLine("| Controller | Authorization | Display | Method |");
        sb.AppendLine("|------|-------|-------|-------|");
        foreach (var item in dict)
            sb.AppendLine($"| {item.Key[0].Replace("Controller", "")} | {item.Key[1]}| {item.Key[2]} | {item.Value} |");
        sb.AppendLine($"| **总计** | **{dict.Count}** | | **{dict.Sum(x => x.Value)}** |");
        return $"""
                ## 接口统计
                <details>
                <summary>点击展开</summary>

                {sb}
                </details>

                """;
    }

    /// <summary>
    /// 开发者Token
    /// </summary>
    /// <returns></returns>
    private static string DeveloperTokenDoc()
    {
        if (App.Application?.Environment.IsDevelopment() != true) return string.Empty;
        var systemOptions = App.Services?.GetService<IOptions<SystemOptions>>()?.Value;
        var tokenOptions = App.Services?.GetService<IOptions<TokenOptions>>()?.Value;
        if (systemOptions is null || string.IsNullOrWhiteSpace(systemOptions.DefaultUser) || tokenOptions is null)
            return string.Empty;
        // 获取用户信息
        var db = DbScoped.SugarScope;
        var user = db.Queryable<SystemUser>()
            .First(x => x.Email == $"{systemOptions.DefaultUser}@{systemOptions.DefaultUser}.org");
        if (user == null) return string.Empty;
        var token = tokenOptions.GenerateToken(user, db).GetAwaiter().GetResult();
        return $"""
                ## 开发者Token
                <details>
                <summary>点击展开</summary>

                ```
                {token}
                ```
                </details>

                """;
    }
}

/// <summary>
/// Bearer安全方案
/// </summary>
/// <param name="authenticationSchemeProvider"></param>
internal sealed class BearerSecurityTransformer(IAuthenticationSchemeProvider authenticationSchemeProvider)
    : IOpenApiDocumentTransformer
{
    /// <summary>
    /// TransformAsync
    /// </summary>
    /// <param name="document"></param>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    public async Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        // 获取身份验证方案
        var authenticationSchemes = await authenticationSchemeProvider.GetAllSchemesAsync();
        if (authenticationSchemes.Any(authScheme => authScheme.Name == "Bearer"))
        {
            // 定义Bearer安全方案
            var securitySchemes = new Dictionary<string, IOpenApiSecurityScheme>
            {
                ["Bearer"] = new OpenApiSecurityScheme
                {
                    In = ParameterLocation.Header,
                    Name = "Authorization",
                    Type = SecuritySchemeType.ApiKey
                }
            };
            // 添加到OpenAPI文档
            document.Components ??= new OpenApiComponents();
            document.Components.SecuritySchemes = securitySchemes;
            // 添加全局安全要求
            document.Security ??= [];
            document.Security.Add(new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            });
        }
    }
}

/// <summary>
/// 枚举描述
/// </summary>
internal sealed class EnumDescriptionTransformer : IOpenApiSchemaTransformer
{
    /// <summary>
    /// TransformAsync
    /// </summary>
    /// <param name="schema"></param>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    public async Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        if (!context.JsonTypeInfo.Type.IsEnum) return;

        var sb = new StringBuilder();
        sb.AppendLine("\n\n| 枚举值 | 描述 |");
        sb.AppendLine("|------|------|");
        var enumType = context.JsonTypeInfo.Type;
        // 获取枚举的底层类型（int/long等）
        var underlyingType = Enum.GetUnderlyingType(enumType);
        foreach (var name in Enum.GetNames(enumType))
        {
            // 获取枚举值
            var enumValue = Enum.Parse(enumType, name);
            var numericValue = Convert.ChangeType(enumValue, underlyingType);
            // 获取描述
            var member = enumType.GetMember(name).First();
            var desc = member.GetCustomAttribute<DescriptionAttribute>()?.Description;
            // 添加
            sb.AppendLine($"| {numericValue} | {desc ?? name} |");
        }

        // 直接写入描述字段
        schema.Description += sb.ToString();
    }
}

/// <summary>
/// SqlSugar表描述
/// </summary>
internal sealed class SugarTableDescriptionTransformer : IOpenApiSchemaTransformer
{
    /// <summary>
    /// TransformAsync
    /// </summary>
    /// <param name="schema"></param>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    public async Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        if (!context.JsonTypeInfo.Type.IsClass) return;
        var tableAttr = context.JsonTypeInfo.Type.GetCustomAttribute<SugarTable>();
        if (tableAttr != null && !string.IsNullOrEmpty(tableAttr.TableDescription))
        {
            schema.Description = tableAttr.TableDescription;
        }
    }
}

/// <summary>
/// SqlSugar列描述
/// </summary>
internal sealed class SugarColumnDescriptionTransformer : IOpenApiSchemaTransformer
{
    /// <summary>
    /// TransformAsync
    /// </summary>
    /// <param name="schema"></param>
    /// <param name="context"></param>
    /// <param name="cancellationToken"></param>
    public async Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        if (!context.JsonTypeInfo.Type.IsClass) return;
        foreach (var property in context.JsonTypeInfo.Type.GetProperties())
        {
            // 获取SugarColumn特性
            var columnAttr = property
                .GetCustomAttributes<SugarColumn>()
                .FirstOrDefault();
            if (columnAttr == null || string.IsNullOrEmpty(columnAttr.ColumnDescription)) continue;
            var propertyName = property.Name;
            // 将名称转换为首字母小写（符合JSON命名规范）
            propertyName = char.ToLowerInvariant(propertyName[0]) + propertyName[1..];
            if (schema.Properties != null && schema.Properties.TryGetValue(propertyName, out var propSchema))
            {
                propSchema.Description = columnAttr.ColumnDescription;
            }
        }
    }
}