'use client'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavMain({
  items,
}: {
  items: {
    title: string
    url?: string
    icon: LucideIcon
    onClick?: () => void
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          {item.onClick ? (
            <SidebarMenuButton asChild onClick={item.onClick}>
              <a className="flex items-center gap-2">
                <item.icon />
                <span>{item.title}</span>
              </a>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton asChild isActive={pathname === item.url}>
              <Link href={item.url ?? '#'} className="flex items-center gap-2">
                <item.icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
