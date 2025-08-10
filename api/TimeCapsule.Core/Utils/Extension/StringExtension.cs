namespace TimeCapsule.Core.Utils.Extension;

/// <summary>
/// String扩展类
/// </summary>
public static class StringExtension
{
    /// <summary>
    /// 截取指定两个字符串中间的字符串
    /// </summary>
    /// <param name="source"></param>
    /// <param name="start">开始字符串</param>
    /// <param name="end">结束字符串</param>
    /// <returns>结果字符串</returns>
    public static string Truncate(this string source, string start, string end)
    {
        var num1 = source.IndexOf(start, StringComparison.Ordinal);
        var num2 = source.LastIndexOf(end, StringComparison.Ordinal);
        if (num1 == -1 || num2 == -1)
            return string.Empty;
        var startIndex = num1 + start.Length;
        return startIndex >= num2 ? string.Empty : source.Substring(startIndex, num2 - startIndex).Trim();
    }
}