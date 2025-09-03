using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Core.Utils.Security;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Controllers;

/// <summary>
/// 检测结果管理
/// </summary>
[ApiController]
[DisplayName("检测结果管理")]
[Route("[controller]/[action]")]
public class DetectionController : OrmController<FrameDetection>
{
    private readonly SystemOptions _systemOptions;

    /// <summary>
    /// 构造函数
    /// </summary>
    public DetectionController(IOptions<SystemOptions> systemOptions)
    {
        IsSplitTable = true;
        _systemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 获取检测图片
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="segmentId">视频片段ID</param>
    /// <param name="framePath">帧路径</param>
    /// <param name="token">token</param>
    /// <returns></returns>
    [HttpGet]
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult> GetImage(string cameraId, string segmentId, string framePath, string token)
    {
        await Task.CompletedTask;
        // 验证token
        var isValid = long.TryParse(SecurityRsa.Decrypt(token), out var ticks) &&
                      DateTimeOffset.Now - DateTimeOffset.FromUnixTimeMilliseconds(ticks).ToLocalTime() <
                      TimeSpan.FromMinutes(5);
        if (!isValid) return BadRequest("token invalid or expired");
        // 检查文件
        var video = Path.Combine(_systemOptions.DetectionPath, cameraId, segmentId, framePath);
        if (!new FileInfo(video).Exists) return BadRequest("检测图片不存在");
        // 设置响应头
        Response.Headers.Append("Content-Type", "image/jpeg");
        Response.Headers.CacheControl = "public,max-age=43200"; // 缓存12小时
        Response.Headers.Expires = DateTime.UtcNow.AddHours(12).ToString("R");
        // 返回图片
        var fileStream = new FileStream(video, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(fileStream, "image/jpeg", enableRangeProcessing: true);
    }
}