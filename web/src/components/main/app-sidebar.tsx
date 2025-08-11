'use client'

import { Camera, LayoutDashboard, Search, Settings } from 'lucide-react'
import * as React from 'react'

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
import { useLocale } from 'next-intl'
import Image from 'next/image'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale()
  const data = {
    user: {
      name: 'shadcn',
      email: 'm@example.com',
      avatar: '/avatars/shadcn.jpg',
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
        title: 'Settings',
        url: `/${locale}/settings`,
        icon: Settings,
      },
    ],
    cameras: [
      {
        name: 'Camera',
        id: '1155667788',
        icon: Camera,
      },
      {
        name: 'Camera 2',
        id: '1952625044269490178',
        icon: Camera,
      },
      {
        name: 'Camera 3',
        id: '1952625044269490179',
        icon: Camera,
      },
      {
        name: 'Camera 4',
        id: '1952625044269490180',
        icon: Camera,
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
        <NavCameras cameras={data.cameras} />
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
