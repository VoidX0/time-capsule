'use client'

import {
  Camera as CameraIcon,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'

import { components } from '@/api/schema'
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
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type SystemUser = components['schemas']['SystemUser']
type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations('MainLayout')
  const router = useRouter()
  const locale = useLocale()
  const [user, setUser] = useState<SystemUser | undefined>(undefined)
  const [cameras, setCameras] = useState<Camera[] | undefined>([])

  /* 侧边栏初始化 */
  useEffect(() => {
    const init = async () => {
      // 检查授权
      const { data, error } = await openapi.GET('/Authentication/Granted')
      if (error || !data) {
        // 授权失败 → 跳转登录
        const currentPath = window.location.pathname + window.location.search
        router.replace(
          `/${locale}/login?redirect=${encodeURIComponent(currentPath)}`,
        )
        return // 停止执行
      }
      // 用户信息
      const { data: userData } = await openapi.GET(
        '/Authentication/CurrentUser',
      )
      setUser(userData)
      // 摄像头
      const body: QueryDto = { PageNumber: 1, PageSize: 100 }
      const { data: camerasData } = await openapi.POST('/Camera/Query', {
        body,
      })
      setCameras(camerasData)
    }

    init().then()
  }, [locale, router])

  const navMain = [
    {
      title: t('navSearch'),
      url: '#',
      icon: Search,
    },
    {
      title: t('navDashboard'),
      url: `/${locale}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      title: t('cameras'),
      url: `/${locale}/cameras`,
      icon: CameraIcon,
    },
    {
      title: t('settings'),
      url: `/${locale}/settings`,
      icon: Settings,
    },
  ]

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
        <NavMain items={navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavCameras cameras={cameras ?? []} />
      </SidebarContent>
      <SidebarFooter>
        <div>
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
