'use client'

import {
  Camera as CameraIcon,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'

import { paths } from '@/api/schema'
import LanguageToggle from '@/components/main/language-toggle'
import { NavCameras } from '@/components/main/nav-cameras'
import { NavMain } from '@/components/main/nav-main'
import { NavUser } from '@/components/main/nav-user'
import { ThemeToggle } from '@/components/main/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { openapi } from '@/lib/http'
import { useLocale } from 'next-intl'
import Image from 'next/image'

type Camera =
  paths['/Camera/Query']['post']['responses']['200']['content']['application/json']

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale()
  const [cameras, setCameras] = useState<Camera | undefined>([])

  /* 加载摄像头列表 */
  useEffect(() => {
    const getCameras = async () => {
      const { data } = await openapi.POST('/Camera/Query', {
        body: { Page: 1, PageSize: 1000 },
      })
      setCameras(data)
    }
    getCameras().then()
  }, [])

  const data = {
    user: {
      name: 'shadcn',
      email: 'm@example.com',
      avatar: '/logo.png',
    },
    navMain: [
      {
        title: 'Search',
        url: '#',
        icon: Search,
      },
      {
        title: 'Dashboard',
        url: `/${locale}/dashboard`,
        icon: LayoutDashboard,
      },
      {
        title: 'Cameras',
        url: `/${locale}/cameras`,
        icon: CameraIcon,
      },
      {
        title: 'Settings',
        url: `/${locale}/settings`,
        icon: Settings,
      },
    ],
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="app logo"
            width={50}
            height={50}
            priority
          />
          <span className="truncate font-medium">Time Capsule</span>
        </div>
        <NavMain items={data.navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavCameras cameras={cameras ?? []} />
      </SidebarContent>
      <SidebarFooter>
        <div>
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
