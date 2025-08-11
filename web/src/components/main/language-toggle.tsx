'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { routing } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { MdOutlineTranslate } from 'react-icons/md'
import { RiEnglishInput } from 'react-icons/ri'

export default function LanguageToggle() {
  const locales = routing.locales as unknown as string[]
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
        {locales.map((lang) => (
          <a key={lang} href={pathname.replace(/^\/[^/]+/, `/${lang}`)}>
            <DropdownMenuItem>{t(`${lang}`)}</DropdownMenuItem>
          </a>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
