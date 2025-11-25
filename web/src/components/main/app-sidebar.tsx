'use client'

import { Camera as CameraIcon, LayoutDashboard, Search, Settings } from 'lucide-react'
import * as React from 'react'
import { useEffect, useState } from 'react'

import { Camera, SystemUser } from '@/api/generatedSchemas'
import { getCameras } from '@/app/[locale]/(main)/[camera]/camera'
import { CameraSearchDialog } from '@/components/main/camera-search-dialog'
import LanguageToggle from '@/components/main/language-toggle'
import { NavCameras } from '@/components/main/nav-cameras'
import { NavMain } from '@/components/main/nav-main'
import { NavUser } from '@/components/main/nav-user'
import { ThemeToggle } from '@/components/main/theme-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { openapi } from '@/lib/http'
import { tokenParse } from '@/lib/security'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export function AppSidebar({
  onAuthChecked,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onAuthChecked?: (authorized: boolean) => void
}) {
  const t = useTranslations('MainLayout')
  const router = useRouter()
  const locale = useLocale()
  const [user, setUser] = useState<SystemUser | undefined>(undefined)
  const [cameras, setCameras] = useState<Camera[] | undefined>([])
  const [searchOpen, setSearchOpen] = useState(false)

  // 更新公钥 JWT续期
  useEffect(() => {
    const getPublicKey = async () => {
      const { data } = await openapi.GET('/Authentication/GetKey', {
        parseAs: 'text',
      })
      if (data) localStorage.setItem('publicKey', data)
    }
    const renewToken = async () => {
      const payload = tokenParse()
      if (!payload) return
      const now = Date.now() / 1000
      // 检查是否可以续期(未过期且n小时内过期)
      if (payload.expire >= now && payload.expire - now < 2 * 60 * 60) {
        const { data } = await openapi.GET('/Authentication/RefreshToken', {
          parseAs: 'text',
        })
        if (data) localStorage.setItem('token', data)
      }
    }
    // 获取公钥并续期
    getPublicKey().then(() => renewToken().then())
  }, [])

  /* 侧边栏初始化 */
  useEffect(() => {
    const init = async () => {
      // 检查授权
      const { data, error } = await openapi.GET('/Authentication/Granted')
      if (error || !data) {
        onAuthChecked?.(false) // 通知未授权
        // 授权失败 → 跳转登录
        const currentPath = window.location.pathname + window.location.search
        router.replace(
          `/${locale}/login?redirect=${encodeURIComponent(currentPath)}`,
        )
        return // 停止执行
      }
      onAuthChecked?.(true) // 通知已授权
      // 用户信息
      const { data: userData } = await openapi.GET(
        '/Authentication/CurrentUser',
      )
      setUser(userData)
      // 摄像头
      const cameras = await getCameras()
      setCameras(cameras)
    }

    init().then()
  }, [locale, onAuthChecked, router])

  const navMain = [
    {
      title: t('navSearch'),
      icon: Search,
      onClick: () => setSearchOpen(true), // 点击打开弹窗
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
    <>
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
      {/* 搜索弹窗 */}
      {cameras && (
        <CameraSearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          cameras={cameras}
        />
      )}
    </>
  )
}
