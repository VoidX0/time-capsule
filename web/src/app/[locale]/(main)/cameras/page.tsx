'use client'

import { components } from '@/api/schema'
import { getCameras } from '@/app/[locale]/(main)/[camera]/camera'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { openapi } from '@/lib/http'
import { Plus, RefreshCcw, SquarePen, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Camera = components['schemas']['Camera']

export default function Page() {
  const t = useTranslations('CamerasPage')
  const locale = useLocale()
  const [cameras, setCameras] = useState<Camera[]>([])

  // 新增相关
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBasePath, setNewBasePath] = useState('')
  const [newTemplate, setNewTemplate] = useState('')
  const [newEnableDetection, setNewEnableDetection] = useState(false)
  const [newDetectionInterval, setNewDetectionInterval] = useState(30)
  const [newDetectionConfidence, setNewDetectionConfidence] = useState(0.3)

  // 编辑相关
  const [editCam, setEditCam] = useState<Camera | undefined>(undefined)

  // 获取相关
  const fetchList = async () => {
    const cameras = await getCameras()
    setCameras(cameras || [])
  }

  useEffect(() => {
    const load = async () => {
      await fetchList()
    }
    load().then()
  }, [])

  const handleDelete = async (id: number | string | undefined) => {
    if (!id) return
    const body = cameras.find((c) => c.id === id)
    if (!body) return
    await openapi.DELETE('/Camera/Delete', {
      body: [body],
    })
    fetchList().then()
  }

  const handleSave = async () => {
    if (editCam) {
      // 修改
      await openapi.PUT('/Camera/Update', {
        body: [
          {
            ...editCam,
            Name: newName,
            BasePath: newBasePath,
            SegmentTemplate: newTemplate,
            EnableDetection: newEnableDetection,
            DetectionInterval: newDetectionInterval,
            DetectionConfidence: newDetectionConfidence,
          },
        ],
      })
    } else {
      // 新增
      await openapi.POST('/Camera/Insert', {
        body: [
          {
            name: newName,
            basePath: newBasePath,
            segmentTemplate: newTemplate,
            enableDetection: newEnableDetection,
            detectionInterval: newDetectionInterval,
            detectionConfidence: newDetectionConfidence,
          },
        ],
      })
    }
    setDialogOpen(false)
    setEditCam(undefined)
    setNewName('')
    setNewBasePath('')
    setNewTemplate('')
    setNewEnableDetection(false)
    setNewDetectionInterval(30)
    setNewDetectionConfidence(0.3)
    fetchList().then()
  }

  const startEdit = (cam: Camera) => {
    setEditCam(cam)
    setNewName(cam.name || '')
    setNewBasePath(cam.basePath || '')
    setNewTemplate(cam.segmentTemplate || '')
    setNewEnableDetection(cam.enableDetection || false)
    setNewDetectionInterval(Number(cam.detectionInterval) || 30)
    setNewDetectionConfidence(Number(cam.detectionConfidence) || 0.3)
    setDialogOpen(true)
  }

  const startAdd = () => {
    setEditCam(undefined)
    setNewName('')
    setNewBasePath('')
    setNewTemplate('*_{start:yyyyMMddHHmmss}_{end:yyyyMMddHHmmss}')
    setNewEnableDetection(false)
    setNewDetectionInterval(30)
    setNewDetectionConfidence(0.3)
    setDialogOpen(true)
  }

  const syncAndCache = async (cam: Camera) => {
    const { error } = await openapi.POST('/Camera/SyncAndCache', {
      params: { query: { cameraId: cam.id?.toString() } },
    })
    if (error) toast.error(`${t('syncFail')}: ${error}`)
    else toast.success(t('syncSuccess'))
  }

  const clearDetection = async (cam: Camera) => {
    const { error } = await openapi.DELETE('/Camera/ClearDetections', {
      params: { query: { cameraId: cam.id?.toString() } },
    })
    if (error) toast.error(`${t('clearDetectionFail')}: ${error}`)
    else toast.success(t('clearDetectionSuccess'))
  }

  return (
    <div className="max-w-8xl mx-auto grid grid-cols-1 gap-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
      <Button
        onClick={startAdd}
        className="mb-4 w-full sm:col-span-2 lg:col-span-3"
      >
        <Plus />
        {t('addCamera')}
      </Button>

      {cameras.map((cam) => (
        <Card key={cam.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {cam.name}
              <Link href={`/${locale}/${cam.id}/dashboard`}>
                {t('details')}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              ID: <strong>{cam.id}</strong>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => syncAndCache(cam)} variant="outline">
                <RefreshCcw />
              </Button>
              <Button onClick={() => startEdit(cam)} variant="outline">
                <SquarePen />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('deleteConfirm')}</DialogTitle>
                    <DialogDescription>
                      {t('deleteConfirmText', { param: cam.name ?? '' })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(cam.id)}
                      >
                        {t('delete')}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 新增 / 编辑 弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editCam ? t('editCamera') : t('addCamera')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                {t('name')}
              </label>
              <Input
                className="font-mono"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                {t('basePath')}
              </label>
              <Input
                className="font-mono"
                value={newBasePath}
                onChange={(e) => setNewBasePath(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                {t('segmentTemplate')}
              </label>
              <Input
                className="font-mono"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-600">
                {t('detectionEnable')}
              </label>
              <Checkbox
                checked={newEnableDetection}
                onCheckedChange={(checked) => setNewEnableDetection(!!checked)}
              />
              {editCam && (
                <Button
                  variant="destructive"
                  onClick={() => clearDetection(editCam!)}
                >
                  {t('clearDetections')}
                </Button>
              )}
            </div>
            {newEnableDetection && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">
                    {t('detectionInterval')}
                  </label>
                  <Input
                    type="number"
                    className="font-mono"
                    value={newDetectionInterval}
                    onChange={(e) =>
                      setNewDetectionInterval(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">
                    {t('detectionConfidence')}
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    className="font-mono"
                    value={newDetectionConfidence}
                    onChange={(e) =>
                      setNewDetectionConfidence(Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}
            <Button onClick={handleSave} className="w-full">
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
