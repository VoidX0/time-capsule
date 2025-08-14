namespace TimeCapsule.Models;

/// <summary>
/// HLS 会话
/// </summary>
public class HlsSession
{
    /// <summary>
    /// 会话 ID
    /// </summary>
    public string Sid { get; init; } = Guid.NewGuid().ToString("N");

    /// <summary>
    /// 媒体序列起始编号（MEDIA-SEQUENCE）
    /// </summary>
    public long MediaSequenceStart { get; set; }

    /// <summary>
    /// 目标分片时长（秒）
    /// </summary>
    public int TargetDuration { get; set; } = 10;

    /// <summary>
    /// 分片映射列表
    /// </summary>
    public List<HlsSegmentMapItem> Segments { get; set; } = [];

    /// <summary>
    /// 分片映射的起始时间
    /// </summary>
    public DateTimeOffset Start { get; set; }

    /// <summary>
    /// 分片映射的结束时间
    /// </summary>
    public DateTimeOffset End { get; set; }

    /// <summary>
    /// 摄像头 ID
    /// </summary>
    public string CameraId { get; set; } = string.Empty;
}