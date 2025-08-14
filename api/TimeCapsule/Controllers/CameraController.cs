using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;

namespace TimeCapsule.Controllers;

/// <summary>
/// 摄像头管理
/// </summary>
[ApiController]
[DisplayName("摄像头管理")]
[Route("[controller]/[action]")]
[TypeFilter(typeof(AllowAnonymousFilter))]
public class CameraController : OrmController<Camera>
{
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
}