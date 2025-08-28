using OpenCvSharp;
using OpenCvSharp.Tracking;

namespace TimeCapsule.Models;

/// <summary>
/// 跟踪器项
/// </summary>
public class TrackerItem
{
    /// <summary>
    /// 跟踪ID
    /// </summary>
    public int TrackId { get; set; }

    /// <summary>
    /// 标签
    /// </summary>
    public string Label { get; set; } = "tracked";

    /// <summary>
    /// 跟踪器
    /// </summary>
    public Tracker Tracker { get; set; } = TrackerKCF.Create();

    /// <summary>
    /// 边界框
    /// </summary>
    public Rect BoundingBox { get; set; }
}