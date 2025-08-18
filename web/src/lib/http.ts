import type { paths } from '@/api/schema'
import createClient from 'openapi-fetch'

/* openapi-fetch客户端 */
export const openapi = createClient<paths>({ baseUrl: '/api' })
