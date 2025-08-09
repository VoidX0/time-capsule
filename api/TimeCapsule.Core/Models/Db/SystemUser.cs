using SqlSugar;

namespace TimeCapsule.Core.Models.Db;

[SugarTable(TableDescription = "系统用户")]
public class SystemUser
{
    [SugarColumn(ColumnDescription = "ID", IsPrimaryKey = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnDescription = "邮箱")]
    public string Email { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "昵称")]
    public string NickName { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "密码")]
    public string Password { get; set; } = string.Empty;

    [SugarColumn(ColumnDescription = "角色", IsJson = true, DefaultValue = "cast('[]' as json)")]
    public List<long> Role { get; set; } = [];
}