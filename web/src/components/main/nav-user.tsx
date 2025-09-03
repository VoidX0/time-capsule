'use client'

import { BadgeCheck, Bell, ChevronsUpDown, CircleFadingArrowUp, LogOut } from 'lucide-react'

import { components } from '@/api/schema'
import { UserProfileDialog } from '@/components/main/user-profile-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type SystemUser = components['schemas']['SystemUser']
export function NavUser({ user }: { user: SystemUser | undefined }) {
  const locale = useLocale()
  const t = useTranslations('MainLayout')
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false) // 用户信息弹框

  /* 用户登出 */
  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', '')
    }
    router.replace('/')
  }

  /* GitHub Pages Changelog 链接 */
  const githubPagesChangelog = (
    repository: string,
    version: string,
  ): string => {
    const repoMatch = repository.match(/^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+)$/)
    if (!repoMatch) {
      return '#'
    }
    const owner = repoMatch[2]
    const repo = repoMatch[3]
    return `https://${owner}.github.io/${repo}/${locale}/docs/contribute/changelog#${version}`
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-full">
                  {user && (
                    <AvatarImage
                      src={`/api/Authentication/GetAvatar?id=${user?.Id?.toString()}&token=${encodeURIComponent(rsaEncrypt(Date.now().toString()))}`}
                      alt={user?.NickName ?? ''}
                    />
                  )}
                  <AvatarFallback className="rounded-full">
                    {(user?.NickName?.length ?? -1) > 0
                      ? user?.NickName![0]!.toUpperCase()
                      : ' '}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.NickName}</span>
                  <span className="truncate text-xs">{user?.Email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-full">
                    <AvatarImage
                      src={`/api/Authentication/GetAvatar?id=${user?.Id?.toString()}&token=${encodeURIComponent(rsaEncrypt(Date.now().toString()))}`}
                      alt={user?.NickName ?? ''}
                    />
                    <AvatarFallback className="rounded-full">
                      {(user?.NickName?.length ?? -1) > 0
                        ? user?.NickName![0]!.toUpperCase()
                        : ' '}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.NickName}
                    </span>
                    <span className="truncate text-xs">{user?.Email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                  <BadgeCheck />
                  {t('account')}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell />
                  {t('notifications')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link
                  href={githubPagesChangelog(
                    process.env.NEXT_PUBLIC_REPOSITORY ?? 'https://github.com',
                    process.env.NEXT_PUBLIC_VERSION ?? '0.0.1',
                  )}
                  target="_blank"
                >
                  <DropdownMenuItem>
                    <CircleFadingArrowUp />
                    Ver {process.env.NEXT_PUBLIC_VERSION}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {/*用户信息弹框*/}
      <UserProfileDialog
        user={user}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={async (updatedUser) => {
          await openapi.PUT('/Authentication/ModifyUser', { body: updatedUser })
        }}
      />
    </>
  )
}
