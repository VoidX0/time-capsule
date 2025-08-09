'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { routing } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { MdOutlineTranslate } from 'react-icons/md'

export default function LanguageToggle() {
  const locales = routing.locales as unknown as string[]
  const pathname = usePathname()
  const t = useTranslations('Locales')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <MdOutlineTranslate />
          {t('current')}
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
