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
    /// <param name="startTs">开始时间戳</param>
    /// <param name="endTs">结束时间戳</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<Timeline>>> GetTimeline(string cameraId, long startTs, long endTs)
    {
        var id = long.TryParse(cameraId, out var parsedId) ? parsedId : 0;
        var start = DateTimeOffset.FromUnixTimeMilliseconds(startTs).ToLocalTime();
        var end = DateTimeOffset.FromUnixTimeMilliseconds(endTs).ToLocalTime();
        // 找到时段内所有片段
        var segments = await Db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == id)
            .Where(x => x.StartTime < end && x.EndTime > start)
            .OrderBy(x => x.StartTime)
            .SplitTable()
            .ToListAsync();
        // 找到最后一个片段
        var lastSegment = await Db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == id)
            .OrderByDescending(x => x.EndTime)
            .SplitTable()
            .FirstAsync();
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

        // 如果最后一个片段的结束时间在查询范围内，则添加一个结束时间点
        if (lastSegment != null && lastSegment.EndTime > start && lastSegment.EndTime < end)
            timeline.Add(new Timeline(lastSegment.EndTime, "Over", "", "warning"));

        return Ok(timeline.Concat(Timeline.PointMarks(start, end)).OrderBy(x => x.Time).ToList());
    }
}