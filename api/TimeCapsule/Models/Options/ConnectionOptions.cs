namespace TimeCapsule.Models.Options;

/// <summary>
/// 连接配置
/// </summary>
public class ConnectionOptions
{
    /// <summary>
    /// 数据库连接
    /// </summary>
    public string? DbConnection { get; set; }

    /// <summary>
    /// 日志服务
    /// </summary>
    public string? LogServer { get; set; }
}