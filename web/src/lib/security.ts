import { JSEncrypt } from 'jsencrypt'
import { jwtDecode, JwtPayload } from 'jwt-decode'

/**
 * 使用 RSA 公钥加密数据
 * @param data
 */
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

/**
 * 自定义的 JWT 载荷
 */
interface CustomJwtPayload extends JwtPayload {
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/primarysid'?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?:
    | string
    | string[]
}

/**
 * Token载荷
 */
export class TokenPayload {
  id: string = ''
  email: string = ''
  nickName: string = ''
  expire: number = 0
  role: string[] = []
}

/**
 * 解析token
 */
export function tokenParse(): TokenPayload | null {
  if (typeof window === 'undefined') {
    console.error('tokenParse can only be used in the browser')
    return null
  }
  const token = localStorage.getItem('token')
  if (!token) return null
  const payload: CustomJwtPayload = jwtDecode(token)
  const id =
    payload[
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/primarysid'
    ]
  const email =
    payload[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    ]
  const name =
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
  const role =
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  if (id == null || email == null || name == null || payload.exp == null) {
    return null
  }
  //Token信息
  const result = new TokenPayload()
  result.id = id
  result.email = email
  result.nickName = name
  result.expire = payload.exp
  switch (typeof role) {
    case 'undefined':
      result.role = []
      break
    case 'string':
      result.role = [role]
      break
    case 'object':
      result.role = []
      for (let i = 0; i < role.length; i++) {
        result.role.push(role[i] ?? '')
      }
      break
  }
  return result
}
