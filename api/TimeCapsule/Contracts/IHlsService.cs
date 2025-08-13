using TimeCapsule.Models;

namespace TimeCapsule.Contracts;

/// <summary>
/// HLS 服务接口
/// </summary>
public interface IHlsService
{
    /// <summary>
    /// 构建 HLS 播放列表
    /// </summary>
    /// <param name="sid">id</param>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="start">开始时间</param>
    /// <param name="window">时间窗口</param>
    /// <param name="targetDurationSec">目标时长（秒）</param>
    /// <returns></returns>
    Task<HlsSession> BuildPlaylistAsync(
        string? sid,
        string cameraId,
        DateTimeOffset start,
        TimeSpan window,
        int targetDurationSec);

    /// <summary>
    /// 获取片段
    /// </summary>
    /// <param name="sid">id</param>
    /// <param name="seq">序列号</param>
    /// <param name="mapItem">mapItem</param>
    /// <returns></returns>
    bool TryGetSegment(string sid, long seq, out HlsSegmentMapItem? mapItem);
}