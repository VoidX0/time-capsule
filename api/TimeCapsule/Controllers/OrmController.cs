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
    /// 构建查询对象（处理条件和分表）
    /// </summary>
    protected virtual ISugarQueryable<T> BuildQuery(List<IConditionalModel> conditions)
    {
        // 拆分 Range 条件和其他条件
        var rangeConditions = conditions
            .Where(x => x is ConditionalModel { ConditionalType: ConditionalType.Range }).ToList();
        var otherConditions = conditions.Except(rangeConditions).ToList();
        var query = Db.Queryable<T>().Where(otherConditions);
        // Range条件单独处理
        query = rangeConditions.Aggregate(query, (current, condition) => current.Where([condition]));
        // 处理分表
        if (IsSplitTable) query = query.SplitTable();
        return query;
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
    public virtual async Task<ActionResult<PagedResult<T>>> Query(QueryDto dto)
    {
        var conditions = dto.GetConditions(Db);
        var orders = dto.GetOrders(Db);
        if (!conditions.IsSuccess || !orders.IsSuccess || conditions.Content is null || orders.Content is null)
            return BadRequest($"参数错误：{conditions.Message} {orders.Message}");
        // 构建查询
        var query = BuildQuery(conditions.Content).OrderBy(orders.Content);
        RefAsync<int> total = 0;
        List<T> list;
        // 执行查询
        try
        {
            // 分页同时获取总数
            list = await query.ToPageListAsync(dto.PageNumber, dto.PageSize, total);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }

        return Ok(new PagedResult<T>(list, total, dto.PageNumber, dto.PageSize));
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
        // 构建查询
        var query = BuildQuery(conditions.Content);
        var count = await query.CountAsync();
        return Ok(count);
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
        var list = await BuildQuery(conditions.Content)
            .OrderBy(orders.Content)
            .ToListAsync();
        if (list == null || list.Count == 0) return BadRequest("没有数据可导出");
        // 导出Excel
        var stream = ExcelOperation.Serialize(list);
        if (stream is null) return BadRequest("没有数据可导出");
        stream.Position = 0; // 重置流位置
        return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{typeof(T).Name}_Export_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx");
    }
}