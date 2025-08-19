using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;
using TimeCapsule.Models.Options;
using TimeCapsule.Services;

namespace TimeCapsule.Controllers;

/// <summary>
/// 摄像头管理
/// </summary>
[ApiController]
[DisplayName("摄像头管理")]
[Route("[controller]/[action]")]
public class CameraController : OrmController<Camera>
{
    private readonly SystemOptions _systemOptions;
    private readonly VideoService _videoService;

    /// <summary>
    /// 构造函数
    /// </summary>
    public CameraController(IOptions<SystemOptions> systemOptions, VideoService videoService)
    {
        _systemOptions = systemOptions.Value;
        _videoService = videoService;
    }

    /// <summary>
    /// 同步索引并重建缓存
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<IActionResult> SyncAndCache(string cameraId)
    {
        var id = long.TryParse(cameraId, out var parsedId) ? parsedId : 0;
        var camera = await Db.Queryable<Camera>().In(id).FirstAsync();
        if (camera == null) return NotFound("Camera not found");
        _ = Task.Run(async () =>
        {
            await _videoService.Sync(camera);
            await _videoService.Cache(camera);
        });
        return Ok();
    }
    
    /// <summary>
    /// 获取时间轴
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<Timeline>>> GetTimeline(string cameraId)
    {
        var id = long.TryParse(cameraId, out var parsedId) ? parsedId : 0;
        // 找到时段内所有片段
        var segments = await Db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == id)
            .OrderBy(x => x.StartTime)
            .SplitTable()
            .ToListAsync();
        // 找到开头和结尾的片段
        if (segments.Count == 0) return Ok(new List<Timeline>());
        var firstSegment = segments.FirstOrDefault();
        var lastSegment = segments.LastOrDefault();
        if (firstSegment == null || lastSegment == null) return Ok(new List<Timeline>());
        // 生成时间轴
        var timeline = new List<Timeline>();
        for (var i = 0; i < segments.Count; i++)
        {
            var currentSegment = segments[i]; // 当前数据
            // 第一个数据
            if (i == 0)
            {
                timeline.Add(new Timeline(currentSegment.StartTime, "Online", "", "info"));
                continue;
            }

            // 后续数据
            var preSegment = segments[i - 1]; // 上一个数据
            // 判断当前数据和上一个数据的时间差
            if (currentSegment.StartTime - preSegment.EndTime < TimeSpan.FromSeconds(60)) continue;
            // 添加下线时间点
            timeline.Add(new Timeline(preSegment.EndTime, "Offline", "", "warning"));
            // 添加当前数据的上线时间点
            timeline.Add(new Timeline(currentSegment.StartTime, "Online", "", "info"));
        }

        // 最后添加一个Over
        timeline.Add(new Timeline(lastSegment.EndTime, "Over", "", "warning"));

        return Ok(timeline.Concat(Timeline.PointMarks(firstSegment.StartTime, lastSegment.EndTime))
            .OrderBy(x => x.Time).ToList());
    }

    #region ORM

    /// <summary>
    /// 删除数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
    [HttpDelete]
    public override async Task<ActionResult<int>> Delete(List<Camera> entity)
    {
        var delete = await base.Delete(entity);
        if (delete.Result is not OkObjectResult) return delete;
        // 删除对应的文件 (删除失败的文件，会在下次Sync时重新同步，所以不需要处理异常)
        foreach (var camera in entity)
        {
            var video = new DirectoryInfo(Path.Combine(_systemOptions.CameraPath, camera.BasePath));
            var cache = new DirectoryInfo(Path.Combine(_systemOptions.CachePath, camera.Id.ToString()));
            // 删除视频目录
            if (video.Exists)
            {
                try
                {
                    video.Delete(true);
                }
                catch
                {
                    // ignore
                }
            }

            // 删除缓存目录
            if (cache.Exists)
            {
                try
                {
                    cache.Delete(true);
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