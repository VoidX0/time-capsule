namespace TimeCapsule.Models;

/// <summary>
/// 时间轴
/// </summary>
/// <param name="Time">时间点</param>
/// <param name="Title">标题</param>
/// <param name="Description">描述</param>
/// <param name="Level">级别</param>
public record Timeline(DateTimeOffset Time, string Title, string Description = "", string Level = "verbose");