import { i18n } from '@/lib/i18n'
import Link from 'next/link'
import { Dots } from '@/components/loader/dots'

export const generateStaticParams = () =>
  i18n.languages.map((lang) => ({ lang }))

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <main className="flex flex-1 flex-col justify-center text-center">
      <h1 className="mb-4 text-2xl font-bold">
        {process.env.NEXT_PUBLIC_PROJECT_NAME || ''}
      </h1>
      <p className="text-fd-muted-foreground">
        {lang === 'en'
          ? process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION_EN || ''
          : process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION_ZH || ''}
      </p>
      <Link
        href={`/${lang}/docs/started`}
        className="text-fd-foreground font-semibold underline"
        style={{
          position: 'absolute',
          bottom: '30%',
          left: '50%',
        }}
      >
        <Dots />
      </Link>
    </main>
  )
}
