import type { paths } from '@/api/schema'
import createClient from 'openapi-fetch'

/* openapi-fetch客户端 */
export const openapi = createClient<paths>({
  baseUrl: '/api',
  headers: {
    Authorization:
      typeof window !== 'undefined' && localStorage.getItem('token')
        ? `Bearer ${localStorage.getItem('token')}`
        : undefined,
  },
})
