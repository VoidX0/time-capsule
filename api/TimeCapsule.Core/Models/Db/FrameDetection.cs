using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SplitTable(SplitType.Month)]
[SugarIndex("index_frame_time", nameof(FrameTime), OrderByType.Desc)]
[SugarTable("frame_detection_{year}{month}{day}", TableDescription = "帧目标检测")]
public class FrameDetection
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "摄像头ID", DefaultValue = "0")]
    public long CameraId { get; set; }

    [SugarColumn(ColumnDescription = "视频片段ID")]
    public long SegmentId { get; set; }

    [SugarColumn(ColumnDescription = "帧时间")]
    public DateTimeOffset FrameTime { get; set; }

    [SugarColumn(ColumnDescription = "目标ID")]
    public int TargetId { get; set; }

    [SugarColumn(ColumnDescription = "目标名称")]
    public string TargetName { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "目标置信度")]
    public decimal TargetConfidence { get; set; }

    [SugarColumn(ColumnDescription = "目标坐标X")]
    public int TargetLocationX { get; set; }

    [SugarColumn(ColumnDescription = "目标坐标Y")]
    public int TargetLocationY { get; set; }

    [SugarColumn(ColumnDescription = "目标宽度")]
    public int TargetSizeWidth { get; set; }

    [SugarColumn(ColumnDescription = "目标高度")]
    public int TargetSizeHeight { get; set; }
}