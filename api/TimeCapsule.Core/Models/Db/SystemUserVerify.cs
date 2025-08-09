using System.ComponentModel;
using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "系统用户验证")]
public class SystemUserVerify
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "用户ID")]
    public long UserId { get; set; }

    [SugarColumn(ColumnDescription = "验证方式")]
    public UserVerifyType VerifyType { get; set; }

    [SugarColumn(ColumnDescription = "验证账号", DefaultValue = " ")]
    public string VerifyAccount { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "验证值")]
    public string VerifyValue { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "验证状态")]
    public bool IsVerified { get; set; }

    [SugarColumn(ColumnDescription = "创建时间")]
    public DateTime CreateTime { get; set; } = DateTime.Now;

    [SugarColumn(ColumnDescription = "过期时间")]
    public DateTime ExpireTime { get; set; } = DateTime.Now.AddMinutes(10);
}

/// <summary>
/// 验证方式
/// </summary>
public enum UserVerifyType
{
    [Description("邮箱")] Email,
}