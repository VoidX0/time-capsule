import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // 仅匹配国际化路径名
  matcher: ['/', '/(zh|en)/:path*'],
}
