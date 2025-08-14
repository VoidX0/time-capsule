namespace TimeCapsule.Models;

/// <summary>
/// 时间轴
/// </summary>
/// <param name="Time">时间点</param>
/// <param name="Title">标题</param>
/// <param name="Description">描述</param>
/// <param name="Level">级别</param>
public record Timeline(DateTimeOffset Time, string Title, string Description = "", string Level = "verbose")
{
    /// <summary>
    /// 生成整点标记
    /// </summary>
    /// <param name="start">开始时间</param>
    /// <param name="end">结束时间</param>
    /// <returns></returns>
    public static List<Timeline> PointMarks(DateTimeOffset start, DateTimeOffset end)
    {
        var marks = new List<Timeline>();
        var current = new DateTimeOffset(start.Year, start.Month, start.Day, 0, 0, 0, start.Offset);
        if (current < start) current = current.AddHours(12);
        while (current <= end)
        {
            marks.Add(new Timeline(current, current.ToString("MM/dd HH")));
            current = current.AddHours(12); // 每12小时一个标记
        }

        return marks;
    }
}