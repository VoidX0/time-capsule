'use client'

import { AppSidebar } from '@/components/main/app-sidebar'
import AppSidebarProvider from '@/components/main/app-sidebar-provider'
import MainBreadcrumb from '@/components/main/main-breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useCallback, useState } from 'react'

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const handleAuthChecked = useCallback((authorized: boolean) => {
    setAuthorized(authorized)
  }, [])
  return (
    <AppSidebarProvider>
      <AppSidebar onAuthChecked={handleAuthChecked} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <MainBreadcrumb />
          </div>
        </header>
        {authorized === true && children}
      </SidebarInset>
    </AppSidebarProvider>
  )
}
