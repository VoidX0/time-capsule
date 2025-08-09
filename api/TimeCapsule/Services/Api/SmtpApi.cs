using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using TimeCapsule.Core.Models.Common;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Services.Api;

/// <summary>
/// SMTP邮箱API
/// </summary>
public class SmtpApi
{
    /// <summary>
    /// 配置信息
    /// </summary>
    private SmtpOptions Options { get; set; }

    /// <summary>
    /// 邮件客户端
    /// </summary>
    private SmtpClient EmailClient { get; set; }

    /// <summary>
    /// 构造函数
    /// </summary>
    public SmtpApi()
    {
        Options = App.Services?.GetRequiredService<IOptions<SmtpOptions>>().Value ?? new SmtpOptions();
        EmailClient = new SmtpClient(Options.Server, Options.Port)
        {
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(Options.Username, Options.Password),
            EnableSsl = Options.EnableSsl,
            Timeout = 10 * 1000 // seconds
        };
    }

    /// <summary>
    /// 发送消息
    /// </summary>
    /// <param name="template">选择模板</param>
    /// <param name="emails">收件人</param>
    /// <param name="parameters">模板参数</param>
    /// <returns></returns>
    public async Task<OperateResult> SendMessage(Func<SmtpOptions, string> template,
        List<string> emails, Dictionary<string, string> parameters)
    {
        await Task.CompletedTask;
        if (emails.Count == 0) return OperateResult.Fail("收件人列表不能为空");
        // 组建邮件内容
        var body = template(Options);
        foreach (var parameter in parameters)
        {
            body = body.Replace($"${parameter.Key}", parameter.Value);
        }

        // 发送邮件
        try
        {
            // 创建邮件对象
            var mail = new MailMessage();
            mail.From = new MailAddress(Options.Username);
            foreach (var email in emails) mail.To.Add(email);
            mail.Subject = Options.Title; // 主题
            mail.Body = body;
            mail.IsBodyHtml = false; // HTML格式
            // 发送邮件
            EmailClient.Send(mail);
            return OperateResult.Success();
        }
        catch (Exception ex)
        {
            return OperateResult.Fail(ex.Message, ex);
        }
    }
}