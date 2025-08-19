import { JSEncrypt } from 'jsencrypt'

export function rsaEncrypt(data: string): string | false {
  if (typeof window === 'undefined') {
    console.error('rsaEncrypt can only be used in the browser')
    return false
  }
  // 获取公钥
  const publicKey = localStorage.getItem('publicKey')
  if (!publicKey) return false
  // 使用公钥加密数据
  const jse = new JSEncrypt()
  jse.setPublicKey(publicKey)
  return jse.encrypt(data)
}
