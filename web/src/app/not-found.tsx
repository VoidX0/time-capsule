'use client'

import { DotPattern } from '@/components/magicui/dot-pattern'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import './globals.css'

export default function NotFound() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="bg-background flex min-h-screen items-center justify-center">
        <DotPattern
          className={cn(
            '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]',
          )}
        />
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">404</h1>
          <p className="mb-6">This page could not be found.</p>
          <Link
            href="/"
            className="hover:bg-accent inline-block rounded-lg border px-4 py-2 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </ThemeProvider>
  )
}
