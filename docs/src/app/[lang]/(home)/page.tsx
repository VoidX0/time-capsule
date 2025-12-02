import { i18n } from '@/lib/i18n'
import Link from 'next/link'
import { Ball } from '@/components/loader/ball'
import { GradientTitle } from '@/components/loader/gradient-title'

export const generateStaticParams = () =>
  i18n.languages.map((lang) => ({ lang }))

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center">
      <GradientTitle>
        {process.env.NEXT_PUBLIC_PROJECT_NAME?.toUpperCase() || ''}
      </GradientTitle>
      <p className="text-fd-muted-foreground">
        {lang === 'en'
          ? process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION_EN || ''
          : process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION_ZH || ''}
      </p>
      <Link
        href={`/${lang}/docs/started`}
        className="text-fd-foreground font-semibold underline"
      >
        <Ball />
      </Link>
    </main>
  )
}
