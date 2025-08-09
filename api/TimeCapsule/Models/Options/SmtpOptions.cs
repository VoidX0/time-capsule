namespace TimeCapsule.Models.Options;

/// <summary>
/// SMTP邮箱配置
/// </summary>
public class SmtpOptions
{
    /// <summary>
    /// 服务器地址
    /// </summary>
    public string Server { get; set; } = string.Empty;

    /// <summary>
    /// 端口号
    /// </summary>
    public int Port { get; set; } = 587;

    /// <summary>
    /// 启用SSL
    /// </summary>
    public bool EnableSsl { get; set; }

    /// <summary>
    /// 用户名
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// 密码
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// 邮件标题
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 注册确认模板
    /// </summary>
    public string TemplateRegisterConfirm { get; set; } = string.Empty;

    /// <summary>
    /// 登录确认模板
    /// </summary>
    /// <returns></returns>
    public string TemplateLoginConfirm { get; set; } = string.Empty;
}