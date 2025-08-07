using System.ComponentModel;

namespace TimeCapsule.Core.Utils.Extension;

/// <summary>
/// 枚举扩展
/// </summary>
public static class EnumExtension
{
    /// <summary>
    /// 获取枚举的描述
    /// </summary>
    /// <param name="enumValue"></param>
    /// <returns>枚举描述内容</returns>
    public static string GetDescription(this Enum enumValue)
    {
        foreach (var field in enumValue.GetType().GetFields())
        {
            if (!field.FieldType.IsEnum || field.Name != enumValue.ToString()) continue;
            var objs = field.GetCustomAttributes(typeof(DescriptionAttribute), false);
            if (objs.Length > 0) return ((DescriptionAttribute)objs[0]).Description;
        }

        return enumValue.ToString();
    }
}