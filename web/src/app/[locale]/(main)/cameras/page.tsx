'use client'

import { components } from '@/api/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        body: [{ ...editCam, Name: newName, BasePath: newBasePath }],
      })
    } else {
      // 新增
      await openapi.POST('/Camera/Insert', {
        body: [{ Name: newName, BasePath: newBasePath }],
      })
    }
    setDialogOpen(false)
    setEditCam(undefined)
    setNewName('')
    setNewBasePath('')
    fetchList().then()
  }

  const startEdit = (cam: Camera) => {
    setEditCam(cam)
    setNewName(cam.Name || '')
    setNewBasePath(cam.BasePath || '')
    setDialogOpen(true)
  }

  const startAdd = () => {
    setEditCam(undefined)
    setNewName('')
    setNewBasePath('')
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
            <p>
              路径: <strong>{cam.BasePath}</strong>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => syncAndCache(cam)} variant="outline">
                <RefreshCcw />
              </Button>
              <Button onClick={() => startEdit(cam)} variant="outline">
                <SquarePen />
              </Button>
              <Button
                onClick={() => handleDelete(cam.Id)}
                variant="destructive"
              >
                <Trash2 />
              </Button>
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
            <Input
              placeholder="名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="基础路径"
              value={newBasePath}
              onChange={(e) => setNewBasePath(e.target.value)}
            />
            <Button onClick={handleSave} className="w-full">
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
