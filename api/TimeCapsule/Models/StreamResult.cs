using Microsoft.AspNetCore.Mvc;
using Serilog;
using Xabe.FFmpeg;
using ILogger = Serilog.ILogger;

namespace TimeCapsule.Models;

/// <summary>
/// 视频流式传输结果
/// </summary>
public class StreamResult : IActionResult
{
    private readonly string _args;
    private ILogger Logger => Log.ForContext<StreamResult>();

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="args">ffmpeg命令行参数</param>
    public StreamResult(string args)
    {
        _args = args;
    }

    /// <summary>
    /// 执行结果
    /// </summary>
    /// <param name="context"></param>
    public async Task ExecuteResultAsync(ActionContext context)
    {
        var response = context.HttpContext.Response;
        var cancellationToken = context.HttpContext.RequestAborted;
        var conversion = FFmpeg.Conversions.New().AddParameter(_args); // 使用传入的ffmpeg参数
        conversion.PipeOutput(); // 启用管道输出
        try
        {
            // 管道中收到数据
            conversion.OnVideoDataReceived += async (_, args) =>
            {
                try
                {
                    // 将数据写入响应流
                    await response.Body.WriteAsync(args.Data.AsMemory(0, args.Data.Length), cancellationToken);
                }
                catch
                {
                    // Logger.Debug(e, "ffmpeg conversion cancelled");
                }
            };
            await conversion.Start(cancellationToken); // 启动ffmpeg转换
        }
        catch (Exception ex)
        {
            Logger.Warning(ex, "ffmpeg conversion failed");
        }
        finally
        {
            await response.Body.FlushAsync(cancellationToken);
        }
    }
}