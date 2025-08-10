using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Models;

/// <summary>
/// 视频流式传输结果
/// </summary>
public class VideoStreamResult : IActionResult
{
    private readonly string _filePath;
    private readonly double _startTime;
    private readonly SystemOptions _systemOptions;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="filePath">文件路径</param>
    /// <param name="startTime">起始时间</param>
    public VideoStreamResult(string filePath, double startTime)
    {
        _filePath = filePath;
        _startTime = startTime;
        _systemOptions = App.Services?.GetService<IOptions<SystemOptions>>()?.Value!;
    }

    /// <summary>
    /// 执行结果
    /// </summary>
    /// <param name="context"></param>
    public async Task ExecuteResultAsync(ActionContext context)
    {
        var response = context.HttpContext.Response;
        var cancellationToken = context.HttpContext.RequestAborted;

        // FFmpeg参数：关键帧对齐优化
        var args = $"-ss {_startTime} " + // 跳转到指定时间
                   $"-i \"{_filePath}\" " + // 输入文件
                   "-t 30 " + // 切片时长30秒
                   "-c:v copy -c:a copy " + // 直接复制流
                   "-f mp4 " + // 输出格式
                   "-movflags frag_keyframe+empty_moov+default_base_moof " + // 流式优化
                   "pipe:1"; // 输出到标准输出

        var ffmpeg = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "ffmpeg.exe" : "ffmpeg";
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(_systemOptions.StoragePath, "ffmpeg", ffmpeg),
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            },
            EnableRaisingEvents = true
        };

        try
        {
            process.Start();
            response.ContentType = "video/mp4";

            // 流式传输输出
            await using (var outputStream = process.StandardOutput.BaseStream)
            {
                await outputStream.CopyToAsync(response.Body, 81920, cancellationToken);
            }

            // 检查错误
            if (!process.HasExited)
            {
                process.Kill();
            }
            else if (process.ExitCode != 0)
            {
                var error = await process.StandardError.ReadToEndAsync();
                throw new Exception($"FFmpeg error: {error}");
            }
        }
        finally
        {
            process.Dispose();
        }
    }
}