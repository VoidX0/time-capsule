'use client'

import {
  Gauge,
  type LucideIcon,
  MonitorCog,
  MonitorPlay,
  MoreHorizontal,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavCameras({
  cameras,
}: {
  cameras: {
    name: string
    id: string
    icon: LucideIcon
  }[]
}) {
  const { isMobile } = useSidebar()
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Cameras</SidebarGroupLabel>
      <SidebarMenu>
        {cameras.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild isActive={pathname.includes(item.id)}>
              <Link
                href={`/${locale}/${item.id}/dashboard`}
                className="flex items-center gap-2"
              >
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <Link href={`/${locale}/${item.id}/dashboard`}>
                  <DropdownMenuItem>
                    <Gauge className="text-muted-foreground" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                </Link>
                <Link href={`/${locale}/${item.id}/playback`}>
                  <DropdownMenuItem>
                    <MonitorPlay className="text-muted-foreground" />
                    <span>Playback</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href={`/${locale}/${item.id}/manage`}>
                  <DropdownMenuItem>
                    <MonitorCog className="text-muted-foreground" />
                    <span>Manage</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
