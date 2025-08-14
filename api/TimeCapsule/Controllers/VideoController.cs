using System.ComponentModel;
using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Contracts;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Controllers;

/// <summary>
/// 视频流管理
/// </summary>
[ApiController]
[DisplayName("视频流管理")]
[Route("[controller]/[action]")]
[TypeFilter(typeof(AllowAnonymousFilter))]
public class VideoController : ControllerBase
{
    private readonly SystemOptions _systemOptions;
    private readonly ISqlSugarClient _db = DbScoped.SugarScope;
    private readonly IHlsService _hls;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    /// <param name="hls"></param>
    public VideoController(IOptions<SystemOptions> systemOptions, IHlsService hls)
    {
        _systemOptions = systemOptions.Value;
        _hls = hls;
    }

    /// <summary>
    /// 指定Segment的视频流(FLV)
    /// </summary>
    /// <param name="segmentId">视频片段ID</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<IActionResult> SegmentStream(string segmentId)
    {
        var segmentIdActual = long.TryParse(segmentId.Replace(" ", ""), out var sid) ? sid : 0;
        // 查询视频片段
        var segment = await _db.Queryable<VideoSegment>()
            .Where(x => x.Id == segmentIdActual)
            .SplitTable()
            .FirstAsync();
        if (segment == null) return BadRequest("视频片段不存在");
        // 查询摄像头信息
        var camera = await _db.Queryable<Camera>().InSingleAsync(segment.CameraId);
        if (camera == null) return BadRequest("摄像头不存在");
        // 检查文件
        var video = Path.Combine(_systemOptions.CameraPath, camera.BasePath, segment.Path);
        if (!new FileInfo(video).Exists) return BadRequest("视频文件不存在");
        // 返回文件流，启用范围请求支持
        var stream = new FileStream(video, FileMode.Open, FileAccess.Read, FileShare.Read);
        return new FileStreamResult(stream, "video/mp4")
        {
            EnableRangeProcessing = true // 启用范围请求支持
        };
    }

    /// <summary>
    /// 摄像头播放列表(HLS)
    /// </summary>
    /// <param name="cameraId">摄像头ID</param>
    /// <param name="start">开始时间</param>
    /// <param name="durationSec">持续时间（秒）</param>
    /// <param name="segmentSec">分片时长（秒）</param>
    /// <param name="sid">会话ID（可选）</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult> CameraPlaylist(
        string cameraId,
        long start,
        int durationSec = 1800,
        int segmentSec = 10,
        string? sid = null)
    {
        segmentSec = Math.Clamp(segmentSec, 2, 15); // 建议 5~10 秒
        durationSec = Math.Clamp(durationSec, 60, 7200); // 一次最多 2 小时

        var session = await _hls.BuildPlaylistAsync(sid, cameraId,
            DateTimeOffset.FromUnixTimeMilliseconds(start).ToLocalTime(), TimeSpan.FromSeconds(durationSec),
            segmentSec);

        // 生成 m3u8 文本
        var sb = new StringBuilder();
        sb.AppendLine("#EXTM3U");
        sb.AppendLine("#EXT-X-VERSION:3");
        sb.AppendLine($"#EXT-X-TARGETDURATION:{session.TargetDuration}");
        sb.AppendLine($"#EXT-X-MEDIA-SEQUENCE:{session.MediaSequenceStart}");

        string? lastFile = null;
        foreach (var s in session.Segments)
        {
            // 文件边界插入 DISCONTINUITY
            if (s.Discontinuity || lastFile == null || !string.Equals(lastFile, s.FilePath, StringComparison.Ordinal))
            {
                sb.AppendLine("#EXT-X-DISCONTINUITY");
                lastFile = s.FilePath;
            }

            // 可选：节目时间（便于前端对齐时间轴）
            sb.AppendLine($"#EXT-X-PROGRAM-DATE-TIME:{FmtPdt(s.Pdt)}");
            sb.AppendLine($"#EXTINF:{s.Duration:F3},");
            sb.AppendLine(BaseUrl("CameraStream", s.Seq));
        }

        sb.AppendLine("#EXT-X-ENDLIST"); // VOD式窗口；如果做直播/长时回放也可不加
        return Content(sb.ToString(), "application/vnd.apple.mpegurl", Encoding.UTF8);

        string FmtPdt(DateTimeOffset pdt) => pdt.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz");

        string BaseUrl(string action, long seq) =>
            $"/api/Video/{action}?sid={session.Sid}&seq={seq}";
    }

    /// <summary>
    /// 摄像头视频流(HLS)
    /// </summary>
    /// <param name="sid">会话ID</param>
    /// <param name="seq">视频片段序列号</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<IActionResult> CameraStream(string sid, long seq)
    {
        await Task.CompletedTask;
        if (!_hls.TryGetSegment(sid, seq, out var map) || map == null)
            return NotFound();
        Response.Headers.Append("Content-Type", "video/mp2t");
        Response.Headers.Append("Cache-Control", "public, max-age=60");
        var args =
            $"-ss {map.StartOffset.ToString(CultureInfo.InvariantCulture)} " +
            $"-t {map.Duration.ToString(CultureInfo.InvariantCulture)} " +
            $"-i \"{map.FilePath}\" " +
            "-c:v copy -c:a aac -ar 44100 -ac 2 " +
            "-f mpegts " +
            "-reset_timestamps 1";
        return new StreamResult(args);
    }
}