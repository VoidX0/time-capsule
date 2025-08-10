using System.Drawing;
using Serilog.Core;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;

namespace TimeCapsule.Utils;

/// <summary>
/// 上下文信息转换
/// </summary>
public class ContextEnricher : ILogEventEnricher
{
    /// <summary>
    /// 转换
    /// </summary>
    /// <param name="logEvent"></param>
    /// <param name="propertyFactory"></param>
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        if (!logEvent.Properties.TryGetValue("SourceContext", out var sourceContextValue)
            || sourceContextValue is not ScalarValue { Value: string fullTypeName }) return;
        // 提取类名（去掉命名空间）
        var className = fullTypeName.Split('.').LastOrDefault();
        if (string.IsNullOrEmpty(className)) return;
        var classNameProperty = propertyFactory.CreateProperty("SourceContext", className);
        logEvent.AddOrUpdateProperty(classNameProperty);
    }
}

/// <summary>
/// Serilog主题
/// </summary>
public static class SerilogTheme
{
    private static readonly Color Gray = Color.FromArgb(98, 114, 164);
    private static readonly Color White = Color.FromArgb(248, 248, 242);
    private static readonly Color Cyan = Color.FromArgb(139, 233, 253);
    private static readonly Color Green = Color.FromArgb(80, 250, 123);
    private static readonly Color Orange = Color.FromArgb(255, 184, 108);
    private static readonly Color Pink = Color.FromArgb(255, 121, 198);
    private static readonly Color Purple = Color.FromArgb(189, 147, 249);
    private static readonly Color Red = Color.FromArgb(255, 85, 85);
    private static readonly Color Yellow = Color.FromArgb(241, 250, 140);

    /// <summary>
    /// 组合颜色
    /// </summary>
    /// <param name="color"></param>
    /// <param name="bold"></param>
    /// <returns></returns>
    private static string AnsiColor(Color color, bool bold = false)
    {
        // 颜色: \x1b[38;2;<r>;<g>;<b>m
        // 粗体: \x1b[38;2;<r>;<g>;<b>;1m
        var ansi = $"\x1b[38;2;{color.R};{color.G};{color.B}";
        if (bold) ansi += ";1";
        return ansi + "m";
    }

    /// <summary>
    /// 自定义控制台主题
    /// <see cref="AnsiConsoleTheme"/>
    /// </summary>
    public static AnsiConsoleTheme CustomConsole { get; } = new(
        new Dictionary<ConsoleThemeStyle, string>
        {
            [ConsoleThemeStyle.Text] = AnsiColor(White),
            [ConsoleThemeStyle.SecondaryText] = AnsiColor(Gray),
            [ConsoleThemeStyle.TertiaryText] = AnsiColor(Gray),
            [ConsoleThemeStyle.Invalid] = AnsiColor(Gray, true),
            [ConsoleThemeStyle.Null] = AnsiColor(Cyan),
            [ConsoleThemeStyle.Name] = AnsiColor(Cyan),
            [ConsoleThemeStyle.String] = AnsiColor(Orange),
            [ConsoleThemeStyle.Number] = AnsiColor(Green),
            [ConsoleThemeStyle.Boolean] = AnsiColor(Pink),
            [ConsoleThemeStyle.Scalar] = AnsiColor(Green),
            // 级别颜色
            [ConsoleThemeStyle.LevelVerbose] = AnsiColor(Gray),
            [ConsoleThemeStyle.LevelDebug] = AnsiColor(Cyan),
            [ConsoleThemeStyle.LevelInformation] = AnsiColor(Green),
            [ConsoleThemeStyle.LevelWarning] = AnsiColor(Yellow, true),
            [ConsoleThemeStyle.LevelError] = AnsiColor(Red, true),
            [ConsoleThemeStyle.LevelFatal] = AnsiColor(Purple, true)
        });
}