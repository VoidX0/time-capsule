import { createNavigation } from 'next-intl/navigation'
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'zh'], // 支持的语言列表
  defaultLocale: 'zh', // 默认语言
})

// 围绕 Next.js 的导航 API 的轻量级包装器
// 考虑路由配置
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing)
