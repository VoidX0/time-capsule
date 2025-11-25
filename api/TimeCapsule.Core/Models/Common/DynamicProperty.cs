namespace TimeCapsule.Core.Models.Common;

/// <summary>
/// 动态属性
/// </summary>
/// <param name="name">名称</param>
/// <param name="value">值</param>
public class DynamicProperty(string name, object? value = null)
{
    /// <summary>
    /// 名称
    /// </summary>
    public string Name { get; set; } = name;

    /// <summary>
    /// 值
    /// </summary>
    public object? Value { get; set; } = value;
}