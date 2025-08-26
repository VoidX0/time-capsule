'use client'

import { components } from '@/api/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { openapi } from '@/lib/http'
import { Plus, RefreshCcw, SquarePen, Trash2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']

export default function Page() {
  const locale = useLocale()
  const [cameras, setCameras] = useState<Camera[]>([])

  // 新增相关
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBasePath, setNewBasePath] = useState('')
  const [newTemplate, setNewTemplate] = useState('')
  const [newEnableDetection, setNewEnableDetection] = useState(false)
  const [newDetectInterval, setNewDetectInterval] = useState(30)
  const [newDetectionConfidence, setNewDetectionConfidence] = useState(0.3)

  // 编辑相关
  const [editCam, setEditCam] = useState<Camera | undefined>(undefined)

  // 获取相关
  const fetchList = async () => {
    const { data } = await openapi.POST('/Camera/Query', {
      body: {
        PageNumber: 1,
        PageSize: 1000,
        Order: [{ FieldName: 'Id', OrderByType: 0 }],
      } as QueryDto,
    })
    setCameras(data || [])
  }

  useEffect(() => {
    fetchList().then()
  }, [])

  const handleDelete = async (id: number | undefined) => {
    if (!id) return
    const body = cameras.find((c) => c.Id === id)
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
            DetectInterval: newDetectInterval,
            DetectionConfidence: newDetectionConfidence,
          },
        ],
      })
    } else {
      // 新增
      await openapi.POST('/Camera/Insert', {
        body: [
          {
            Name: newName,
            BasePath: newBasePath,
            SegmentTemplate: newTemplate,
            EnableDetection: newEnableDetection,
            DetectInterval: newDetectInterval,
            DetectionConfidence: newDetectionConfidence,
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
    setNewDetectInterval(30)
    setNewDetectionConfidence(0.3)
    fetchList().then()
  }

  const startEdit = (cam: Camera) => {
    setEditCam(cam)
    setNewName(cam.Name || '')
    setNewBasePath(cam.BasePath || '')
    setNewTemplate(cam.SegmentTemplate || '')
    setNewEnableDetection(cam.EnableDetection || false)
    setNewDetectInterval(cam.DetectionInterval || 30)
    setNewDetectionConfidence(cam.DetectionConfidence || 0.3)
    setDialogOpen(true)
  }

  const startAdd = () => {
    setEditCam(undefined)
    setNewName('')
    setNewBasePath('')
    setNewTemplate('*_{start:yyyyMMddHHmmss}_{end:yyyyMMddHHmmss}')
    setNewEnableDetection(false)
    setNewDetectInterval(30)
    setNewDetectionConfidence(0.3)
    setDialogOpen(true)
  }

  const syncAndCache = async (cam: Camera) => {
    const { error } = await openapi.POST('/Camera/SyncAndCache', {
      params: { query: { cameraId: cam.Id?.toString() } },
    })
    if (error) toast.error(`同步和缓存请求失败: ${error}`)
    else toast.success('同步和缓存请求成功，请稍等片刻，后台正在处理')
  }

  return (
    <div className="max-w-8xl mx-auto grid grid-cols-1 gap-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
      <Button
        onClick={startAdd}
        className="mb-4 w-full sm:col-span-2 lg:col-span-3"
      >
        <Plus />
        新增摄像头
      </Button>

      {cameras.map((cam) => (
        <Card key={cam.Id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {cam.Name}
              <Link href={`/${locale}/${cam.Id}/dashboard`}>详情</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              ID: <strong>{cam.Id}</strong>
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
                    <DialogTitle>确认删除</DialogTitle>
                  </DialogHeader>
                  <p className="py-2">
                    确认删除摄像头 <strong>{cam.Name}</strong>{' '}
                    吗？此操作不会删除摄像头原视频数据，但会删除相关配置和缓存数据。
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(cam.Id)}
                    >
                      删除
                    </Button>
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
            <DialogTitle>{editCam ? '编辑摄像头' : '新增摄像头'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                名称
              </label>
              <Input
                className="font-mono"
                placeholder="名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                基础路径
              </label>
              <Input
                className="font-mono"
                placeholder="基础路径"
                value={newBasePath}
                onChange={(e) => setNewBasePath(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Segment 解析模板
              </label>
              <Input
                className="font-mono"
                placeholder="Segment解析模板"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-600">
                启用目标检测
              </label>
              <Checkbox
                checked={newEnableDetection}
                onCheckedChange={(checked) => setNewEnableDetection(!!checked)}
              />
            </div>
            {newEnableDetection && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">
                    检测间隔（秒）
                  </label>
                  <Input
                    type="number"
                    className="font-mono"
                    placeholder="检测间隔（秒）"
                    value={newDetectInterval}
                    onChange={(e) =>
                      setNewDetectInterval(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">
                    检测置信度（0-1）
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    className="font-mono"
                    placeholder="检测置信度（0-1）"
                    value={newDetectionConfidence}
                    onChange={(e) =>
                      setNewDetectionConfidence(Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}
            <Button onClick={handleSave} className="w-full">
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
