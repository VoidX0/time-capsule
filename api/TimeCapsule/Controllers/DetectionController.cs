using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using TimeCapsule.Core.Models.Db;

namespace TimeCapsule.Controllers;

/// <summary>
/// 检测结果管理
/// </summary>
[ApiController]
[DisplayName("检测结果管理")]
[Route("[controller]/[action]")]
public class DetectionController : OrmController<FrameDetection>
{
    /// <summary>
    /// 构造函数
    /// </summary>
    public DetectionController()
    {
        IsSplitTable = true;
    }
}