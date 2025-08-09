using System.Text;

namespace TimeCapsule.Utils.Middleware;

/// <summary>
/// 请求Body日志中间件
/// </summary>
public class RequestBodyLoggingMiddleware
{
    private readonly RequestDelegate _next;

    /// <summary>
    /// 构造函数
    /// </summary>
    public RequestBodyLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    /// <summary>
    /// 中间件调用
    /// </summary>
    /// <param name="context"></param>
    public async Task InvokeAsync(HttpContext context)
    {
        // 允许多次读取请求Body
        context.Request.EnableBuffering();

        // 读取Body并存储到上下文中
        var body = await ReadRequestBodyAsync(context.Request);
        context.Items["RequestBody"] = body;

        // 调用下一个中间件
        await _next(context);
    }

    /// <summary>
    /// 读取请求Body
    /// </summary>
    private static async Task<string> ReadRequestBodyAsync(HttpRequest request)
    {
        request.Body.Position = 0;
        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0; // 读取完后重置位置，供后续使用
        return body;
    }
}