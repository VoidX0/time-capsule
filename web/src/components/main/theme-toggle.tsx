'use client'

import { Moon, Sun, TvMinimal } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { flushSync } from 'react-dom'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations('Common')
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const changeTheme = async (newTheme: 'dark' | 'light' | 'system') => {
    if (!buttonRef.current) return

    await document.startViewTransition(() => {
      flushSync(() => {
        setTheme(newTheme)
      })
    }).ready

    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect()
    const y = top + height / 2
    const x = left + width / 2

    const right = window.innerWidth - left
    const bottom = window.innerHeight - top
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom))

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 700,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      },
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={buttonRef} variant="outline" size="icon" className="mr-2">
          {theme === 'dark' ? (
            <Moon />
          ) : theme === 'light' ? (
            <Sun />
          ) : (
            <TvMinimal />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeTheme('light')}>
          <Sun />
          {t('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('dark')}>
          <Moon />
          {t('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('system')}>
          <TvMinimal />
          {t('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
