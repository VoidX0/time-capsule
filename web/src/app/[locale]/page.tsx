'use client'

import { BoxReveal } from '@/components/magicui/box-reveal'
import { RainbowButton } from '@/components/magicui/rainbow-button'
import { SparklesText } from '@/components/magicui/sparkles-text'
import { LayoutDashboard } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { LuGithub } from 'react-icons/lu'
import { MdOutlineDocumentScanner } from 'react-icons/md'

export default function Home() {
  const locale = useLocale()
  const t = useTranslations('HomePage')

  /* GitHub Pages 链接 */
  const githubPages = (repository: string): string => {
    const repoMatch = repository.match(/^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+)$/)
    if (!repoMatch) {
      return '#'
    }
    const owner = repoMatch[2]
    const repo = repoMatch[3]
    return `https://${owner}.github.io/${repo}/${locale}/`
  }

  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        <div>
          <SparklesText className="text-primary max-w-[600px] text-center text-4xl font-bold sm:text-left">
            Time capsule
          </SparklesText>
          <p className="text-muted-foreground max-w-[600px] text-center text-lg sm:text-left">
            {t('description')}
          </p>
        </div>
        <Image
          src="/logo.png"
          alt="app logo"
          width={100}
          height={100}
          priority
        />
        <ol className="list-inside list-decimal text-center font-mono text-sm/6 sm:text-left">
          <BoxReveal boxColor={'currentColor'} duration={0.5}>
            <li className="tracking-[-.01em]">{t('details01')}</li>
          </BoxReveal>
          <BoxReveal boxColor={'currentColor'} duration={0.5}>
            <li className="tracking-[-.01em]">{t('details02')}</li>
          </BoxReveal>
          <BoxReveal boxColor={'currentColor'} duration={0.5}>
            <li className="tracking-[-.01em]"> {t('details03')}</li>
          </BoxReveal>
          <BoxReveal boxColor={'currentColor'} duration={0.5}>
            <li className="tracking-[-.01em]"> {t('details04')}</li>
          </BoxReveal>
        </ol>
        <Link href={`/${locale}/dashboard`} rel="noopener noreferrer">
          <RainbowButton className="h-10 rounded-full">
            Dashboard
            <LayoutDashboard />
          </RainbowButton>
        </Link>
      </main>
      <footer className="row-start-3 flex flex-wrap items-center justify-center gap-[24px]">
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href={process.env.NEXT_PUBLIC_REPOSITORY ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <LuGithub />
          {t('github')}
        </Link>
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href={
            githubPages(
              process.env.NEXT_PUBLIC_REPOSITORY ?? 'https://github.com',
            ) ?? '#'
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          <MdOutlineDocumentScanner />
          {t('docs')}
        </Link>
      </footer>
    </div>
  )
}
