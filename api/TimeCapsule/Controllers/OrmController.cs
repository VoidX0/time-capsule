using Microsoft.AspNetCore.Mvc;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Common;

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
    /// 添加数据
    /// </summary>
    /// <param name="entity">实例列表</param>
    /// <returns></returns>
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
    [HttpPost]
    public virtual async Task<ActionResult<List<T>>> Query(QueryDto dto)
    {
        var conditions = dto.GetConditions(Db);
        var orders = dto.GetOrders(Db);
        if (!conditions.IsSuccess || !orders.IsSuccess || conditions.Content is null || orders.Content is null)
            return BadRequest($"参数错误：{conditions.Message} {orders.Message}");
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
            return IsSplitTable
                ? query.SplitTable().OrderBy(orders.Content).ToOffsetPageAsync(dto.PageNumber, dto.PageSize)
                : query.OrderBy(orders.Content).ToOffsetPageAsync(dto.PageNumber, dto.PageSize);
        });
        return result.IsSuccess ? Ok(result.Data) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// 统计总数
    /// </summary>
    /// <param name="dto">查询条件</param>
    /// <returns></returns>
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
}