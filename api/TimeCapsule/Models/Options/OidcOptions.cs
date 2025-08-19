namespace TimeCapsule.Models.Options;

/// <summary>
/// OIDC配置选项
/// </summary>
public class OidcOptions
{
    /// <summary>
    /// 重定向到后端的地址
    /// </summary>
    public string RedirectUri { get; set; } = string.Empty;
    
    /// <summary>
    /// 客户端ID
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// 客户端密钥
    /// </summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// 授权端点
    /// </summary>
    public string AuthorizationEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// 令牌端点
    /// </summary>
    public string TokenEndpoint { get; set; } = string.Empty;
    
    /// <summary>
    /// 用户信息端点
    /// </summary>
    public string UserInfoEndpoint { get; set; } = string.Empty;
}