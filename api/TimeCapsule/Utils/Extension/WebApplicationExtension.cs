using System.Net;
using System.Security.Claims;
using System.Web;
using Hangfire;
using Hangfire.Dashboard.BasicAuthorization;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Ui.Web.Extensions;
using Serilog.Ui.Web.Models;
using TimeCapsule.Models.Options;
using TimeCapsule.Utils.Middleware;
using Xabe.FFmpeg;
using Xabe.FFmpeg.Downloader;

namespace TimeCapsule.Utils.Extension;

/// <summary>
/// WebApplication扩展
/// </summary>
public static class WebApplicationExtension
{
    /// <param name="app"></param>
    extension(WebApplication app)
    {
        /// <summary>
        /// 启用Serilog请求日志
        /// </summary>
        public void Serilog()
        {
            app.UseMiddleware<RequestBodyLoggingMiddleware>(); // 请求Body日志中间件
            app.UseSerilogRequestLogging(x =>
            {
                x.MessageTemplate = "{RequestMethod} {RequestPath} response {StatusCode} in {Elapsed} ms " +
                                    "[FROM {RemoteHost} {JwtName}({JwtId})] " +
                                    "[QUERY {RequestQuery} BODY {RequestBody}]";
                x.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
                {
                    diagnosticContext.Set("RemoteHost", httpContext.Connection.RemoteIpAddress ?? IPAddress.None);
                    diagnosticContext.Set("JwtName",
                        httpContext.User.Claims.FirstOrDefault(y => y.Type is ClaimTypes.NameIdentifier)?.Value ??
                        "Anonymous");
                    diagnosticContext.Set("JwtId",
                        httpContext.User.Claims.FirstOrDefault(y => y.Type is ClaimTypes.PrimarySid)?.Value ?? "0");
                    var requestQuery = HttpUtility.UrlDecode(httpContext.Request.QueryString.ToString());
                    diagnosticContext.Set("RequestQuery", requestQuery);
                    var requestBody = httpContext.Items.TryGetValue("RequestBody", out var body) ? body : "";
                    const int maxLength = 1024; // 限制日志长度
                    if (requestBody != null && requestBody.ToString()?.Length > maxLength)
                        requestBody = requestBody.ToString()?[..maxLength] + "..."; // 限制日志长度
                    diagnosticContext.Set("RequestBody", requestBody ?? "");
                };
            });
        }

        /// <summary>
        /// Ffmpeg初始化
        /// </summary>
        public async Task FfmpegInit()
        {
            var system = app.Services.GetRequiredService<IOptions<SystemOptions>>().Value;
            var logger = Log.ForContext<Program>();
            var ffmpegPath = Path.Combine(system.StoragePath, "ffmpeg");
            // 下载ffmpeg
            if (!Directory.Exists(ffmpegPath))
            {
                try
                {
                    logger.Information("Downloading ffmpeg...");
                    await FFmpegDownloader.GetLatestVersion(FFmpegVersion.Official, ffmpegPath,
                        new Progress<ProgressInfo>(x =>
                        {
                            logger.Debug("ffmpeg download progress: {Downloaded}/{TotalBytes} bytes ({Percentage}%)",
                                x.DownloadedBytes, x.TotalBytes,
                                x.TotalBytes > 0 ? (x.DownloadedBytes * 100 / x.TotalBytes).ToString("F2") : "0.00");
                        }));
                    logger.Information("ffmpeg download completed successfully.");
                }
                catch (Exception e)
                {
                    logger.Fatal(e, "ffmpeg download failed, please check your network connection or try again later.");
                    Thread.Sleep(3000);
                    Environment.Exit(-1);
                }
            }

            // 设置ffmpeg执行路径
            FFmpeg.SetExecutablesPath(ffmpegPath);
            logger.Information("ffmpeg executables path set to: {Path}", ffmpegPath);
        }

        /// <summary>
        /// 启用API日志
        /// </summary>
        public void ApiLogs()
        {
            var system = app.Services.GetRequiredService<IOptions<SystemOptions>>().Value;
            if (!app.Environment.IsDevelopment() && !system.ApiLogs) return;
            app.UseSerilogUi(x => x
                .WithAuthenticationType(AuthenticationType.Basic) // 认证类型
                .WithHomeUrl("/scalar/v1")); // 跳转API首页
        }

        /// <summary>
        /// 启用API参考
        /// </summary>
        public void ApiReference()
        {
            var system = app.Services.GetRequiredService<IOptions<SystemOptions>>().Value;
            if (!app.Environment.IsDevelopment() && !system.ApiReference) return;
            app.UseSwagger(x =>
            {
                x.OpenApiVersion = OpenApiSpecVersion.OpenApi3_1;
                x.RouteTemplate = "/openapi/{documentName}.json";
            });
            app.MapScalarApiReference(x =>
            {
                x.SortOperationsByMethod() // 按方法排序
                    .SortTagsAlphabetically() // 按Tag排序
                    .WithTheme(ScalarTheme.DeepSpace) // 主题
                    // 添加Bearer认证
                    .AddApiKeyAuthentication("Bearer", y =>
                    {
                        y.Value = "Bearer <your-token>"; // 默认Token
                    });
            });
        }

        /// <summary>
        /// 启用Hangfire仪表盘
        /// </summary>
        public void ApiHangfire()
        {
            var system = app.Services.GetRequiredService<IOptions<SystemOptions>>().Value;
            if (!app.Environment.IsDevelopment() && !system.ApiHangfire) return;
            app.UseHangfireDashboard("/hangfire", new DashboardOptions
            {
                AppPath = "/scalar/v1", // 跳转API首页
                Authorization =
                [
                    new BasicAuthAuthorizationFilter(new BasicAuthAuthorizationFilterOptions
                    {
                        RequireSsl = false,
                        SslRedirect = false,
                        LoginCaseSensitive = true,
                        Users =
                        [
                            new BasicAuthAuthorizationUser
                            {
                                Login = system.DefaultUser,
                                PasswordClear = system.DefaultPassword
                            }
                        ]
                    })
                ]
            });
        }
    }
}