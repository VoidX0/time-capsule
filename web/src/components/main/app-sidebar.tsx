'use client'

import { Frame, LayoutDashboard, Map, PieChart, Search, Settings } from 'lucide-react'
import * as React from 'react'

import LanguageToggle from '@/components/main/language-toggle'
import { NavMain } from '@/components/main/nav-main'
import { NavProjects } from '@/components/main/nav-projects'
import { NavUser } from '@/components/main/nav-user'
import { ThemeToggle } from '@/components/main/theme-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const locale = useLocale()
  const pathname = usePathname()
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
        isActive: pathname === `/${locale}/dashboard`,
      },
      {
        title: 'Settings',
        url: `/${locale}/settings`,
        icon: Settings,
        isActive: pathname === `/${locale}/settings`,
      },
    ],
    projects: [
      {
        name: 'Design Engineering',
        url: '#',
        icon: Frame,
      },
      {
        name: 'Sales & Marketing',
        url: '#',
        icon: PieChart,
      },
      {
        name: 'Travel',
        url: '#',
        icon: Map,
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
        <NavProjects projects={data.projects} />
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
