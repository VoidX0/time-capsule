'use client'
import { create } from '@orama/orama'
import { useDocsSearch } from 'fumadocs-core/search/client'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps
} from 'fumadocs-ui/components/dialog/search'
import { useI18n } from 'fumadocs-ui/contexts/i18n'
import { createTokenizer } from '@orama/tokenizers/mandarin'
import { useCallback } from 'react'

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n()
  // 获取环境变量中的 basePath (如果没有则为空字符串)
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

  const initOrama = useCallback(async () => {
    if (locale === 'zh') {
      // 中文环境
      return create({
        schema: { _: 'string' },
        components: {
          tokenizer: createTokenizer(), // 使用中文分词器
        },
      })
    }

    // 英文环境保持默认
    return create({
      schema: { _: 'string' },
      language: 'english',
    })
  }, [locale])

  const { search, setSearch, query } = useDocsSearch({
    type: 'static',
    initOrama,
    locale,
    from: `${basePath}/api/search`, // 兼容子目录部署
  })

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  )
}
