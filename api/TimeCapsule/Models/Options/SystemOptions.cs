namespace TimeCapsule.Models.Options;

/// <summary>
/// 系统配置信息
/// </summary>
public class SystemOptions
{
    private string? _instance;

    /// <summary>
    /// 实例名称
    /// </summary>
    public string? Instance
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_instance)) return _instance;
            try
            {
                _instance = Environment.MachineName;
            }
            catch
            {
                _instance = "Unknown";
            }

            return _instance;
        }
        set => _instance = value;
    }

    /// <summary>
    /// 持久化存储路径
    /// </summary>
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>
    /// 摄像头基础目录
    /// </summary>
    public string CameraPath { get; set; } = string.Empty;
    
    /// <summary>
    /// 缓存基础目录
    /// </summary>
    public string CachePath { get; set; } = string.Empty;

    /// <summary>
    /// 启用API日志
    /// </summary>
    public bool ApiLogs { get; set; }

    /// <summary>
    /// 启用API参考
    /// </summary>
    public bool ApiReference { get; set; }

    /// <summary>
    /// 启用Hangfire Dashboard
    /// </summary>
    public bool ApiHangfire { get; set; }

    /// <summary>
    /// 默认用户
    /// </summary>
    public string DefaultUser { get; set; } = string.Empty;

    /// <summary>
    /// 默认密码
    /// </summary>
    public string DefaultPassword { get; set; } = string.Empty;

    /// <summary>
    /// 定时任务：同步视频元数据/重建缓存的Cron表达式
    /// </summary>
    public string CronSyncAndCache { get; set; } = "0 0 */1 * * *";
}