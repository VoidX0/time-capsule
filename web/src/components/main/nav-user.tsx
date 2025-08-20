'use client'

import { BadgeCheck, Bell, ChevronsUpDown, CircleFadingArrowUp, LogOut } from 'lucide-react'

import { components } from '@/api/schema'
import { UserProfileDialog } from '@/components/main/user-profile-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type SystemUser = components['schemas']['SystemUser']
export function NavUser({ user }: { user: SystemUser | undefined }) {
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
                <DropdownMenuItem>
                  <CircleFadingArrowUp />
                  Ver {process.env.NEXT_PUBLIC_VERSION}
                </DropdownMenuItem>
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
