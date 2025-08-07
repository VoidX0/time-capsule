using System.Security.Cryptography;

namespace TimeCapsule.Core.Utils.Security;

/// <summary>
/// Aes
/// </summary>
public static class SecurityAes
{
    static SecurityAes()
    {
        AesHandler = Aes.Create();
        InitAes();
    }

    private static Aes AesHandler { get; }

    /// <summary>
    /// 生成秘钥
    /// </summary>
    private static void InitAes()
    {
        AesHandler.GenerateKey();
        AesHandler.GenerateIV();
    }

    /// <summary>
    /// 使用现有秘钥覆盖生成秘钥
    /// </summary>
    /// <param name="key">密钥</param>
    /// <param name="iv">偏移</param>
    public static void InitAesByKey(string key, string iv)
    {
        AesHandler.Key = Convert.FromBase64String(key);
        AesHandler.IV = Convert.FromBase64String(iv);
    }

    /// <summary>
    /// AES加密
    /// </summary>
    /// <param name="source"></param>
    /// <returns></returns>
    public static string Encrypt(string source)
    {
        using var mem = new MemoryStream();
        using var stream = new CryptoStream(mem, AesHandler.CreateEncryptor(AesHandler.Key, AesHandler.IV),
            CryptoStreamMode.Write);
        using (var writer = new StreamWriter(stream))
        {
            writer.Write(source);
        }

        return Convert.ToBase64String(mem.ToArray());
    }

    /// <summary>
    /// AES解密
    /// </summary>
    /// <param name="source"></param>
    /// <returns></returns>
    public static string Decrypt(string source)
    {
        var data = Convert.FromBase64String(source);
        using var mem = new MemoryStream(data);
        using var crypto = new CryptoStream(mem, AesHandler.CreateDecryptor(AesHandler.Key, AesHandler.IV),
            CryptoStreamMode.Read);
        using var reader = new StreamReader(crypto);
        return reader.ReadToEnd();
    }
}