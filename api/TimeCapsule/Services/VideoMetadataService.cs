using System.Globalization;
using Microsoft.Extensions.Options;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Common;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;
using Xabe.FFmpeg;

namespace TimeCapsule.Services;

/// <summary>
/// 视频元数据服务
/// </summary>
public class VideoMetadataService
{
    /// <summary>
    /// 系统选项
    /// </summary>
    private SystemOptions SystemOptions { get; }

    /// <summary>
    /// 数据库
    /// </summary>
    private ISqlSugarClient Db { get; } = DbScoped.SugarScope;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    public VideoMetadataService(IOptions<SystemOptions> systemOptions)
    {
        SystemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 同步所有摄像头的元数据
    /// </summary>
    /// <returns></returns>
    public async Task<OperateResult> Sync()
    {
        var cameras = await Db.Queryable<Camera>().ToListAsync();
        var tasks = cameras.Select(x => Task.Run(async () => await Sync(x))).ToList();
        var results = await Task.WhenAll(tasks);
        // 组装返回信息
        var successCount = results.Count(x => x.IsSuccess);
        var errorCount = results.Count(x => !x.IsSuccess);
        var message = $"元数据同步完成，共计{cameras.Count}个摄像头，成功{successCount}个，失败{errorCount}个";
        return OperateResult.Success(message);
    }

    /// <summary>
    /// 同步指定摄像头的元数据
    /// </summary>
    /// <param name="camera">摄像头</param>
    /// <returns></returns>
    public async Task<OperateResult> Sync(Camera camera)
    {
        // 数据库中所有视频段
        var dbSegments = await Db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == camera.Id)
            .SplitTable()
            .ToListAsync();
        // 获取摄像头目录下的所有视频文件
        var directory = Path.Combine(SystemOptions.CameraPath, camera.BasePath);
        var videos = await GetFiles(directory, [".mp4"]);
        // 新增视频
        var now = DateTimeOffset.Now;
        var newSegments = videos
            .Where(x => dbSegments.All(segment => segment.Path != x))
            .Select(x => new VideoSegment
            {
                CameraId = camera.Id,
                SyncTime = now,
                Path = x,
                Size = Math.Round(new FileInfo(Path.Combine(directory, x)).Length / 1024m / 1024m, 2),
            }).ToList();
        for (var i = 0; i < newSegments.Count; i++) newSegments[i] = await DetectMetadata(newSegments[i], directory);
        newSegments = newSegments.Where(x => x.DurationActual > TimeSpan.Zero)
            .OrderBy(x => x.StartTime)
            .ToList();
        // 移除视频
        var removeSegments = dbSegments
            .Where(x => videos.All(video => video != x.Path))
            .ToList();
        // 更新数据库
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            if (newSegments.Count != 0)
                await Db.Insertable(newSegments).SplitTable().ExecuteReturnSnowflakeIdListAsync();
            if (removeSegments.Count != 0)
                await Db.Deleteable(removeSegments).SplitTable().ExecuteCommandAsync();
        });
        return result.IsSuccess ? OperateResult.Success() : OperateResult.Fail(result.ErrorMessage);
    }

    /// <summary>
    /// 获取指定目录下所有文件
    /// </summary>
    /// <param name="directory">指定目录</param>
    /// <param name="extensions">文件扩展名列表</param>
    /// <returns></returns>
    private async Task<List<string>> GetFiles(string directory, List<string> extensions)
    {
        var files = new List<string>();
        if (!Directory.Exists(directory)) return files;
        // 获取当前目录下的所有文件
        files.AddRange(Directory.GetFiles(directory, "*.*", SearchOption.AllDirectories));
        // 递归获取子目录下的所有文件
        foreach (var subDirectory in Directory.GetDirectories(directory)) await GetFiles(subDirectory, extensions);
        return files
            .Where(x => extensions.Contains(Path.GetExtension(x).ToLowerInvariant()))
            .Select(x => x.Replace(directory, "").TrimStart(Path.DirectorySeparatorChar))
            .ToList();
    }

    /// <summary>
    /// 检测视频片段的元数据
    /// </summary>
    /// <param name="segment">视频片段</param>
    /// <param name="basePath">基础路径</param>
    private static async Task<VideoSegment> DetectMetadata(VideoSegment segment, string basePath = "")
    {
        try
        {
            // 获取媒体信息
            var mediaInfo = await FFmpeg.GetMediaInfo(Path.Combine(basePath, segment.Path));
            var videoStream = mediaInfo.VideoStreams.FirstOrDefault();
            var audioStream = mediaInfo.AudioStreams.FirstOrDefault();
            // 设置视频元数据
            segment.DurationActual = mediaInfo.Duration;
            if (!ParseStartAndEndTime(segment))
            {
                // 文件名解析失败，尝试使用媒体信息中的创建时间
                segment.StartTime = mediaInfo.CreationTime?.ToLocalTime() ?? throw new Exception("无法获取视频创建时间");
                segment.EndTime = segment.StartTime.Add(segment.DurationActual); // 开始时间 + 实际录制时长
            }

            // 设置视频流信息
            if (videoStream != null)
            {
                segment.VideoCodec = videoStream.Codec;
                segment.VideoWidth = videoStream.Width;
                segment.VideoHeight = videoStream.Height;
                segment.VideoFps =
                    decimal.TryParse(videoStream.Framerate.ToString(CultureInfo.InvariantCulture), out var fps)
                        ? fps
                        : 0;
                segment.VideoBitrate = Math.Round(videoStream.Bitrate / 1000m, 2);
            }

            // 设置音频流信息
            if (audioStream != null)
            {
                segment.AudioCodec = audioStream.Codec;
                segment.AudioSampleRate = audioStream.SampleRate;
                segment.AudioChannels = audioStream.Channels;
                segment.AudioBitrate = Math.Round(audioStream.Bitrate / 1000m, 2);
            }

            return segment;
        }
        catch
        {
            segment.DurationActual = TimeSpan.Zero;
            return segment;
        }
    }

    /// <summary>
    /// 使用文件名解析开始和结束时间
    /// </summary>
    /// <param name="segment">视频片段</param>
    /// <returns></returns>
    private static bool ParseStartAndEndTime(VideoSegment segment)
    {
        // 解析文件名中的时间戳
        var fileName = Path.GetFileNameWithoutExtension(segment.Path);
        if (string.IsNullOrEmpty(fileName)) return false;

        // 假设文件名格式为 "00_20250804181104_20250804182349"
        var parts = fileName.Split('_');
        if (parts.Length < 3) return false;

        // 解析开始和结束时间
        if (!DateTimeOffset.TryParseExact(parts[1],
                "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var startTime) ||
            !DateTimeOffset.TryParseExact(parts[2],
                "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var endTime)) return false;
        segment.StartTime = startTime;
        segment.EndTime = endTime;
        segment.DurationTheoretical = endTime - startTime;
        return true;
    }
}