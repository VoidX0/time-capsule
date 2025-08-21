import { docs } from '@/.source'
import { i18n } from '@/lib/i18n'
import { loader } from 'fumadocs-core/source'
import { attachFile, createOpenAPI } from 'fumadocs-openapi/server'

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  i18n,
  // it assigns a URL to your pages
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  pageTree: {
    attachFile,
  },
})

export const openapi = createOpenAPI({
  // options
})
