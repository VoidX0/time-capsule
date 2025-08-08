import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// I18N 配置
const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  output: 'standalone', // 开启独立打包模式
}

export default withNextIntl(nextConfig)
