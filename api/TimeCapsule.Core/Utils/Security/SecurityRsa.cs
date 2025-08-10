using System.Security.Cryptography;
using System.Text;
using XC.RSAUtil;

namespace TimeCapsule.Core.Utils.Security;

/// <summary>
/// Rsa
/// </summary>
public static class SecurityRsa
{
    public static RSAParameters PublicKey { get; private set; }
    public static string PublicKeyString { get; private set; } = string.Empty;
    public static RSAParameters PrivateKey { get; private set; }
    public static string PrivateKeyString { get; private set; } = string.Empty;

    static SecurityRsa()
    {
        InitRsa();
    }

    /// <summary>
    /// 生成秘钥
    /// </summary>
    private static void InitRsa()
    {
        var handle = RSA.Create();
        PublicKey = handle.ExportParameters(false);
        PrivateKey = handle.ExportParameters(true);

        PublicKeyString = RsaKeyConvert.PublicKeyXmlToPem(
            handle.ToXmlString(false));
        PrivateKeyString = RsaKeyConvert.PrivateKeyXmlToPkcs1(
            handle.ToXmlString(true));
    }

    /// <summary>
    /// 使用现有秘钥覆盖生成秘钥
    /// </summary>
    /// <param name="publicKey">公钥</param>
    /// <param name="privateKey">私钥</param>
    public static void InitRsaByKey(string publicKey, string privateKey)
    {
        PublicKeyString = string.IsNullOrEmpty(publicKey) ? PublicKeyString : publicKey;
        PrivateKeyString = string.IsNullOrEmpty(privateKey) ? PrivateKeyString : privateKey;

        ImportKeyPair(RsaKeyConvert.PublicKeyPemToXml(PublicKeyString),
            RsaKeyConvert.PrivateKeyPkcs1ToXml(PrivateKeyString));
    }

    /// <summary>
    /// 导入秘钥
    /// </summary>
    /// <param name="publicKeyXmlString"></param>
    /// <param name="privateKeyXmlString"></param>
    private static void ImportKeyPair(string publicKeyXmlString, string privateKeyXmlString)
    {
        var handle = new RSACryptoServiceProvider();
        handle.FromXmlString(privateKeyXmlString);
        PrivateKey = handle.ExportParameters(true);
        handle.FromXmlString(publicKeyXmlString);
        PublicKey = handle.ExportParameters(false);
    }

    /// <summary>
    /// 加密
    /// </summary>
    /// <param name="dataToEncrypt"></param>
    /// <returns></returns>
    public static string Encrypt(string dataToEncrypt)
    {
        try
        {
            using var rsa = new RSACryptoServiceProvider();
            rsa.ImportParameters(PublicKey);
            var encryptedData = rsa.Encrypt(
                Encoding.Default.GetBytes(dataToEncrypt), false);
            return Convert.ToBase64String(encryptedData);
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>
    /// 解密
    /// </summary>
    /// <param name="dataToDecrypt"></param>
    /// <returns></returns>
    public static string Decrypt(string dataToDecrypt)
    {
        try
        {
            using var rsa = new RSACryptoServiceProvider();
            rsa.ImportParameters(PrivateKey);
            var decryptedData = rsa.Decrypt(
                Convert.FromBase64String(dataToDecrypt), false);
            return Encoding.Default.GetString(decryptedData);
        }
        catch
        {
            return string.Empty;
        }
    }
}