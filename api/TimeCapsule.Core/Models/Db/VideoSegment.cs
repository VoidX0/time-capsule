using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SplitTable(SplitType.Month)]
[SugarIndex("index_start_time", nameof(StartTime), OrderByType.Desc)]
[SugarTable("video_segment_{year}{month}{day}", TableDescription = "视频片段")]
public class VideoSegment
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "摄像头ID")]
    public long CameraId { get; set; }

    [SugarColumn(ColumnDescription = "同步时间")]
    public DateTimeOffset SyncTime { get; set; } = DateTimeOffset.Now;

    [SugarColumn(ColumnDescription = "文件路径")]
    public string Path { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "文件大小(MB)")]
    public decimal Size { get; set; }

    [SugarColumn(ColumnDescription = "录制开始时间")]
    [SplitField]
    public DateTimeOffset StartTime { get; set; }

    [SugarColumn(ColumnDescription = "录制结束时间")]
    public DateTimeOffset EndTime { get; set; }

    [SugarColumn(ColumnDataType = "interval", ColumnDescription = "实际录制时长")]
    public TimeSpan DurationActual { get; set; }

    [SugarColumn(ColumnDataType = "interval", ColumnDescription = "理论录制时长")]
    public TimeSpan DurationTheoretical { get; set; }

    [SugarColumn(ColumnDescription = "视频编码器")]
    public string VideoCodec { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "视频宽度")]
    public int VideoWidth { get; set; }

    [SugarColumn(ColumnDescription = "视频高度")]
    public int VideoHeight { get; set; }

    [SugarColumn(ColumnDescription = "视频帧率(fps)")]
    public decimal VideoFps { get; set; }

    [SugarColumn(ColumnDescription = "视频比特率(Kbps)")]
    public decimal VideoBitrate { get; set; }

    [SugarColumn(ColumnDescription = "音频编码器")]
    public string AudioCodec { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "音频采样率(Hz)")]
    public decimal AudioSampleRate { get; set; }

    [SugarColumn(ColumnDescription = "音频声道数")]
    public int AudioChannels { get; set; }

    [SugarColumn(ColumnDescription = "音频比特率(Kbps)")]
    public decimal AudioBitrate { get; set; }
}