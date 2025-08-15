'use client'

import { Camera as CameraIcon, Clapperboard, Gauge, MonitorCog, MonitorPlay, MoreHorizontal } from 'lucide-react'

import { components } from '@/api/schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Camera = components['schemas']['Camera']

export function NavCameras({ cameras }: { cameras: Camera[] }) {
  const { isMobile } = useSidebar()
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Cameras</SidebarGroupLabel>
      <SidebarMenu>
        {cameras.map((item) => (
          <SidebarMenuItem key={item.Id}>
            <SidebarMenuButton
              asChild
              isActive={pathname.includes(item.Id?.toString() ?? '')}
            >
              <Link
                href={`/${locale}/${item.Id}/dashboard`}
                className="flex items-center gap-2"
              >
                <CameraIcon />
                <span>{item.Name}</span>
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
                <Link href={`/${locale}/${item.Id}/dashboard`}>
                  <DropdownMenuItem>
                    <Gauge className="text-muted-foreground" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                </Link>
                <Link href={`/${locale}/${item.Id}/segments`}>
                  <DropdownMenuItem>
                    <Clapperboard className="text-muted-foreground" />
                    <span>Segments</span>
                  </DropdownMenuItem>
                </Link>
                <Link href={`/${locale}/${item.Id}/playback`}>
                  <DropdownMenuItem>
                    <MonitorPlay className="text-muted-foreground" />
                    <span>Playback</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href={`/${locale}/${item.Id}/settings`}>
                  <DropdownMenuItem>
                    <MonitorCog className="text-muted-foreground" />
                    <span>Settings</span>
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
