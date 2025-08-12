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
}