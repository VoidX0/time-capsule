using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Serilog;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Common;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;
using Xabe.FFmpeg;
using ILogger = Serilog.ILogger;

namespace TimeCapsule.Services;

/// <summary>
/// 视频相关服务
/// </summary>
public class VideoService
{
    /// <summary>
    /// 系统选项
    /// </summary>
    private SystemOptions SystemOptions { get; }

    /// <summary>
    /// 日志记录器
    /// </summary>
    private ILogger Logger => Log.ForContext<VideoService>();

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    public VideoService(IOptions<SystemOptions> systemOptions)
    {
        SystemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 同步所有摄像头的元数据
    /// </summary>
    /// <returns></returns>
    public async Task<OperateResult> Sync()
    {
        var db = DbScoped.SugarScope;
        var cameras = await db.Queryable<Camera>().ToListAsync();
        var tasks = cameras.Select(async x =>
        {
            using var cameraDb = new SqlSugarClient(DbScoped.SugarScope.CurrentConnectionConfig);
            return await Sync(x, cameraDb);
        }).ToList();
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
    /// <param name="db">数据库连接</param>
    /// <returns></returns>
    public async Task<OperateResult> Sync(Camera camera, ISqlSugarClient db)
    {
        // 数据库中所有视频段
        var dbSegments = await db.Queryable<VideoSegment>()
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
        for (var i = 0; i < newSegments.Count; i++)
            newSegments[i] = await DetectMetadata(camera, newSegments[i], directory);
        newSegments = newSegments.Where(x => x.DurationActual > TimeSpan.Zero)
            .OrderBy(x => x.StartTime)
            .ToList();
        // 移除视频
        var removeSegments = dbSegments
            .Where(x => videos.All(video => video != x.Path))
            .ToList();
        // 更新数据库
        var result = await db.AsTenant().UseTranAsync(async () =>
        {
            if (newSegments.Count != 0)
                await db.Insertable(newSegments).SplitTable().ExecuteReturnSnowflakeIdListAsync();
            if (removeSegments.Count != 0)
                await db.Deleteable(removeSegments).SplitTable().ExecuteCommandAsync();
        });
        if (result.IsSuccess)
        {
            Logger.Information("摄像头 {CameraName} ({CameraId}) 元数据同步完成，共计新增 {NewCount} 个视频段，移除 {RemoveCount} 个视频段",
                camera.Name, camera.Id, newSegments.Count, removeSegments.Count);
        }
        else
        {
            Logger.Warning(result.ErrorException, "摄像头 {CameraName} ({CameraId}) 元数据同步失败: {ErrorMessage}",
                camera.Name, camera.Id, result.ErrorMessage);
        }

        return result.IsSuccess ? OperateResult.Success() : OperateResult.Fail(result.ErrorMessage);
    }

    /// <summary>
    /// 重建所有摄像头的缓存
    /// </summary>
    /// <returns></returns>
    public async Task<OperateResult> Cache()
    {
        var db = DbScoped.SugarScope;
        // 创建缓存目录
        if (!Directory.Exists(SystemOptions.CachePath)) Directory.CreateDirectory(SystemOptions.CachePath);
        var cameras = await db.Queryable<Camera>().ToListAsync();
        // 移除已经不存在的摄像头的缓存
        var dirs = Directory.GetDirectories(SystemOptions.CachePath);
        foreach (var dir in dirs)
        {
            var dirName = Path.GetFileName(dir);
            if (cameras.Any(x => x.Id.ToString() == dirName)) continue;
            try
            {
                Directory.Delete(dir, true);
            }
            catch
            {
                // ignored
            }
        }

        // 重建缓存
        var tasks = cameras.Select(async x =>
        {
            using var cameraDb = new SqlSugarClient(DbScoped.SugarScope.CurrentConnectionConfig);
            return await Cache(x, cameraDb);
        }).ToList();
        var results = await Task.WhenAll(tasks);
        // 组装返回信息
        var successCount = results.Count(x => x.IsSuccess);
        var errorCount = results.Count(x => !x.IsSuccess);
        var message = $"缓存重建完成，共计{cameras.Count}个摄像头，成功{successCount}个，失败{errorCount}个";
        return OperateResult.Success();
    }

    /// <summary>
    /// 重建摄像头缓存
    /// </summary>
    /// <param name="camera">摄像头</param>
    /// <param name="db">数据库连接</param>
    /// <returns></returns>
    public async Task<OperateResult> Cache(Camera camera, ISqlSugarClient db)
    {
        // 创建摄像头缓存目录
        var path = Path.Combine(SystemOptions.CachePath, camera.Id.ToString());
        if (!Directory.Exists(path)) Directory.CreateDirectory(path);
        // 数据库中所有视频段
        var dbSegments = await db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == camera.Id)
            .SplitTable()
            .ToListAsync();
        // 获取缓存目录下的所有缩略图
        var thumbnails = await GetFiles(path, [".jpg"]);
        // 检查缩略图对应的视频段是否存在
        foreach (var thumbnail in thumbnails)
        {
            var id = long.TryParse(Path.GetFileNameWithoutExtension(thumbnail), out var parsedId) ? parsedId : 0;
            if (dbSegments.Any(x => x.Id == id)) continue;
            // 删除不存在的视频段的缩略图
            try
            {
                File.Delete(Path.Combine(path, thumbnail));
            }
            catch
            {
                // 忽略删除失败的异常
            }
        }

        // 生成缩略图
        foreach (var segment in dbSegments)
            await GenerateThumbnail(segment, Path.Combine(SystemOptions.CameraPath, camera.BasePath), path);
        Logger.Information("摄像头 {CameraName} ({CameraId}) 的缓存重建完成，共计 {SegmentCount} 个视频段",
            camera.Name, camera.Id, dbSegments.Count);
        return OperateResult.Success($"摄像头 {camera.Name} 的缓存重建完成");
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
    /// <param name="camera">摄像头</param>
    /// <param name="segment">视频片段</param>
    /// <param name="basePath">基础路径</param>
    private static async Task<VideoSegment> DetectMetadata(Camera camera, VideoSegment segment, string basePath = "")
    {
        try
        {
            // 获取媒体信息
            var mediaInfo = await FFmpeg.GetMediaInfo(Path.Combine(basePath, segment.Path));
            var videoStream = mediaInfo.VideoStreams.FirstOrDefault();
            var audioStream = mediaInfo.AudioStreams.FirstOrDefault();
            // 设置视频元数据
            segment.DurationActual = mediaInfo.Duration;
            if (!ParseStartAndEndTime(segment, camera.SegmentTemplate))
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
    /// <param name="template">解析模板</param>
    /// <returns></returns>
    public static bool ParseStartAndEndTime(VideoSegment segment, string template)
    {
        // 解析文件名中的时间戳
        var fileName = Path.GetFileNameWithoutExtension(segment.Path);
        if (string.IsNullOrEmpty(fileName)) return false;

        // 将模板转换为正则表达式
        var pattern = Regex.Escape(template);

        // 替换通配符
        pattern = pattern.Replace(@"\*", ".*?"); // * -> 任意多个字符
        pattern = pattern.Replace(@"\_", "_"); // _ -> 字符 '_' 本身

        // 捕获组：{name:format}
        var groupRegex = new Regex(@"\{(?<name>\w+):(?<format>[^}]+)\}");
        var matches = groupRegex.Matches(template);

        var formats = new Dictionary<string, string>();

        foreach (Match m in matches)
        {
            var name = m.Groups["name"].Value;
            var format = m.Groups["format"].Value;
            formats[name] = format;

            // 推断位数（简单做法：去掉非格式字符的长度）
            var length = format.Length;
            var replacement = $@"(?<{name}>\d{{{length}}})";
            pattern = pattern.Replace(Regex.Escape(m.Value), replacement);
        }

        var regex = new Regex("^" + pattern + "$");
        var match = regex.Match(fileName);
        if (!match.Success) return false;

        // 解析时间
        foreach (var kv in formats)
        {
            var name = kv.Key;
            var format = kv.Value;
            if (!match.Groups[name].Success) continue;
            if (DateTimeOffset.TryParseExact(
                    match.Groups[name].Value,
                    format,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var dt))
            {
                if (name.Equals("start", StringComparison.OrdinalIgnoreCase))
                    segment.StartTime = dt;
                else if (name.Equals("end", StringComparison.OrdinalIgnoreCase))
                    segment.EndTime = dt;
            }
            else
            {
                return false;
            }
        }

        segment.DurationTheoretical = segment.EndTime - segment.StartTime;
        return true;
    }

    /// <summary>
    /// 生成视频片段的缩略图
    /// </summary>
    /// <param name="segment">视频片段</param>
    /// <param name="videoPath">视频路径</param>
    /// <param name="cachePath">缓存路径</param>
    /// <returns></returns>
    private static async Task<bool> GenerateThumbnail(VideoSegment segment, string videoPath, string cachePath)
    {
        try
        {
            // 生成缩略图的路径
            var thumbnailPath = Path.Combine(cachePath, $"{segment.Id}.jpg");
            if (File.Exists(thumbnailPath)) return true; // 如果缩略图已存在，则不再生成

            // 使用 ffmpeg 生成缩略图
            var args = $"-i \"{Path.Combine(videoPath, segment.Path)}\" " +
                       $"-frames:v 1 -q:v 2";
            await FFmpeg.Conversions.New()
                .AddParameter(args)
                .SetOutput(thumbnailPath)
                .Start();
            return true;
        }
        catch
        {
            return false;
        }
    }
}