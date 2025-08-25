using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Contracts;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Services;

/// <summary>
/// HLS 服务
/// </summary>
public class HlsService : IHlsService
{
    private readonly IMemoryCache _cache;
    private readonly ISqlSugarClient _db = DbScoped.SugarScope;
    private readonly SystemOptions _systemOptions;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="cache"></param>
    /// <param name="opt"></param>
    public HlsService(IMemoryCache cache, IOptions<SystemOptions> opt)
    {
        _cache = cache;
        _systemOptions = opt.Value;
    }

    /// <summary>
    /// 获取片段
    /// </summary>
    /// <param name="sid">id</param>
    /// <param name="seq">序列号</param>
    /// <param name="mapItem">mapItem</param>
    /// <returns></returns>
    public bool TryGetSegment(string sid, long seq, out HlsSegmentMapItem? mapItem)
    {
        mapItem = null;
        if (!_cache.TryGetValue<HlsSession>(CacheKey(sid), out var session)) return false;
        mapItem = session!.Segments.FirstOrDefault(s => s.Seq == seq);
        return mapItem != null;
    }

    /// <summary>
    /// 构建 HLS 播放列表
    /// </summary>
    /// <param name="sid">id</param>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="start">开始时间</param>
    /// <param name="window">时间窗口</param>
    /// <param name="targetDurationSec">目标时长（秒）</param>
    /// <returns></returns>
    public async Task<HlsSession> BuildPlaylistAsync(
        string? sid,
        string cameraId,
        DateTimeOffset start,
        TimeSpan window,
        int targetDurationSec)
    {
        // 复用或新建 session
        HlsSession session;
        if (!string.IsNullOrEmpty(sid) && _cache.TryGetValue<HlsSession>(CacheKey(sid!), out var exist))
        {
            session = exist!;
            session.Segments.Clear(); // 重新生成当前窗口的分片（也可以选择追加）
            session.Start = start;
            session.End = start + window;
            session.TargetDuration = targetDurationSec;
        }
        else
        {
            session = new HlsSession
            {
                Sid = string.IsNullOrEmpty(sid) ? Guid.NewGuid().ToString("N") : sid!,
                Start = start,
                End = start + window,
                TargetDuration = targetDurationSec,
                CameraId = cameraId,
                MediaSequenceStart = 0 // 也可从缓存中递增
            };
        }

        // 1) 查库：找出覆盖 [start, end) 的视频段（跨多个文件）
        var cameraIdActual = long.TryParse(cameraId, out var cid) ? cid : 0;
        var end = session.End;

        var segments = await _db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == cameraIdActual)
            // 取交集 以开始时间+实际时长为准
            .Where(x => (x.StartTime + x.DurationActual) > start && x.StartTime < end)
            .OrderBy(x => x.StartTime)
            .SplitTable()
            .ToListAsync();

        // 2) 构建分片映射（切成 ~targetDurationSec 秒的小片）
        var seq = session.MediaSequenceStart;
        var cursor = start;

        for (var i = 0; i < segments.Count && cursor < end; i++)
        {
            var seg = segments[i];

            // 源文件绝对路径
            var filePath = Path.Combine(_systemOptions.CameraPath,
                (await _db.Queryable<Camera>().InSingleAsync(cameraIdActual))!.BasePath,
                seg.Path);

            // 在该源文件内的可用播放窗口
            var segEnd = seg.StartTime + seg.DurationActual; // 实际结束时间
            var clipStart = cursor > seg.StartTime ? cursor : seg.StartTime;
            var clipEnd = end < segEnd ? end : segEnd;

            if (clipEnd <= clipStart) continue;

            var totalSeconds = (clipEnd - clipStart).TotalSeconds;
            var offsetInFile = (clipStart - seg.StartTime).TotalSeconds;

            // 从 clipStart 开始按 targetDurationSec 切成多个分片
            double produced = 0;
            var firstInThisFile = true;
            while (produced + 0.001 < totalSeconds)
            {
                var dur = Math.Min(targetDurationSec, totalSeconds - produced);
                var pdt = clipStart + TimeSpan.FromSeconds(produced);

                session.Segments.Add(new HlsSegmentMapItem(
                    Seq: seq++,
                    FilePath: filePath,
                    StartOffset: offsetInFile + produced,
                    Duration: dur,
                    Pdt: pdt,
                    Discontinuity: firstInThisFile // 文件边界插入一次
                ));
                firstInThisFile = false;
                produced += dur;
            }

            cursor = clipEnd;
        }

        // 缓存会话（可设置过期时间）
        _cache.Set(CacheKey(session.Sid), session,
            new MemoryCacheEntryOptions { SlidingExpiration = TimeSpan.FromMinutes(30) });

        return session;
    }

    private static string CacheKey(string sid) => $"hls:sess:{sid}";
}