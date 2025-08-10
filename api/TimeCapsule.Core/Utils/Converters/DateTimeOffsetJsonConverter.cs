using System.Text.Json;
using System.Text.Json.Serialization;

namespace TimeCapsule.Core.Utils.Converters;

/// <summary>
/// DateTimeOffset序列化与反序列化处理
/// 序列化为时间戳(ms)
/// 反序列化为<see cref="DateTimeOffset"/>
/// </summary>
public class DateTimeOffsetJsonConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => DateTimeOffset
                .FromUnixTimeMilliseconds(long.Parse(reader.GetString() ?? string.Empty)).ToLocalTime(),
            JsonTokenType.Number => DateTimeOffset.FromUnixTimeMilliseconds(reader.GetInt64()).ToLocalTime(),
            _ => throw new JsonException("反序列化失败(类型 DateTimeOffset): 仅支持字符串和数字类型(ms时间戳)")
        };
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options)
    {
        writer.WriteNumberValue(value.ToUnixTimeMilliseconds());
    }
}