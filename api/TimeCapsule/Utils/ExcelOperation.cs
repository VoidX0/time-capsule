using System.Collections;
using System.ComponentModel;
using System.Reflection;
using ClosedXML.Excel;
using SqlSugar;
using TimeCapsule.Core.Models.Common;

namespace TimeCapsule.Utils;

/// <summary>
/// Excel操作
/// </summary>
public static class ExcelOperation
{
    /// <summary>
    /// 获取属性名称
    /// </summary>
    /// <param name="prop">属性</param>
    /// <returns></returns>
    private static string GetPropertyName(PropertyInfo prop)
    {
        var name = string.Empty;
        //获取DisplayName特性
        var attributes = prop.GetCustomAttributes(typeof(DisplayNameAttribute), true);
        name = attributes.Length == 0
            ? string.Empty
            : ((DisplayNameAttribute)attributes[0]).DisplayName;
        //获取SugarColumn特性
        if (string.IsNullOrWhiteSpace(name))
        {
            var columnAttr = prop
                .GetCustomAttributes<SugarColumn>()
                .FirstOrDefault();
            name = columnAttr == null ? string.Empty : columnAttr.ColumnDescription;
        }

        //原始属性名
        if (string.IsNullOrWhiteSpace(name)) name = prop.Name;
        return name;
    }

