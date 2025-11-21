import type { paths } from '@/api/schema'
import createClient, { type Middleware } from 'openapi-fetch'
import { toast } from 'sonner'

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
}

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return response
    // 处理错误响应
    const clone = response.clone() // 克隆响应以便读取内容
    let message = await clone.text()
    if (message.length == 0) message = clone.statusText
    // 尝试解析为 JSON
    try {
      const data = JSON.parse(message)
      if (data && data.title) {
        message = data.title
      }
    } catch {
      // 不是 JSON，忽略
    }
    toast.warning(message)
    // 返回原始响应
    return response
  },
}

/* openapi-fetch客户端 */
export const openapi = createClient<paths>({ baseUrl: '/api' })
openapi.use(authMiddleware) // 身份验证中间件
openapi.use(errorMiddleware) // 错误处理中间件
