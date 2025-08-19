using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Controllers;

/// <summary>
/// 视频片段管理
/// </summary>
[ApiController]
[DisplayName("视频片段管理")]
[Route("[controller]/[action]")]
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
    [TypeFilter(typeof(AllowAnonymousFilter))]
    public async Task<ActionResult> GetThumbnail(string segmentId)
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
        Response.Headers.CacheControl = "public,max-age=43200"; // 缓存12小时
        Response.Headers.Expires = DateTime.UtcNow.AddHours(12).ToString("R");
        // 返回缩略图
        var fileStream = new FileStream(video, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(fileStream, "image/jpeg", enableRangeProcessing: true);
    }

    #region ORM

    /// <summary>
    /// 删除数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
    [HttpDelete]
    public override async Task<ActionResult<int>> Delete(List<VideoSegment> entity)
    {
        var delete = await base.Delete(entity);
        if (delete.Result is not OkObjectResult) return delete;
        var cameraId = entity.Select(x => x.CameraId).Distinct().ToList();
        var cameras = await Db.Queryable<Camera>().Where(x => cameraId.Contains(x.Id)).ToListAsync();
        // 删除对应的文件 (删除失败的文件，会在下次Sync时重新同步，所以不需要处理异常)
        foreach (var segment in entity)
        {
            var camera = cameras.FirstOrDefault(x => x.Id == segment.CameraId);
            if (camera == null) continue;
            var video = new FileInfo(Path.Combine(_systemOptions.CameraPath, camera.BasePath, segment.Path));
            var thumbnail = new FileInfo(Path.Combine(_systemOptions.CachePath, segment.CameraId.ToString(),
                $"{segment.Id}.jpg"));
            // 删除视频文件
            if (video.Exists)
            {
                try
                {
                    video.Delete();
                }
                catch
                {
                    // ignore
                }
            }

            // 删除缩略图
            if (thumbnail.Exists)
            {
                try
                {
                    thumbnail.Delete();
                }
                catch
                {
                    // ignore
                }
            }
        }

        return delete;
    }

    #endregion
}