using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using TimeCapsule.Core.Models.Db;

namespace TimeCapsule.Utils.Extension;

/// <summary>
/// Claims扩展
/// </summary>
public static class ClaimsExtension
{
    /// <summary>
    /// 获取JWT中信息
    /// </summary>
    /// <param name="claims"></param>
    /// <returns>用户信息</returns>
    public static SystemUser? Parsing(this IEnumerable<Claim> claims)
    {
        var claimsList = claims.ToList();
        //判断是否过期
        var expire = claimsList.FirstOrDefault(x => x.Type == JwtRegisteredClaimNames.Exp)?.Value;
        if (string.IsNullOrWhiteSpace(expire) || !long.TryParse(expire, out var expireTime) ||
            expireTime < DateTimeOffset.Now.ToUnixTimeSeconds())
            return null;
        //解析JWT中的信息
        var user = new SystemUser();
        foreach (var claim in claimsList)
        {
            switch (claim.Type)
            {
                case ClaimTypes.PrimarySid:
                    user.Id = long.TryParse(claim.Value, out var id) ? id : 0;
                    break;
                case ClaimTypes.Email:
                    user.Email = claim.Value;
                    break;
                case ClaimTypes.Name:
                    user.NickName = claim.Value;
                    break;
                case ClaimTypes.Role:
                    if (long.TryParse(claim.Value, out var roleId))
                        user.Role.Add(roleId);
                    break;
            }
        }

        return user;
    }
}