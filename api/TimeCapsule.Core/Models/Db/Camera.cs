using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "摄像头")]
public class Camera
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "摄像头名称")]
    public string Name { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "基础路径")]
    public string BasePath { get; set; } = string.Empty;
}