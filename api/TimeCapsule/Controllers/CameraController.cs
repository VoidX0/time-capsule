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
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<List<Timeline>>> GetTimeline(string cameraId)
    {
        var id = long.TryParse(cameraId, out var parsedId) ? parsedId : 0;
        var segments = await Db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == id)
            .OrderBy(x => x.StartTime)
            .SplitTable()
            .ToListAsync();
        // 生成时间轴
        var timeline = new List<Timeline>();
        foreach (var segment in segments)
        {
            // 时间轴为空
            if (timeline.Count == 0)
            {
                timeline.Add(new Timeline(segment.StartTime, segment.EndTime, true));
                continue;
            }

            // 时间轴不为空
            var last = timeline.Last();
            if (segment.StartTime - last.End < TimeSpan.FromSeconds(60))
            {
                // 合并时间段
                last.End = segment.EndTime;
            }
            else
            {
                // 添加中间的空白时间段
                timeline.Add(new Timeline(last.End, segment.StartTime, false));
                // 添加新的时间段
                timeline.Add(new Timeline(segment.StartTime, segment.EndTime, true));
            }
        }

        return Ok(timeline);
    }
}