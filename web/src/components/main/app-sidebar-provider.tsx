'use client'

import { SidebarProvider } from '@/components/ui/sidebar'
import * as React from 'react'
import { useEffect, useState } from 'react'

export default function AppSidebarProvider({
  children,
}: React.ComponentProps<'div'>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  /* 初始化侧边栏状态 */
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Check localStorage for sidebar state
    const savedState = localStorage.getItem('sidebarOpen')
    if (savedState) {
      setSidebarOpen(JSON.parse(savedState))
    }
  }, [])

  /* 存储侧边栏状态 */
  const saveSidebarState = (open: boolean) => {
    if (typeof window === 'undefined') return
    // Save the sidebar state to localStorage
    localStorage.setItem('sidebarOpen', JSON.stringify(open))
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={(x) => {
        setSidebarOpen(x)
        saveSidebarState(x)
      }}
    >
      {children}
    </SidebarProvider>
  )
}
