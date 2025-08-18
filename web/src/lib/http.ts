import type { paths } from '@/api/schema'
import createClient, { type Middleware } from 'openapi-fetch'

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
}
/* openapi-fetch客户端 */
export const openapi = createClient<paths>({ baseUrl: '/api' })
openapi.use(authMiddleware) // 身份验证中间件
