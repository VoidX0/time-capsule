using Microsoft.AspNetCore.Mvc;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Common;
using TimeCapsule.Utils;

namespace TimeCapsule.Controllers;

/// <summary>
/// 包含基础数据功能的ORM控制器
/// </summary>
/// <typeparam name="T">表模型</typeparam>
public abstract class OrmController<T> : ControllerBase where T : class, new()
{
    /// <summary>
    /// 分表
    /// </summary>
    protected bool IsSplitTable { get; set; }

    /// <summary>
    /// DbClient
    /// </summary>
    protected ISqlSugarClient Db { get; } = DbScoped.SugarScope;

    /// <summary>
    /// 查询列表
    /// </summary>
    /// <param name="dto">查询条件</param>
    /// <param name="conditions">条件列表</param>
    /// <param name="orders">排序列表</param>
    /// <param name="pagination">是否进行分页</param>
    /// <returns></returns>
    protected virtual async Task<DbResult<List<T>>> Query(QueryDto dto, List<IConditionalModel> conditions,
        List<OrderByModel> orders, bool pagination)
    {
        // Range条件
        var rangeConditions = conditions
            .Where(x => x is ConditionalModel { ConditionalType: ConditionalType.Range }).ToList();
        // 其他条件
        var otherConditions = conditions.Except(rangeConditions).ToList();
        // 查询(Range条件 需要单独处理where)
        var result = await Db.AsTenant().UseTranAsync(() =>
        {
            var query = Db.Queryable<T>().Where(otherConditions); //其他条件
            // Range条件
            query = rangeConditions.Aggregate(query, (current, condition) => current.Where([condition]));
            if (IsSplitTable)
            {
                // 分表查询
                return pagination
                    ? query.SplitTable().OrderBy(orders).ToOffsetPageAsync(dto.PageNumber, dto.PageSize) //分页
                    : query.SplitTable().OrderBy(orders).ToListAsync(); //不分页
            }
            else
            {
                // 普通查询
                return pagination
                    ? query.OrderBy(orders).ToOffsetPageAsync(dto.PageNumber, dto.PageSize) //分页
                    : query.OrderBy(orders).ToListAsync(); //不分页
            }
        });
        return result;
    }

    /// <summary>
    /// 添加数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
    [EndpointSummary("添加数据")]
    [EndpointDescription("批量添加数据")]
    [HttpPost]
    public virtual async Task<ActionResult<List<long>>> Insert(List<T> entity)
    {
        var result = await Db.AsTenant().UseTranAsync(() =>
            IsSplitTable
                ? Db.Insertable(entity).SplitTable().ExecuteReturnSnowflakeIdListAsync()
                : Db.Insertable(entity).ExecuteReturnSnowflakeIdListAsync());
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 删除数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
    [EndpointSummary("删除数据")]
    [EndpointDescription("批量删除数据")]
    [HttpDelete]
    public virtual async Task<ActionResult<int>> Delete(List<T> entity)
    {
        var result = await Db.AsTenant().UseTranAsync(() =>
            IsSplitTable
                ? Db.Deleteable(entity).SplitTable().ExecuteCommandAsync()
                : Db.Deleteable(entity).ExecuteCommandAsync());
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 更新数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
    [EndpointSummary("更新数据")]
    [EndpointDescription("批量更新数据")]
    [HttpPut]
    public virtual async Task<ActionResult<int>> Update(List<T> entity)
    {
        var result = await Db.AsTenant().UseTranAsync(() =>
            IsSplitTable
                ? Db.Updateable(entity).SplitTable().ExecuteCommandAsync()
                : Db.Updateable(entity).ExecuteCommandAsync());
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 查询列表
    /// </summary>
    /// <param name="dto">查询条件</param>
    /// <returns></returns>
    [EndpointSummary("查询数据")]
    [EndpointDescription("按照条件和排序方式查询数据列表")]
    [HttpPost]
    public virtual async Task<ActionResult<List<T>>> Query(QueryDto dto)
    {
        var conditions = dto.GetConditions(Db);
        var orders = dto.GetOrders(Db);
        if (!conditions.IsSuccess || !orders.IsSuccess || conditions.Content is null || orders.Content is null)
            return BadRequest($"参数错误：{conditions.Message} {orders.Message}");
        var result = await Query(dto, conditions.Content, orders.Content, true);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 统计总数
    /// </summary>
    /// <param name="dto">查询条件</param>
    /// <returns></returns>
    [EndpointSummary("统计总数")]
    [EndpointDescription("按照条件统计数据总数")]
    [HttpPost]
    public virtual async Task<ActionResult<int>> Count(QueryDto dto)
    {
        var conditions = dto.GetConditions(Db);
        if (!conditions.IsSuccess || conditions.Content is null) return BadRequest($"参数错误：{conditions.Message}");
        // Range条件
        var rangeConditions = conditions.Content
            .Where(x => x is ConditionalModel { ConditionalType: ConditionalType.Range }).ToList();
        // 其他条件
        var otherConditions = conditions.Content.Except(rangeConditions).ToList();
        // 查询(Range条件 需要单独处理where)
        var result = await Db.AsTenant().UseTranAsync(() =>
        {
            var query = Db.Queryable<T>().Where(otherConditions); //其他条件
            // Range条件
            query = rangeConditions.Aggregate(query, (current, condition) => current.Where([condition]));
            return IsSplitTable ? query.SplitTable().CountAsync() : query.CountAsync();
        });
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 下载Excel
    /// </summary>
    /// <param name="dto">查询条件</param>
    /// <returns></returns>
    [EndpointSummary("下载Excel")]
    [EndpointDescription("按照条件和排序方式将数据导出为Excel文件")]
    [HttpPost]
    public virtual async Task<ActionResult> DownloadExcel(QueryDto dto)
    {
        var conditions = dto.GetConditions(Db);
        var orders = dto.GetOrders(Db);
        if (!conditions.IsSuccess || !orders.IsSuccess || conditions.Content is null || orders.Content is null)
            return BadRequest($"参数错误：{conditions.Message} {orders.Message}");
        var result = await Query(dto, conditions.Content, orders.Content, false);
        if (!result.IsSuccess) return BadRequest(result.ErrorMessage);
        // 导出Excel
        using var stream = ExcelOperation.Serialize(result.Data);
        if (stream is null) return BadRequest("没有数据可导出");
        try
        {
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{typeof(T).Name}_Export_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}