import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// I18N 配置
const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  output: 'standalone', // 开启独立打包模式
  // api路由代理
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/:path*', // 代理到本地开发服务器
      },
    ]
  },
}

export default withNextIntl(nextConfig)
