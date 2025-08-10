using System.Diagnostics;
using Hangfire;
using Microsoft.Extensions.Options;
using Serilog;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;
using ILogger = Serilog.ILogger;

namespace TimeCapsule.Services;

/// <summary>
/// 定时任务
/// </summary>
public class ScheduledJob
{
    private ISqlSugarClient Db { get; } = DbScoped.SugarScope;
    private readonly VideoMetadataService _metadataService;

    /// <summary>
    /// 日志
    /// </summary>
    private ILogger Logger { get; } = Log.ForContext<ScheduledJob>();

    /// <summary>
    /// 系统选项
    /// </summary>
    private SystemOptions SystemOptions { get; }

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="recurringJob">定时任务管理器</param>
    /// <param name="systemOptions">系统选项</param>
    /// <param name="metadataService">视频元数据服务</param>
    public ScheduledJob(IRecurringJobManager recurringJob, IOptions<SystemOptions> systemOptions,
        VideoMetadataService metadataService)
    {
        SystemOptions = systemOptions.Value;
        _metadataService = metadataService;
        recurringJob.AddOrUpdate(
            "RemoveVerifyData",
            () => RemoveVerifyData(),
            "0 0 4 * * *",
            options: new RecurringJobOptions { TimeZone = TimeZoneInfo.Local });
        recurringJob.AddOrUpdate(
            "RemoveLocalLogs",
            () => RemoveLocalLogs(),
            "0 0 5 * * *",
            options: new RecurringJobOptions { TimeZone = TimeZoneInfo.Local });
        recurringJob.AddOrUpdate(
            "SyncVideoMetadata",
            () => SyncVideoMetadata(),
            SystemOptions.CronSyncVideoMetadata,
            options: new RecurringJobOptions { TimeZone = TimeZoneInfo.Local }
        );
    }

    /// <summary>
    /// 移除过期的验证数据
    /// </summary>
    public async Task RemoveVerifyData()
    {
        var watch = Stopwatch.StartNew();
        var result = await Db.AsTenant().UseTranAsync(async () =>
        {
            await Db.Deleteable<SystemUserVerify>(x => x.CreateTime <= DateTimeOffset.Now.AddMonths(-3))
                .ExecuteCommandAsync();
        });
        watch.Stop();
        if (result.IsSuccess)
            Logger.Information("移除过期的验证数据完成, 耗时: {Time}ms", watch.ElapsedMilliseconds);
        else
            Logger.Error(result.ErrorException,
                "移除过期的验证数据失败, 错误信息: {Error}, 耗时: {Time}ms",
                result.ErrorException.Message, watch.ElapsedMilliseconds);
    }

    /// <summary>
    /// 移除本地日志
    /// </summary>
    public void RemoveLocalLogs()
    {
        var logPath = new DirectoryInfo(Path.Combine(SystemOptions.StoragePath, "Logs"));
        if (!logPath.Exists)
        {
            Logger.Warning("日志目录不存在: {LogPath}", logPath.FullName);
            return;
        }

        var watch = Stopwatch.StartNew();
        const int countToKeep = 3; //保留最近的日志文件
        try
        {
            //找到历史日志
            var files = logPath.GetFiles("logs-*.db")
                .OrderBy(x => x.Name).ToList();
            var filesToDelete = files.Count <= countToKeep ? [] : files.Take(files.Count - countToKeep).ToList();
            foreach (var fileInfo in filesToDelete) fileInfo.Delete();
            watch.Stop();
            Logger.Information("移除本地日志完成, 已删除 {Count} 个历史文件, 耗时: {Time}ms",
                filesToDelete.Count, watch.ElapsedMilliseconds);
        }
        catch (Exception e)
        {
            watch.Stop();
            Logger.Error(e, "移除本地日志失败, 错误信息: {Error}, 耗时: {Time}ms", e.Message, watch.ElapsedMilliseconds);
        }
    }

    /// <summary>
    /// 同步视频元数据
    /// </summary>
    public async Task SyncVideoMetadata()
    {
        var watch = Stopwatch.StartNew();
        var result = await _metadataService.Sync();
        watch.Stop();
        Logger.Information("{Message}, 耗时: {Time}ms", result.Message, watch.ElapsedMilliseconds);
    }
}