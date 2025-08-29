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

    [SugarColumn(ColumnDescription = "Segment解析模板", DefaultValue = " ")]
    public string SegmentTemplate { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "启用目标检测", DefaultValue = "false")]
    public bool EnableDetection { get; set; } = false;

    [SugarColumn(ColumnDescription = "目标检测间隔帧", DefaultValue = "25")]
    public int DetectionInterval { get; set; } = 25;

    [SugarColumn(ColumnDescription = "目标检测最低置信度", DefaultValue = "0.3")]
    public decimal DetectionConfidence { get; set; } = 0.3M;

    [SugarColumn(ColumnDescription = "目标检测图片宽度", DefaultValue = "1920")]
    public int DetectionWidth { get; set; } = 1920;
}