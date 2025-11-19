import { docs } from 'fumadocs-mdx:collections/server'
import { loader } from 'fumadocs-core/source'
import { i18n } from '@/lib/i18n'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons' // See https://fumadocs.dev/docs/headless/source-api for more info

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  i18n,
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
})
