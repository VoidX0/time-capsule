'use client'

import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { IconContext } from 'react-icons'
import { LuGithub, LuLogIn } from 'react-icons/lu'

export default function Home() {
  const locale = useLocale()
  const t = useTranslations('HomePage')
  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        <div>
          <h1 className="max-w-[600px] text-center text-4xl font-bold sm:text-left">
            <span className="text-primary">Time capsule</span>{' '}
          </h1>
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
          <li className="tracking-[-.01em]">{t('details01')}</li>
          <li className="tracking-[-.01em]">{t('details02')}</li>
          <li className="tracking-[-.01em]"> {t('details03')}</li>
        </ol>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            className="bg-foreground text-background flex h-10 items-center justify-center gap-2 rounded-full border border-solid border-transparent px-4 text-sm font-medium transition-colors hover:bg-[#383838] sm:h-12 sm:w-auto sm:px-5 sm:text-base dark:hover:bg-[#ccc]"
            href={`/${locale}/login`}
            rel="noopener noreferrer"
          >
            {t('login')}
            <IconContext.Provider value={{ size: '2em' }}>
              <LuLogIn />
            </IconContext.Provider>
          </Link>
        </div>
      </main>
      <footer className="row-start-3 flex flex-wrap items-center justify-center gap-[24px]">
        <Link
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://github.com/VoidX0/time-capsule"
          target="_blank"
          rel="noopener noreferrer"
        >
          <LuGithub />
          {t('github')}
        </Link>
      </footer>
    </div>
  )
}
