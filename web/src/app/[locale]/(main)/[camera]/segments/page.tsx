'use client'

import { components } from '@/api/schema'
import HeroVideoDialog from '@/components/magicui/hero-video-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { ArrowUp, CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']
type Segment = components['schemas']['VideoSegment']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [, setSegments] = useState<Segment[] | undefined>([]) // 视频切片列表
  const [segmentsByDate, setSegmentsByDate] = useState<
    Record<string, Segment[]>
  >({}) // 按日期分组的视频切片
  const [popover, setPopover] = useState(false) // 控制 Popover 开关
  const [detailOpen, setDetailOpen] = useState(false) // 控制详情弹窗开关
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null) // 当前选中的Segment

  /* 加载摄像头与Segment列表 */
  useEffect(() => {
    const getCameraInfo = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1,
        Condition: [
          { FieldName: 'Id', FieldValue: cameraId, CSharpTypeName: 'long' },
        ],
      }
      const { data } = await openapi.POST('/Camera/Query', { body })
      if ((data?.length ?? -1) <= 0) return
      setCameraInfo(data![0])
    }

    const getSegments = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 10000,
        Condition: [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
        ],
        Order: [{ FieldName: 'StartTime', OrderByType: 1 }],
      }
      const { data } = await openapi.POST('/Segment/Query', { body })
      if ((data?.length ?? -1) <= 0) return
      setSegments(data!)
      // 按日期分组视频切片
      const grouped: Record<string, Segment[]> = {}
      data!.forEach((segment) => {
        const dateKey =
          new Date(segment.StartTime!).toISOString().split('T')[0] ?? ''
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(segment)
      })
      setSegmentsByDate(grouped)
    }

    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraInfo(cameraId).then()
      getSegments(cameraId).then()
    })
  }, [params])

  /* 删除Segment */
  const deleteSegment = async (segment: Segment) => {
    await openapi.DELETE('/Segment/Delete', { body: [segment] })

    // 重新设置segmentsByDate
    setSegmentsByDate((prev) => {
      const dateKey = new Date(segment.StartTime!).toISOString().split('T')[0]
      const copy = { ...prev }
      if (copy[dateKey!]) {
        copy[dateKey!] = copy[dateKey!]!.filter((s) => s.Id !== segment.Id)
        if (copy[dateKey!]?.length === 0) delete copy[dateKey!]
      }
      return copy
    })

    // 关闭详情弹窗
    setDetailOpen(false)
    setSelectedSegment(null)
  }

  // 等待摄像头准备好
  if (cameraInfo == undefined) {
    return (
      <div className="md:p-8">
        <div className="flex h-96 items-center justify-center">
          <p>Loading camera...</p>
        </div>
      </div>
    )
  }
  // 初始化完成
  return (
    <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl md:p-8">
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.Name || ''}</h1>
      <div className="grid grid-cols-1 gap-4">
        {/*按天分组的视频片段*/}
        {Object.entries(segmentsByDate).map(([date, segments]) => (
          <div
            key={date}
            id={`date-${date}`}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-start gap-4">
              <h2 className="text-xl font-semibold">{date}</h2>
              <Badge>{segments.length} segments</Badge>
              <Badge>
                {(
                  segments.reduce(
                    (sum, seg) =>
                      sum + timeSpanToMilliseconds(seg.DurationActual!),
                    0,
                  ) /
                  1000 /
                  60 /
                  60
                ).toFixed(2)}
                h
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {/*一天内的视频切片*/}
              {segments.map((segment) => {
                // 包裹Segment卡片，右键 / 长按 触发详情
                let touchTimer: NodeJS.Timeout | undefined = undefined
                // 右键触发详情
                const handleContextMenu = (e: React.MouseEvent) => {
                  e.preventDefault()
                  setSelectedSegment(segment)
                  setDetailOpen(true)
                }
                // 长按触发详情
                const handleTouchStart = () => {
                  touchTimer = setTimeout(() => {
                    setSelectedSegment(segment)
                    setDetailOpen(true)
                  }, 500) // 长按 500ms
                }
                // 触摸结束清除定时器
                const handleTouchEnd = () => {
                  if (touchTimer) clearTimeout(touchTimer)
                }

                return (
                  <div
                    key={segment.Id}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <HeroVideoDialog
                      className="block"
                      animationStyle="from-center"
                      videoSrc={`/api/Video/SegmentStream?segmentId=${segment.Id}`}
                      thumbnailSrc={`/api/Segment/GetThumbnail?segmentId=${segment.Id}`}
                      thumbnailAlt={`${new Date(segment.StartTime!).toLocaleString()} - ${new Date(segment.EndTime!).toLocaleString()}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Segment详情 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Segment Info</DialogTitle>
          </DialogHeader>
          {selectedSegment && (
            <div className="space-y-2">
              <p>
                <strong>ID:</strong> {selectedSegment.Id}
              </p>
              <p>
                <strong>Start:</strong>{' '}
                {new Date(selectedSegment.StartTime!).toLocaleString()}
              </p>
              <p>
                <strong>End:</strong>{' '}
                {new Date(selectedSegment.EndTime!).toLocaleString()}
              </p>
              <Button
                variant="destructive"
                onClick={() => deleteSegment(selectedSegment)}
              >
                Delete
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 浮动按钮 - 日期选择 */}
      {(() => {
        const handleSelectDate = (selectedDate: Date | undefined) => {
          if (!selectedDate) return
          const y = selectedDate.getFullYear()
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0')
          const d = String(selectedDate.getDate()).padStart(2, '0')
          const dateKey = `${y}-${m}-${d}`
          const target = document.getElementById(`date-${dateKey}`)
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          setPopover(false)
        }

        return (
          <Popover open={popover} onOpenChange={setPopover}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                className="fixed right-4 bottom-4 rounded-full shadow-lg"
              >
                <CalendarIcon className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" onSelect={handleSelectDate} />
            </PopoverContent>
          </Popover>
        )
      })()}

      {/* 浮动按钮 - 回到顶部 */}
      <Button
        size="icon"
        className="fixed right-16 bottom-4 rounded-full shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  )
}