    /// <summary>
    /// 序列化数据列表为Excel
    /// </summary>
    /// <param name="model">模型列表</param>
    /// <typeparam name="T">模型类型</typeparam>
    /// <returns></returns>
    public static MemoryStream? Serialize<T>(List<T> model)
        where T : class
    {
        if (model is { Count: 0 }) return null;
        //新建表格
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add(model[0].GetType().Name);
        //列名
        var currentRow = 1;
        var props = model[0].GetType().GetProperties().ToList();
        foreach (var prop in props)
        {
            //添加列名
            worksheet.Cell(currentRow, props.IndexOf(prop) + 1)
                .SetValue(XLCellValue.FromObject(GetPropertyName(prop)))
                .Style
                .Font.SetBold(true) //加粗
                .Fill.SetBackgroundColor(XLColor.FromHtml("#D9EAD3")); //背景色
        }

        //数据
        foreach (var data in model)
        {
            currentRow++;
            var dataProps = data.GetType().GetProperties().ToList();
            foreach (var prop in dataProps)
            {
                var value = prop.GetValue(data);
                if (value == null) continue;
                //long
                if (value is long) value = value.ToString();
                //enum
                if (prop.PropertyType.IsEnum)
                {
                    var enumValue = Enum.Parse(prop.PropertyType, value?.ToString() ?? string.Empty);
                    value = Enum.GetName(prop.PropertyType, enumValue);
                }

                //list
                if (prop.PropertyType.IsGenericType && prop.PropertyType.GetGenericTypeDefinition() == typeof(List<>))
                {
                    var list = (IList)(value ?? new List<string>());
                    var listValue = string.Join(",", list.Cast<object>().Select(x => x.ToString()));
                    value = listValue;
                }

                //添加数据
                worksheet.Cell(currentRow, dataProps.IndexOf(prop) + 1)
                    .SetValue(XLCellValue.FromObject(value));
            }
        }

        //设置列宽
        worksheet.Columns(1, props.Count).AdjustToContents(1, currentRow) //自适应宽度
            .ToList().ForEach(col =>
            {
                col.Width = col.Width < 10 ? 10 : col.Width; // 设置最小宽度
                col.Width = col.Width > 30 ? 30 : col.Width; // 设置最大宽度
            });

        //返回文件
        var stream = new MemoryStream();
        try
        {
            workbook.SaveAs(stream);
            return stream;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// 反序列化Excel为数据列表
    /// </summary>
    /// <param name="stream">文件流</param>
    /// <typeparam name="T">模型类型</typeparam>
    /// <returns></returns>
    public static List<T> Deserialize<T>(Stream stream)
        where T : class, new()
    {
        //构建表格
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.First();
        //构建列表
        var list = new List<T>();
        //获取所有数据
        var rows = worksheet.RowsUsed();
        //获取列名
        var titles = rows.First().Cells().Select(cell => cell.Value.ToString()).ToList();
        //获取地址
        var addresses = rows.First().Cells().Select(cell => cell.Address.ColumnLetter).ToList();
        //获取DisplayName
        var resultNames = new T().GetType().GetProperties().Select(GetPropertyName).ToList();
        //获取IXLCell的GetValue<T>方法
        var getValueMethod = typeof(IXLCell).GetMethods()
            .First(m => m is { Name: "GetValue", IsGenericMethod: true } && m.GetParameters().Length == 0);
        //遍历数据
        foreach (var row in rows.Skip(1))
        {
            //新建实例
            var t = new T();
            var tProps = t.GetType().GetProperties();
            var cells = row.Cells().ToList();
            foreach (var cell in cells)
            {
                //获取待设置属性索引
                var addressIndex = addresses.IndexOf(cell.Address.ColumnLetter);
                var cellTitle = titles[addressIndex];
                var propIndex = resultNames.IndexOf(cellTitle ?? "");
                if (propIndex == -1) continue;
                var propType = tProps[propIndex].PropertyType;
                //尝试赋值
                try
                {
                    // 动态调用GetValue<T>方法
                    var concreteMethod = getValueMethod.MakeGenericMethod(propType);
                    object? value;
                    // DateTimeOffset || DateTimeOffset?
                    if (propType == typeof(DateTimeOffset) || propType == typeof(DateTimeOffset?))
                    {
                        var text = cell.GetValue<string>();
                        value = DateTimeOffset.Parse(text);
                    }
                    // list
                    else if (propType.IsGenericType && propType.GetGenericTypeDefinition() == typeof(List<>))
                    {
                        //转换为object列表
                        var itemType = propType.GetGenericArguments()[0];
                        var text = cell.GetValue<string>();
                        var textList = text.Split(',').ToList().Select(x => x.Trim()).ToList();
                        var objects = textList.Select(item => Convert.ChangeType(item, itemType)).ToList();
                        //转换为对应类型
                        var listType = typeof(List<>).MakeGenericType(itemType);
                        var dataList = (IList)Activator.CreateInstance(listType)!;
                        foreach (var item in objects) dataList.Add(item);
                        //赋值
                        value = dataList;
                    }
                    else value = concreteMethod.Invoke(cell, null);

                    tProps[propIndex].SetValue(t, value, null);
                }
                catch
                {
                    // ignored
                }
            }

            list.Add(t);
        }

        return list;
    }

    /// <summary>
    /// 反序列化Excel为动态数据列表
    /// </summary>
    /// <param name="stream">文件流</param>
    /// <returns></returns>
    public static List<List<DynamicProperty>> DeserializeDynamic(Stream stream)
    {
        //构建表格
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.First();
        //构建列表
        var list = new List<List<DynamicProperty>>();
        //获取所有数据
        var rows = worksheet.RowsUsed();
        //获取列名
        var titles = rows.First().Cells().Select(cell => cell.Value.ToString()).ToList();
        //获取地址
        var addresses = rows.First().Cells().Select(cell => cell.Address.ColumnLetter).ToList();
        //遍历数据
        foreach (var row in rows.Skip(1))
        {
            //新建实例
            var t = new List<DynamicProperty>();
            var cells = row.Cells().ToList();
            foreach (var cell in cells)
            {
                //获取待设置属性索引
                var addressIndex = addresses.IndexOf(cell.Address.ColumnLetter);
                if (addressIndex == -1) continue;
                var cellTitle = titles[addressIndex];
                if (string.IsNullOrWhiteSpace(cellTitle)) continue;
                //尝试赋值
                try
                {
                    object? value;
                    if (cell.Value.IsBlank) value = cell.Value.GetBlank();
                    else if (cell.Value.IsBoolean) value = cell.Value.GetBoolean();
                    else if (cell.Value.IsNumber)
                    {
                        //double转为decimal，避免精度问题
                        value = cell.Value.GetNumber();
                        value = Convert.ToDecimal(value);
                    }
                    else if (cell.Value.IsText) value = cell.Value.GetText();
                    else if (cell.Value.IsError) value = cell.Value.GetError();
                    else if (cell.Value.IsDateTime) value = cell.Value.GetDateTime();
                    else if (cell.Value.IsTimeSpan) value = cell.Value.GetTimeSpan();
                    else if (cell.Value.IsUnifiedNumber) value = cell.Value.GetUnifiedNumber();
                    else value = null;

                    t.Add(new DynamicProperty(cellTitle, value));
                }
                catch
                {
                    // ignored
                }
            }

            list.Add(t);
        }

        return list;
    }
}