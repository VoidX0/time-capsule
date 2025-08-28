using System.Globalization;
using System.Text.RegularExpressions;
using Compunet.YoloSharp;
using Compunet.YoloSharp.Plotting;
using Microsoft.Extensions.Options;
using Serilog;
using SixLabors.ImageSharp;
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
        // 对新增的视频进行分组
        var segmentGroups = newSegments
            .Select((s, i) => new { Segment = s, Index = i })
            .GroupBy(x => x.Index % SystemOptions.MaxTaskPerCamera) // 按余数分组
            .Select(g => g.Select(x => x.Segment).ToList())
            .ToList();
        var allTasks = new List<Task<List<VideoSegment>>>();
        foreach (var group in segmentGroups)
        {
            allTasks.Add(Task.Run(async () =>
            {
                var groupSegments = new List<VideoSegment>();
                foreach (var segment in group)
                    groupSegments.Add(await DetectMetadata(camera, segment, directory));
                return groupSegments;
            }));
        }

        // 等待所有并发任务完成
        var results = await Task.WhenAll(allTasks);
        // 合并结果
        newSegments = results.SelectMany(r => r).ToList();
        // 过滤掉时长为0的视频
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
            catch (Exception e)
            {
                Logger.Warning(e, "删除摄像头缓存目录 {CacheDir} 失败", dir);
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
        return OperateResult.Success(message);
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
            catch (Exception e)
            {
                Logger.Warning(e, "删除摄像头 {CameraName} ({CameraId}) 的无效缩略图 {Thumbnail} 失败",
                    camera.Name, camera.Id, thumbnail);
            }
        }

        // 对需要生成缩略图的视频段进行分组
        var segmentGroups = dbSegments
            .Select((s, i) => new { Segment = s, Index = i })
            .GroupBy(x => x.Index % SystemOptions.MaxTaskPerCamera) // 按余数分组
            .Select(g => g.Select(x => x.Segment).ToList())
            .ToList();
        var allTasks = new List<Task>();
        foreach (var group in segmentGroups)
        {
            allTasks.Add(Task.Run(async () =>
            {
                foreach (var segment in group)
                    await GenerateThumbnail(segment, Path.Combine(SystemOptions.CameraPath, camera.BasePath), path);
            }));
        }

        // 等待所有并发任务完成
        await Task.WhenAll(allTasks);
        Logger.Information("摄像头 {CameraName} ({CameraId}) 的缓存重建完成，共计 {SegmentCount} 个视频段",
            camera.Name, camera.Id, dbSegments.Count);
        return OperateResult.Success($"摄像头 {camera.Name} 的缓存重建完成");
    }

    /// <summary>
    /// 对所有摄像头进行画面检测
    /// </summary>
    /// <returns></returns>
    public async Task<OperateResult> FrameDetect()
    {
        var db = DbScoped.SugarScope;
        // 创建检测目录
        if (!Directory.Exists(SystemOptions.DetectionPath)) Directory.CreateDirectory(SystemOptions.DetectionPath);
        var cameras = await db.Queryable<Camera>().ToListAsync();
        // 移除已经不存在的摄像头的检测结果
        var dirs = Directory.GetDirectories(SystemOptions.DetectionPath);
        foreach (var dir in dirs)
        {
            var dirName = Path.GetFileName(dir);
            if (cameras.Any(x => x.Id.ToString() == dirName)) continue;
            try
            {
                Directory.Delete(dir, true);
            }
            catch (Exception e)
            {
                Logger.Warning(e, "删除摄像头检测结果目录 {DetectionDir} 失败", dir);
                continue;
            }

            // 删除数据库中该摄像头的检测结果
            var cameraId = long.TryParse(dirName, out var parsedId) ? parsedId : 0;
            if (cameraId == 0) continue;
            var detections = await db.Queryable<FrameDetection>()
                .Where(x => x.CameraId == cameraId)
                .SplitTable()
                .ToListAsync();
            await db.AsTenant().UseTranAsync(async () =>
            {
                await db.Deleteable(detections).SplitTable().ExecuteCommandAsync();
            });
        }

        // 开始画面检测
        var tasks = cameras.Where(x => x.EnableDetection).Select(async x =>
        {
            using var cameraDb = new SqlSugarClient(DbScoped.SugarScope.CurrentConnectionConfig);
            return await FrameDetect(x, cameraDb);
        }).ToList();
        var results = await Task.WhenAll(tasks);
        // 组装返回信息
        var successCount = results.Count(x => x.IsSuccess);
        var errorCount = results.Count(x => !x.IsSuccess);
        var message = $"画面检测完成，共计{cameras.Count}个摄像头，成功{successCount}个，失败{errorCount}个";
        return OperateResult.Success(message);
    }

    /// <summary>
    /// 对指定摄像头进行画面检测
    /// </summary>
    /// <param name="camera">摄像头</param>
    /// <param name="db">数据库连接</param>
    /// <returns></returns>
    public async Task<OperateResult> FrameDetect(Camera camera, ISqlSugarClient db)
    {
        // 创建摄像头检测结果目录
        var path = Path.Combine(SystemOptions.DetectionPath, camera.Id.ToString());
        if (!Directory.Exists(path)) Directory.CreateDirectory(path);
        // 数据库中所有视频段
        var dbSegments = await db.Queryable<VideoSegment>()
            .Where(x => x.CameraId == camera.Id)
            .SplitTable()
            .ToListAsync();
        // 数据库中所有帧检测结果
        var dbDetections = await db.Queryable<FrameDetection>()
            .Where(x => x.CameraId == camera.Id)
            .SplitTable()
            .ToListAsync();
        // 获取检测目录下的所有结果
        var detectResults = await GetFiles(path, [".mp4"]);
        // 检查结果对应的视频段是否存在
        foreach (var detectResult in detectResults)
        {
            var id = long.TryParse(Path.GetFileNameWithoutExtension(detectResult), out var parsedId) ? parsedId : 0;
            if (dbSegments.Any(x => x.Id == id)) continue;
            // 删除不存在的视频段的检测结果
            try
            {
                File.Delete(Path.Combine(path, detectResult));
            }
            catch (Exception e)
            {
                Logger.Warning(e, "删除摄像头 {CameraName} ({CameraId}) 的无效检测结果文件 {DetectionFile} 失败",
                    camera.Name, camera.Id, detectResult);
            }

            // 删除数据库中该视频段的检测结果
            var detections = dbDetections.Where(x => x.SegmentId == id).ToList();
            if (detections.Count == 0) continue;
            await db.AsTenant().UseTranAsync(async () =>
            {
                await db.Deleteable(detections).SplitTable().ExecuteCommandAsync();
            });
        }

        // 对尚未检测的视频段进行画面检测
        var dirIds = (await GetFiles(path, [".mp4"]))
            .Select(x => long.TryParse(Path.GetFileNameWithoutExtension(x), out var parsedId) ? parsedId : 0)
            .Where(x => x != 0)
            .ToList();
        var updatedSegments = dbSegments
            .Where(x => !dirIds.Contains(x.Id))
            .OrderBy(x => x.StartTime)
            .ToList();
        // 参数
        var wwwroot = App.Application?.Environment.WebRootPath ?? "";
        var yoloOption = new YoloPredictorOptions { UseCuda = false };
        // 对所有任务进行分组
        var segmentGroups = updatedSegments
            .Select((s, i) => new { Segment = s, Index = i })
            .GroupBy(x => x.Index % SystemOptions.MaxTaskPerCamera) // 按余数分组
            .Select(g => g.Select(x => x.Segment).ToList())
            .ToList();
        var allTasks = new List<Task>();
        foreach (var group in segmentGroups)
        {
            allTasks.Add(Task.Run(async () =>
            {
                var groupDetections = new List<FrameDetection>();
                // 每个任务内部用一个 predictor
                using var predictor = new YoloPredictor(Path.Combine(wwwroot, "models", "yolo11n.onnx"), yoloOption);
                foreach (var segment in group)
                {
                    var videoPath = Path.Combine(SystemOptions.CameraPath, camera.BasePath);
                    groupDetections.AddRange(await DetectSegment(camera, segment, predictor, videoPath, path));
                }

                // // 保存
                // var result = await db.AsTenant().UseTranAsync(async () =>
                // {
                //     await db.Insertable(groupDetections).SplitTable().ExecuteReturnSnowflakeIdListAsync();
                // });
                // if (result.IsSuccess)
                // {
                //     Logger.Information("摄像头 {CameraName} ({CameraId}) 的视频段 {SegmentId} 画面检测完成，检测到 {DetectionCount} 个目标",
                //         camera.Name, camera.Id, group.First().Id, groupDetections.Count);
                // }
                // else
                // {
                //     Logger.Warning(result.ErrorException,
                //         "摄像头 {CameraName} ({CameraId}) 的视频段 {SegmentId} 画面检测失败: {ErrorMessage}",
                //         camera.Name, camera.Id, group.First().Id, result.ErrorMessage);
                // }
            }));
        }

        // 等待所有并发任务完成
        await Task.WhenAll(allTasks);
        return OperateResult.Success($"摄像头 {camera.Name} 的画面检测完成");
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

    /// <summary>
    /// 对视频片段进行画面检测
    /// </summary>
    /// <param name="camera">摄像头</param>
    /// <param name="segment">视频片段</param>
    /// <param name="yoloPredictor">Yolo预测器</param>
    /// <param name="videoPath">视频存储路径</param>
    /// <param name="detectionPath">检测结果存储路径</param>
    /// <returns></returns>
    private async Task<List<FrameDetection>> DetectSegment(Camera camera, VideoSegment segment,
        YoloPredictor yoloPredictor,
        string videoPath, string detectionPath)
    {
        // 初始化缓存目录
        var cachePath = Path.Combine(SystemOptions.CachePath, $"segment_{segment.Id}");
        if (Directory.Exists(cachePath)) Directory.Delete(cachePath, true);
        var tmpImagePath = Path.Combine(cachePath, "tmp");
        var targetImagePath = Path.Combine(cachePath, "target");
        if (!Directory.Exists(tmpImagePath)) Directory.CreateDirectory(tmpImagePath);
        if (!Directory.Exists(targetImagePath)) Directory.CreateDirectory(targetImagePath);
        // 切片到临时目录
        try
        {
            await FFmpeg.Conversions.New()
                .AddParameter($"-i \"{Path.Combine(videoPath, segment.Path)}\"")
                .AddParameter($"-vf fps={segment.VideoFps}")
                .SetOutput(Path.Combine(tmpImagePath, "%010d.jpg"))
                .Start();
        }
        catch
        {
            // ignored
        }

        // 遍历临时目录中的所有图片，进行目标检测
        var detections = new List<FrameDetection>();
        var minConfidence = Math.Min(Math.Max(camera.DetectionConfidence, 0.1M), 1.0M); // 最低置信度
        var detectInterval = Math.Min(Math.Max(camera.DetectionInterval, 1), 100); // 检测间隔帧数
        var files = Directory.GetFiles(tmpImagePath, "*.jpg")
            .ToList().OrderBy(Path.GetFileNameWithoutExtension);
        foreach (var file in files)
        {
            var fileName = Path.GetFileNameWithoutExtension(file);
            if (!int.TryParse(fileName, out var frameIndex)) continue;
            frameIndex -= 1; // 文件名从1开始，索引从0开始
            if (frameIndex % detectInterval == 0) // 检测
            {
                using var image = await Image.LoadAsync(file);
                var results = await yoloPredictor.DetectAsync(file, new YoloConfiguration
                {
                    Confidence = (float)minConfidence,
                });
                // 计算帧时间
                var frameTime = segment.StartTime.AddSeconds(frameIndex / (double)segment.VideoFps);
                // 保存检测图片
                using var plotted = await results.PlotImageAsync(image);
                await plotted.SaveAsync(Path.Combine(targetImagePath, $"{frameIndex + 1:0000000000}.jpg"));
                // 添加检测记录
                detections.AddRange(results.Select(x => new FrameDetection
                {
                    CameraId = camera.Id,
                    SegmentId = segment.Id,
                    FrameTime = frameTime,
                    TargetId = x.Name.Id,
                    TargetName = x.Name.Name,
                    TargetConfidence = Math.Round((decimal)x.Confidence, 4),
                    TargetLocationX = x.Bounds.Location.X,
                    TargetLocationY = x.Bounds.Location.Y,
                    TargetSizeWidth = x.Bounds.Size.Width,
                    TargetSizeHeight = x.Bounds.Size.Height
                }));
            }
            else // 跟踪
            {
                // 移动图片到目标目录
                File.Move(file, Path.Combine(targetImagePath, $"{frameIndex + 1:0000000000}.jpg"));
            }
        }

        // 检测转码为H265
        try
        {
            var output = Path.Combine(detectionPath, $"{segment.Id}.mp4");
            var conversion = FFmpeg.Conversions.New()
                .AddParameter($"-i \"{Path.Combine(targetImagePath, "%010d.jpg")}\"")
                .AddParameter($"-framerate {segment.VideoFps}")
                .AddParameter("-pix_fmt yuv420p")
                .AddParameter("-c:v libx265") // 使用 H.265 编码器
                .AddParameter("-crf 28") // 控制压缩率（越小质量越高，文件越大；默认 28，推荐 23~28）
                .AddParameter("-preset medium") // 编码速度与压缩效率权衡 (ultrafast, superfast, fast, medium, slow, slower)
                .SetOutput(output);
            await conversion.Start();
            // 删除Cache目录
            Directory.Delete(cachePath, true);
        }
        catch
        {
            // ignore
        }

        return detections;
    }
}