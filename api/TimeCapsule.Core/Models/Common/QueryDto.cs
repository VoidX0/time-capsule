using System.ComponentModel;
using System.Text.Json;
using SqlSugar;
using TimeCapsule.Core.Utils.Extension;

namespace TimeCapsule.Core.Models.Common;

/// <summary>
/// 查询参数
/// </summary>
public class QueryDto
{
    [Description("页数")] public int PageNumber { get; set; } = 1;

    [Description("每页大小")] public int PageSize { get; set; } = 10;

    [Description("查询条件")] public List<QueryCondition>? Condition { get; set; }

    [Description("排序条件")] public List<QueryOrder>? Order { get; set; }

    /// <summary>
    /// 获取查询条件模型
    /// </summary>
    /// <param name="client"></param>
    /// <returns></returns>
    public OperateResult<List<IConditionalModel>> GetConditions(ISqlSugarClient client)
    {
        Condition ??= [];
        try
        {
            var json = JsonSerializer.Serialize(Condition, JsonOptions.DefaultOptions);
            var conditions = client.Utilities.JsonToConditionalModels(json);
            // 转换字段名为下划线
            foreach (var x in conditions)
            {
                if (x is not ConditionalModel condition) continue;
                condition.FieldName = UtilMethods.ToUnderLine(condition.FieldName);
            }

            return OperateResult<List<IConditionalModel>>.Success(conditions);
        }
        catch (Exception e)
        {
            return OperateResult<List<IConditionalModel>>.Fail(e.Message, e);
        }
    }

    /// <summary>
    /// 获取排序条件模型
    /// </summary>
    /// <param name="client"></param>
    /// <returns></returns>
    public OperateResult<List<OrderByModel>> GetOrders(ISqlSugarClient client)
    {
        Order ??= [];
        try
        {
            var json = JsonSerializer.Serialize(Order, JsonOptions.DefaultOptions);
            var orders = client.Utilities.JsonToOrderByModels(json);
            // 转换字段名为下划线
            foreach (var x in orders)
                x.FieldName = UtilMethods.ToUnderLine(x.FieldName?.ToString());

            return OperateResult<List<OrderByModel>>.Success(orders);
        }
        catch (Exception e)
        {
            return OperateResult<List<OrderByModel>>.Fail(e.Message, e);
        }
    }
}

/// <summary>
/// 条件类型
/// <seealso cref="ConditionalType"/>
/// </summary>
public enum CustomConditionalType
{
    [Description("Equal")] Equal = 0,
    [Description("Like")] Like = 1,
    [Description("GreaterThan")] GreaterThan = 2,
    [Description("GreaterThanOrEqual")] GreaterThanOrEqual = 3,
    [Description("LessThan")] LessThan = 4,
    [Description("LessThanOrEqual")] LessThanOrEqual = 5,
    [Description("In")] In = 6,
    [Description("NotIn")] NotIn = 7,
    [Description("LikeLeft")] LikeLeft = 8,
    [Description("LikeRight")] LikeRight = 9,
    [Description("NoEqual")] NoEqual = 10,
    [Description("IsNullOrEmpty")] IsNullOrEmpty = 11,
    [Description("IsNotNullOrEmpty")] IsNot = 12,
    [Description("NoLike")] NoLike = 13,
    [Description("EqualNull")] EqualNull = 14,
    [Description("InLike")] InLike = 15,
    [Description("Range")] Range = 16
}

/// <summary>
/// 排序类型
/// <seealso cref="OrderByType"/>
/// </summary>
public enum CustomOrderByType
{
    [Description("Asc")] Asc = 0,
    [Description("Desc")] Desc = 1
}

/// <summary>
/// 查询条件
/// <seealso cref="ConditionalModel"/>
/// </summary>
public class QueryCondition
{
    [Description("字段名")] public string FieldName { get; set; } = string.Empty;

    [Description("字段值")] public string FieldValue { get; set; } = string.Empty;

    [Description("条件类型")] public CustomConditionalType ConditionalType { get; set; }

    [Description("CSharp类型名")] public string CSharpTypeName { get; set; } = "string";
}

/// <summary>
/// 排序条件
/// <seealso cref="OrderByModel"/>
/// </summary>
public class QueryOrder
{
    [Description("字段名")] public string FieldName { get; set; } = string.Empty;

    [Description("排序类型")] public CustomOrderByType OrderByType { get; set; }
}