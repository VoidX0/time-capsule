using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using TimeCapsule.Core.Utils.Converters;

namespace TimeCapsule.Core.Utils.Extension;

/// <summary>
/// Json序列化与反序列化配置
/// </summary>
public static class JsonOptions
{
    /// <summary>
    /// 默认的JsonSerializerOptions
    /// </summary>
    public static JsonSerializerOptions DefaultOptions => new JsonSerializerOptions().ConfigureOptions();

    /// <summary>
    /// 配置JsonSerializerOptions
    /// </summary>
    /// <param name="options">待配置的JsonSerializerOptions</param>
    /// <returns>配置后的JsonSerializerOptions</returns>
    public static JsonSerializerOptions ConfigureOptions(this JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = null; //属性名称不转换
        options.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All); //中文不转义
        options.Converters.Add(new DateTimeOffsetJsonConverter()); //DateTimeOffset处理为时间戳
        options.Converters.Add(new LongJsonConverter()); //long处理为字符串
        options.Converters.Add(new DictionaryJsonConverter()); //Dictionary<string, object>处理
        return options;
    }
}