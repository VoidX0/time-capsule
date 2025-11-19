'use client'

import {
  Camera as CameraIcon,
  Clapperboard,
  MonitorPlay,
  MoreHorizontal,
} from 'lucide-react'

import { components } from '@/api/schema'
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
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Camera = components['schemas']['Camera']

export function NavCameras({ cameras }: { cameras: Camera[] }) {
  const t = useTranslations('MainLayout')
  const { isMobile } = useSidebar()
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t('cameras')}</SidebarGroupLabel>
      <SidebarMenu>
        {cameras.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={pathname.includes(item.id?.toString() ?? '')}
            >
              <Link
                href={`/${locale}/${item.id}/dashboard`}
                className="flex items-center gap-2"
              >
                <CameraIcon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <Link href={`/${locale}/${item.id}/segments`}>
                  <DropdownMenuItem>
                    <Clapperboard className="text-muted-foreground" />
                    <span>{t('segments')}</span>
                  </DropdownMenuItem>
                </Link>
                <Link href={`/${locale}/${item.id}/playback`}>
                  <DropdownMenuItem>
                    <MonitorPlay className="text-muted-foreground" />
                    <span>{t('playback')}</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href={`/${locale}/${item.id}/detections`}>
                  <DropdownMenuItem>
                    <MonitorPlay className="text-muted-foreground" />
                    <span>{t('detections')}</span>
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
