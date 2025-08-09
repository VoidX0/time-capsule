using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "系统角色")]
public class SystemRole
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "角色名")]
    public string Name { get; set; } = string.Empty;
}