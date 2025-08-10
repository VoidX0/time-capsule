using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SqlSugar;
using TimeCapsule.Core.Models.Db;

namespace TimeCapsule.Models.Options;

/// <summary>
/// Token配置
/// </summary>
public class TokenOptions
{
    /// <summary>
    /// AES密钥
    /// </summary>
    public string? AesKey { get; set; }

    /// <summary>
    /// AES偏移
    /// </summary>
    public string? AesIv { get; set; }

    /// <summary>
    /// Secret
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    /// <summary>
    /// 发布
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// 订阅
    /// </summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// 过期时间(小时)
    /// </summary>
    public int AccessExpiration { get; set; }

    /// <summary>
    /// 为用户生成Token
    /// </summary>
    /// <param name="user">用户</param>
    /// <param name="db">DB</param>
    /// <returns></returns>
    public async Task<string> GenerateToken(SystemUser user, ISqlSugarClient db)
    {
        await Task.CompletedTask;
        //创建claim
        var claims = new List<Claim>
        {
            new(ClaimTypes.PrimarySid, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.NickName)
        };
        claims.AddRange(user.Role.Select(x => new Claim(ClaimTypes.Role, x.ToString())));
        //生成token
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var jwtToken = new JwtSecurityToken(Issuer, Audience, claims,
            expires: DateTimeOffset.Now.AddHours(AccessExpiration).DateTime,
            signingCredentials: credentials);
        var token = new JwtSecurityTokenHandler().WriteToken(jwtToken);
        return token;
    }
}