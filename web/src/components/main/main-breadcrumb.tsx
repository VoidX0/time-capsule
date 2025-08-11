'use client'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'

export default function MainBreadcrumb() {
  const locale = useLocale()
  const pathname = usePathname()
  const pathParts = pathname.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1] || 'Home' // 最后一部分路径
  const isCameraPage = pathParts.length > 2 // 摄像头子页面
  const cameraId = isCameraPage ? pathParts[1] : null // 摄像头ID

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href={`/${locale}/dashboard`}>
            Time Capsule
          </BreadcrumbLink>
        </BreadcrumbItem>
        {isCameraPage && (
          <>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/${locale}/${cameraId}/dashboard`}>
                Camera
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{lastPart}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
