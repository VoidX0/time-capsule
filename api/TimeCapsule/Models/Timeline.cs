namespace TimeCapsule.Models;

/// <summary>
/// 时间轴
/// </summary>
/// <param name="start">开始时间</param>
/// <param name="end">结束时间</param>
/// <param name="videoAvailable">视频是否可用</param>
public class Timeline(DateTimeOffset start, DateTimeOffset end, bool videoAvailable)
{
    /// <summary>
    /// 开始时间
    /// </summary>
    public DateTimeOffset Start { get; set; } = start;

    /// <summary>
    /// 结束时间
    /// </summary>
    public DateTimeOffset End { get; set; } = end;

    /// <summary>
    /// 视频是否可用
    /// </summary>
    public bool VideoAvailable { get; set; } = videoAvailable;
}