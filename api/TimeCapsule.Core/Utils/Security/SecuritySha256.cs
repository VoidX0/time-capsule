using System.Security.Cryptography;
using System.Text;

namespace TimeCapsule.Core.Utils.Security;

/// <summary>
/// SHA256
/// </summary>
public static class SecuritySha256
{
    /// <summary>
    /// 加密
    /// </summary>
    /// <param name="input"></param>
    /// <returns></returns>
    public static string Encrypt(string input)
    {
        var inputBytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = SHA256.HashData(inputBytes);

        // 将字节数组转换为十六进制字符串
        var sb = new StringBuilder();
        foreach (var b in hashBytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}