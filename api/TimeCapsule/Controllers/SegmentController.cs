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
/// 视频片段管理
/// </summary>
[ApiController]
[DisplayName("视频片段管理")]
[Route("[controller]/[action]")]
[TypeFilter(typeof(AllowAnonymousFilter))]
public class SegmentController : OrmController<VideoSegment>
{
    private readonly SystemOptions _systemOptions;

    /// <summary>
    /// 构造函数
    /// </summary>
    public SegmentController(IOptions<SystemOptions> systemOptions)
    {
        IsSplitTable = true;
        _systemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 获取缩略图
    /// </summary>
    /// <param name="segmentId">视频片段ID</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<IActionResult> GetThumbnail(string segmentId)
    {
        var segmentIdActual = long.TryParse(segmentId.Replace(" ", ""), out var sid) ? sid : 0;
        // 查询视频片段
        var segment = await Db.Queryable<VideoSegment>()
            .Where(x => x.Id == segmentIdActual)
            .SplitTable()
            .FirstAsync();
        if (segment == null) return BadRequest("视频片段不存在");
        // 检查文件
        var video = Path.Combine(_systemOptions.CachePath, segment.CameraId.ToString(), $"{segment.Id}.jpg");
        if (!new FileInfo(video).Exists) return BadRequest("缩略图不存在");
        // 设置响应头
        Response.Headers.Append("Content-Type", "image/jpeg");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        // 返回缩略图
        var fileStream = new FileStream(video, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(fileStream, "image/jpeg", enableRangeProcessing: true);
    }
}