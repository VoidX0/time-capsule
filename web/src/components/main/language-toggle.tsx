'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MdOutlineTranslate } from 'react-icons/md'
import { RiEnglishInput } from 'react-icons/ri'

export default function LanguageToggle() {
  const locale = useLocale()
  const pathname = usePathname()
  const t = useTranslations('Locales')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="mr-2">
          {locale === 'en' ? <RiEnglishInput /> : <MdOutlineTranslate />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link href={pathname.replace(/^\/[^/]+/, '/zh')}>
          <DropdownMenuItem>{t('zh')}</DropdownMenuItem>
        </Link>
        <Link href={pathname.replace(/^\/[^/]+/, '/en')}>
          <DropdownMenuItem>{t('en')}</DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
