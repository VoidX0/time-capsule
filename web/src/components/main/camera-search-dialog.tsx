'use client'

import { Camera } from '@/api/generatedSchemas'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface CameraSearchDialogProps {
  open: boolean
  onClose: () => void
  cameras: Camera[]
}

export function CameraSearchDialog({
  open,
  onClose,
  cameras,
}: CameraSearchDialogProps) {
  const t = useTranslations('MainLayout')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const router = useRouter()

  const results: Camera[] = useMemo(() => {
    if (!query) {
      return []
    }
    return cameras.filter((cam) =>
      cam.name?.toLowerCase().includes(query.toLowerCase()),
    )
  }, [query, cameras])

  const handleClick = (cameraId: string | undefined) => {
    if (!cameraId) return
    onClose()
    router.push(`/${locale}/${cameraId}/dashboard`)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[400px] max-w-full">
        <DialogHeader>
          <DialogTitle>{t('cameraSearch')}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder={t('cameraSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2"
        />
        <div className="max-h-60 overflow-y-auto">
          {results.map((cam) => (
            <div
              key={cam.id}
              className="hover:bg-muted cursor-pointer p-2"
              onClick={() => handleClick(cam.id?.toString())}
            >
              {cam.name}
            </div>
          ))}
          {results.length === 0 && query && (
            <div className="p-2">{t('cameraSearchNoResults')}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
