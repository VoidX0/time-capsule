using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "系统控制器")]
public class SystemController
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "控制器")]
    public string Controller { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "标题")]
    public string Title { get; set; } = string.Empty;
}