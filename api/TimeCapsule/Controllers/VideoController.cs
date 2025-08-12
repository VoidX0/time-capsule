using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using Serilog;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;
using TimeCapsule.Models.Options;
using ILogger = Serilog.ILogger;

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
    private ILogger Logger => Log.ForContext<VideoController>();

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    public VideoController(IOptions<SystemOptions> systemOptions)
    {
        _systemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 指定Segment视频流
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="segmentId">视频片段ID</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<IActionResult> StreamSegment(string cameraId, string segmentId)
    {
        var cameraIdActual = long.TryParse(cameraId.Replace(" ", ""), out var cid) ? cid : 0;
        var segmentIdActual = long.TryParse(segmentId.Replace(" ", ""), out var sid) ? sid : 0;
        // 查询摄像头信息
        var camera = await _db.Queryable<Camera>().InSingleAsync(cameraIdActual);
        if (camera == null) return BadRequest("摄像头不存在");
        // 查询视频片段
        var segment = await _db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == cameraIdActual && x.Id == segmentIdActual)
            .SplitTable()
            .FirstAsync();
        if (segment == null) return BadRequest("视频片段不存在");
        // 检查文件
        var video = Path.Combine(_systemOptions.CameraPath, camera.BasePath, segment.Path);
        if (!new FileInfo(video).Exists) return BadRequest("视频文件不存在");
        // 设置响应头（FLV 流格式）
        Response.Headers.Append("Content-Type", "video/x-flv");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("Cache-Control", "no-cache");
        // 生成 ffmpeg 命令行参数
        var args = $"-i \"{video}\" " + // 输入文件
                   "-c:v libx264 " + // 视频编码器
                   "-ac 2 " + // 音频编码器
                   "-f flv " + // 输出格式
                   "-flvflags no_duration_filesize "; // 避免文件大小限制
        return new StreamResult(args);
    }
}