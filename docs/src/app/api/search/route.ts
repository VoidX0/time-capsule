import { source } from '@/lib/source'
import { createTokenizer } from '@orama/tokenizers/mandarin'
import { createFromSource } from 'fumadocs-core/search/server'

// it should be cached forever
export const revalidate = false

export const { staticGET: GET } = createFromSource(source, {
  localeMap: {
    // you can customise search configs for specific locales, like:
    // [locale]: Orama options

    zh: {
      components: {
        tokenizer: createTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },
  },
})
