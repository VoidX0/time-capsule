using System.ComponentModel;

namespace TimeCapsule.Core.Models.Common;

[Description("通用分页响应结果")]
public class PagedResult<T>
{
    [Description("当前页的数据列表")] public List<T> Items { get; set; } = [];
    [Description("数据总条数")] public int TotalCount { get; set; }
    [Description("当前页码")] public int PageNumber { get; set; }
    [Description("每页大小")] public int PageSize { get; set; }
    [Description("总页数")] public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    [Description("是否有上一页")] public bool HasPreviousPage => PageNumber > 1;
    [Description("是否有下一页")] public bool HasNextPage => PageNumber < TotalPages;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="items"></param>
    /// <param name="totalCount"></param>
    /// <param name="pageNumber"></param>
    /// <param name="pageSize"></param>
    public PagedResult(List<T> items, int totalCount, int pageNumber, int pageSize)
    {
        Items = items ?? [];
        TotalCount = totalCount;
        PageNumber = pageNumber;
        PageSize = pageSize;
    }
}