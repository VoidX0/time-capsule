using System.Text.Json;
using System.Text.Json.Serialization;
using Newtonsoft.Json.Linq;
using TimeCapsule.Core.Utils.Extension;

namespace TimeCapsule.Core.Utils.Converters;

/// <summary>
/// Dictionary序列化与反序列化处理
/// </summary>
public class DictionaryJsonConverter : JsonConverter<Dictionary<string, object>>
{
    public override Dictionary<string, object> Read(ref Utf8JsonReader reader, Type typeToConvert,
        JsonSerializerOptions options)
    {
        var dictionary = new Dictionary<string, object>();
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndObject) break; // 结束
            if (reader.TokenType != JsonTokenType.PropertyName) continue;
            var key = reader.GetString(); // 获取Key
            if (string.IsNullOrEmpty(key)) continue;
            reader.Read();
            var value = GetValue(ref reader); // 获取Value
            dictionary.Add(key, value ?? string.Empty); // 添加到字典
        }

        return dictionary;
    }

    /// <summary>
    /// 读取值
    /// </summary>
    /// <param name="reader"></param>
    /// <returns></returns>
    private object? GetValue(ref Utf8JsonReader reader)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.GetDouble(),
            JsonTokenType.True => true,
            JsonTokenType.False => false,
            JsonTokenType.StartObject => Read(ref reader, typeof(Dictionary<string, object>),
                JsonOptions.DefaultOptions),
            JsonTokenType.StartArray => ReadList(ref reader),
            _ => null
        };
    }

    /// <summary>
    /// 读取列表
    /// </summary>
    /// <param name="reader"></param>
    /// <returns></returns>
    private List<object> ReadList(ref Utf8JsonReader reader)
    {
        var list = new List<object>();
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndArray) break;
            list.Add(GetValue(ref reader) ?? string.Empty);
        }

        return list;
    }

    public override void Write(Utf8JsonWriter writer, Dictionary<string, object> value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        foreach (var item in value)
        {
            writer.WritePropertyName(item.Key);
            WriteValue(writer, item.Value, options);
        }

        writer.WriteEndObject();
    }

    /// <summary>
    /// 写入值
    /// </summary>
    /// <param name="writer"></param>
    /// <param name="value"></param>
    /// <param name="options"></param>
    private void WriteValue(Utf8JsonWriter writer, object value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case string str:
                writer.WriteStringValue(str);
                break;
            case long l:
                writer.WriteStringValue(l.ToString());
                break;
            case int i:
                writer.WriteNumberValue(i);
                break;
            case float f:
                writer.WriteNumberValue(f);
                break;
            case double d:
                writer.WriteNumberValue(d);
                break;
            case decimal de:
                writer.WriteNumberValue(de);
                break;
            case bool b:
                writer.WriteBooleanValue(b);
                break;
            case JArray array:
                WriteList(writer, array.ToObject<List<object>>() ?? [], options);
                break;
            case JObject obj:
                Write(writer, obj.ToObject<Dictionary<string, object>>() ?? new Dictionary<string, object>(), options);
                break;
            case List<object> list:
                WriteList(writer, list, options);
                break;
            case Dictionary<string, object> dict:
                Write(writer, dict, options);
                break;
            default:
                writer.WriteNullValue();
                break;
        }
    }

    /// <summary>
    /// 写入List
    /// </summary>
    /// <param name="writer"></param>
    /// <param name="list"></param>
    /// <param name="options"></param>
    private void WriteList(Utf8JsonWriter writer, List<object> list, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var item in list)
            WriteValue(writer, item, options);
        writer.WriteEndArray();
    }
}