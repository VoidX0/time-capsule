using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "用户授权")]
public class SystemGrantUser
{
    [SugarColumn(ColumnDescription = "用户ID", IsPrimaryKey = true)]
    public long UserId { get; set; }

    [SugarColumn(ColumnDescription = "控制器ID", IsPrimaryKey = true)]
    public long ControllerId { get; set; }
}