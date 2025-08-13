namespace TimeCapsule.Models;

/// <summary>
/// HLS 分片映射项
/// </summary>
/// <param name="Seq">全局序号（MEDIA-SEQUENCE）</param>
/// <param name="FilePath">源 mp4 路径</param>
/// <param name="StartOffset">在源文件中的起始秒</param>
/// <param name="Duration">分片时长（秒）</param>
/// <param name="Pdt">EXT-X-PROGRAM-DATE-TIME 可选</param>
/// <param name="Discontinuity">源文件边界</param>
public record HlsSegmentMapItem(
    long Seq,
    string FilePath,
    double StartOffset,
    double Duration,
    DateTimeOffset Pdt,
    bool Discontinuity
);