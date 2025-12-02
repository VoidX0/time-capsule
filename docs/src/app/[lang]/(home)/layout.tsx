import { baseOptions } from '@/app/[lang]/layout.config'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import type { ReactNode } from 'react'
import { LuGithub } from 'react-icons/lu'

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>
  children: ReactNode
}) {
  const { lang } = await params
  return (
    <HomeLayout
      {...baseOptions(lang)}
      links={[
        {
          text: (
            <span className="flex items-center gap-1">
              <LuGithub className="h-4 w-4" />
              GitHub
            </span>
          ),
          url: process.env.NEXT_PUBLIC_PROJECT_REPO || '',
        },
      ]}
    >
      {children}
    </HomeLayout>
  )
}
