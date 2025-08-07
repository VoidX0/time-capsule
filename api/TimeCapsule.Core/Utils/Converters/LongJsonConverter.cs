using System.Text.Json;
using System.Text.Json.Serialization;

namespace TimeCapsule.Core.Utils.Converters;

/// <summary>
/// long序列化与反序列化处理
/// 序列化为字符串
/// 反序列化为long
/// </summary>
public class LongJsonConverter : JsonConverter<long>
{
    public override long Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => long.Parse(reader.GetString() ?? string.Empty),
            JsonTokenType.Number => reader.GetInt64(),
            _ => throw new JsonException("反序列化失败(类型 long): 仅支持字符串和数字类型")
        };
    }

    public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString());
    }
}