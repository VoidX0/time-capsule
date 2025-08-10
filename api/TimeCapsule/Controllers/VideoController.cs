using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Controllers;

/// <summary>
/// 视频管理
/// </summary>
[ApiController]
[DisplayName("视频管理")]
[Route("[controller]/[action]")]
[TypeFilter(typeof(AllowAnonymousFilter))]
public class VideoController : ControllerBase
{
    private readonly SystemOptions _systemOptions;
    private readonly ISqlSugarClient _db = DbScoped.SugarScope;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    public VideoController(IOptions<SystemOptions> systemOptions)
    {
        _systemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 视频流
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Stream(long cameraId, DateTimeOffset timestamp)
    {
        // 1. 查询摄像头信息
        var camera = await _db.Queryable<Camera>()
            .Where(x => x.Id == cameraId)
            .FirstAsync();
        if (camera == null) return BadRequest("指定的摄像头不存在");
        // 2. 查询视频片段
        var segment = await _db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == cameraId)
            .Where(x => x.StartTime <= timestamp && timestamp <= x.EndTime)
            .SplitTable()
            .FirstAsync();
        if (segment == null) return BadRequest("指定时间点没有可用的视频");

        // 3. 计算实际偏移量（考虑预缓冲）
        var actualOffset = (timestamp - segment.StartTime).TotalSeconds -
                           (segment.DurationTheoretical - segment.DurationActual).TotalSeconds;
        actualOffset = Math.Max(0, actualOffset);
        // 4. 组合完整路径
        var fullPath = Path.Combine(_systemOptions.CameraPath, camera.BasePath, segment.Path);

        // 5. 检查文件是否存在
        if (!new FileInfo(fullPath).Exists) return BadRequest("指定的视频文件已失效");

        // 6. 设置响应头
        Response.Headers.Append("Accept-Ranges", "bytes");
        Response.Headers.Append("Cache-Control", "no-store");
        Response.Headers.Append("X-Video-Start", segment.StartTime.ToString("o"));
        Response.Headers.Append("X-Video-End", segment.EndTime.ToString("o"));
        Response.Headers.Append("X-Video-Offset", actualOffset.ToString("F3"));

        // 7. 流式传输视频
        return new VideoStreamResult(fullPath, actualOffset);
    }

    /// <summary>
    /// MSE视频流
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="timestamp">时间</param>
    /// <param name="segmentType">片段类型：init 或 media</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<IActionResult>
        StreamMse(long cameraId, DateTimeOffset timestamp, string? segmentType = null)
    {
        try
        {
            // 1. 查询摄像头信息
            var camera = await _db.Queryable<Camera>()
                .Where(x => x.Id == cameraId)
                .FirstAsync();
            if (camera == null) return BadRequest("指定的摄像头不存在");
            // 2. 查询视频片段
            var segment = await _db.Queryable<VideoSegment>()
                .Where(x => x.CameraId == cameraId)
                .Where(x => x.StartTime <= timestamp && timestamp <= x.EndTime)
                .SplitTable()
                .FirstAsync();
            if (segment == null) return BadRequest("指定时间点没有可用的视频");
            // 3. 计算实际偏移量（考虑预缓冲）
            var actualOffset = (timestamp - segment.StartTime).TotalSeconds -
                               (segment.DurationTheoretical - segment.DurationActual).TotalSeconds;
            actualOffset = Math.Max(0, actualOffset);
            // 4. 组合完整路径
            var fullPath = Path.Combine(_systemOptions.CameraPath, camera.BasePath, segment.Path);

            // 处理不同类型的片段请求
            return segmentType switch
            {
                "init" => await GenerateInitSegment(fullPath),
                "media" => await GenerateMediaSegment(fullPath, actualOffset),
                _ => BadRequest("无效的片段类型")
            };
        }
        catch
        {
            return StatusCode(500, "Internal server error");
        }
    }

    // 生成初始化段（仅元数据）
    private async Task<IActionResult> GenerateInitSegment(string filePath)
    {
        await Task.CompletedTask;
        // 使用FFmpeg生成初始化段
        var args = $"-i \"{filePath}\" " +
                   "-map 0 " +
                   "-c copy " +
                   "-f mp4 " +
                   "-movflags frag_keyframe+empty_moov " +
                   "-bsf:v h264_mp4toannexb " +
                   "pipe:1";

        var process = StartFfmpegProcess(args);

        Response.Headers.Append("Content-Type", "video/mp4");
        Response.Headers.Append("X-Segment-Type", "init");

        return new FileStreamResult(process.StandardOutput.BaseStream, "video/mp4");
    }

    // 生成媒体段（实际视频数据）
    private async Task<IActionResult> GenerateMediaSegment(string filePath, double startTime)
    {
        await Task.CompletedTask;
        // 使用FFmpeg生成媒体段
        var args = $"-ss {startTime} " +
                   $"-i \"{filePath}\" " +
                   "-t 2 " + // 2秒分片（MSE推荐）
                   "-c copy " +
                   "-f mp4 " +
                   "-movflags frag_keyframe+empty_moov+default_base_moof " +
                   "-bsf:v h264_mp4toannexb " +
                   "pipe:1";

        var process = StartFfmpegProcess(args);

        Response.Headers.Append("Content-Type", "video/mp4");
        Response.Headers.Append("X-Segment-Type", "media");
        Response.Headers.Append("X-Segment-Start", startTime.ToString("F3"));
        Response.Headers.Append("X-Segment-Duration", "2");

        return new FileStreamResult(process.StandardOutput.BaseStream, "video/mp4");
    }

    // 启动FFmpeg进程（公共方法）
    private Process StartFfmpegProcess(string arguments)
    {
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(_systemOptions.StoragePath, "ffmpeg",
                    RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "ffmpeg.exe" : "ffmpeg"),
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.Start();
        return process;
    }
}