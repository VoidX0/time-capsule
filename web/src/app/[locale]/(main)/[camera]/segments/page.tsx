'use client'

import { Camera, QueryDto, VideoSegment } from '@/api/generatedSchemas'
import { getCameraById } from '@/app/[locale]/(main)/[camera]/camera'
import HeroVideoDialog from '@/components/magicui/hero-video-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, rangeWeek } from '@/lib/date-time'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { ArrowUp, CalendarIcon, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { DateRange } from 'react-day-picker'

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const t = useTranslations('CameraSegmentsPage')
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [, setSegments] = useState<VideoSegment[] | undefined>([]) // 视频切片列表
  const [segmentsByDate, setSegmentsByDate] = useState<
    Record<string, VideoSegment[]>
  >({}) // 按日期分组的视频切片
  const [date, setDate] = useState<DateRange | undefined>(rangeWeek())
  const [popover, setPopover] = useState(false) // 控制 Popover 开关
  const [detailOpen, setDetailOpen] = useState(false) // 控制详情弹窗开关
  const [selectedSegment, setSelectedSegment] = useState<VideoSegment | null>(
    null,
  ) // 当前选中的Segment

  /* 加载摄像头 */
  useEffect(() => {
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => setCameraInfo(camera))
    })
  }, [params])

  /* 加载Segments */
  useEffect(() => {
    const getSegments = async (cameraId: string) => {
      const body: QueryDto = {
        pageNumber: 1,
        pageSize: 10000,
        condition: [
          {
            fieldName: 'CameraId',
            fieldValue: cameraId,
            cSharpTypeName: 'long',
          },
          {
            fieldName: 'StartTime',
            fieldValue: `${formatDate(date?.from ?? new Date())} 00:00:00`,
            conditionalType: 3,
            cSharpTypeName: 'DateTimeOffset',
          },
          {
            fieldName: 'EndTime',
            fieldValue: `${formatDate(date?.to ?? new Date())} 23:59:59`,
            conditionalType: 5,
            cSharpTypeName: 'DateTimeOffset',
          },
        ],
        order: [{ fieldName: 'StartTime', orderByType: 1 }],
      }
      const { data } = await openapi.POST('/Segment/Query', { body })
      if ((data?.items.length ?? -1) <= 0) {
        // 清空
        setSegments([])
        setSegmentsByDate({})
        return
      }
      setSegments(data!.items)
      // 按日期分组视频切片
      const grouped: Record<string, VideoSegment[]> = {}
      data!.items.forEach((segment) => {
        const dateKey =
          new Date(segment.startTime!).toISOString().split('T')[0] ?? ''
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(segment)
      })
      setSegmentsByDate(grouped)
    }
    if (cameraInfo === undefined) return
    getSegments(cameraInfo?.id?.toString() ?? '').then()
  }, [cameraInfo, date?.from, date?.to])

  /* 删除Segments */
  const deleteSegments = async (segmentsToDelete: VideoSegment[]) => {
    if (segmentsToDelete.length === 0) return
    await openapi.DELETE('/Segment/Delete', { body: segmentsToDelete })

    // 更新segmentsByDate
    setSegmentsByDate((prev) => {
      const copy = { ...prev }
      segmentsToDelete.forEach((seg) => {
        const dateKey = new Date(seg.startTime!).toISOString().split('T')[0]
        if (copy[dateKey!]) {
          copy[dateKey!] = copy[dateKey!]!.filter((s) => s.id !== seg.id)
          if (copy[dateKey!]!.length === 0) delete copy[dateKey!]
        }
      })
      return copy
    })

    // 如果是从详情弹窗调用的，也要关掉
    setDetailOpen(false)
    setSelectedSegment(null)
  }

  // 等待摄像头准备好
  if (cameraInfo == undefined) {
    return (
      <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl p-8">
        {/* 标题骨架 */}
        <Skeleton className="mb-4 h-10 w-64" />

        {/* 日期范围骨架 */}
        <Skeleton className="mb-4 h-6 w-40" />

        {/* 视频段列表骨架 */}
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-muted/50 space-y-2 rounded-xl p-4">
              <Skeleton className="h-6 w-32" /> {/* 日期标题 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 浮动按钮骨架 */}
        <div className="fixed right-4 bottom-4">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="fixed right-16 bottom-4">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    )
  }
  // 初始化完成
  return (
    <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl p-8">
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.name || ''}</h1>
      <h2 className="mb-4 text-lg font-semibold">
        {date?.from?.toLocaleDateString() || ''} -{' '}
        {date?.to?.toLocaleDateString() || ''}
      </h2>
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
                      sum + timeSpanToMilliseconds(seg.durationActual!),
                    0,
                  ) /
                  1000 /
                  60 /
                  60
                ).toFixed(2)}
                h
              </Badge>
              {/*删除整天*/}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
                    <DialogDescription>
                      {t('confirmDeleteMessage', {
                        param: segments.length || 0,
                      })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-2">
                    <DialogClose>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          deleteSegments(segments).then()
                        }}
                      >
                        {t('deleteButton')}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
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
                    key={segment.id}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <HeroVideoDialog
                      className="block"
                      animationStyle="from-center"
                      videoSrc={`/api/Video/SegmentStream?segmentId=${segment.id}&token=${encodeURIComponent(rsaEncrypt(Date.now().toString()))}`}
                      thumbnailSrc={`/api/Segment/GetThumbnail?cameraId=${cameraInfo.id}&segmentId=${segment.id}&token=${encodeURIComponent(rsaEncrypt(Date.now().toString()))}`}
                      thumbnailAlt={`${new Date(segment.startTime!).toLocaleString()} - ${new Date(segment.endTime!).toLocaleString()}`}
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
            <DialogTitle>{t('segmentInfoTitle')}</DialogTitle>
          </DialogHeader>
          {selectedSegment && (
            <div className="space-y-2">
              {/*删除单个Segment*/}
              <Button
                variant="outline"
                size="icon"
                onClick={() => deleteSegments([selectedSegment!])}
              >
                <Trash2 />
              </Button>
              {/*详情信息*/}
              <p>
                <strong>ID:</strong> {selectedSegment.id}
              </p>
              <p>
                <strong>{t('cameraId')}:</strong> {selectedSegment.cameraId}
              </p>
              <p>
                <strong>{t('syncTime')}:</strong>{' '}
                {new Date(selectedSegment.syncTime!).toLocaleString()}
              </p>
              <p>
                <strong>{t('fileSize')}:</strong>{' '}
                {selectedSegment.size
                  ? Number(selectedSegment.size).toFixed(2)
                  : 'N/A'}{' '}
                MB
              </p>
              <p>
                <strong>{t('startTime')}:</strong>{' '}
                {new Date(selectedSegment.startTime!).toLocaleString()}
              </p>
              <p>
                <strong>{t('endTime')}:</strong>{' '}
                {new Date(selectedSegment.endTime!).toLocaleString()}
              </p>
              <p>
                <strong>{t('durationActual')}:</strong>{' '}
                {selectedSegment.durationActual
                  ? selectedSegment.durationActual
                  : 'N/A'}
              </p>
              <p>
                <strong>{t('durationTheoretical')}:</strong>{' '}
                {selectedSegment.durationTheoretical
                  ? selectedSegment.durationTheoretical
                  : 'N/A'}
              </p>
              <p>
                <strong>{t('videoCodec')}:</strong>{' '}
                {selectedSegment.videoCodec || 'N/A'}
              </p>
              <p>
                <strong>{t('videoResolution')}:</strong>{' '}
                {selectedSegment.videoWidth
                  ? selectedSegment.videoWidth
                  : 'N/A'}{' '}
                x{' '}
                {selectedSegment.videoHeight
                  ? selectedSegment.videoHeight
                  : 'N/A'}
              </p>
              <p>
                <strong>{t('videoFps')}:</strong>{' '}
                {selectedSegment.videoFps
                  ? Number(selectedSegment.videoFps).toFixed(2)
                  : 'N/A'}{' '}
                fps
              </p>
              <p>
                <strong>{t('videoBitrate')}:</strong>{' '}
                {selectedSegment.videoBitrate
                  ? Number(selectedSegment.videoBitrate).toFixed(2)
                  : 'N/A'}{' '}
                kbps
              </p>
              <p>
                <strong>{t('audioCodec')}:</strong>{' '}
                {selectedSegment.audioCodec || 'N/A'}
              </p>
              <p>
                <strong>{t('audioSampleRate')}:</strong>{' '}
                {selectedSegment.audioSampleRate
                  ? Number(selectedSegment.audioSampleRate).toFixed(2)
                  : 'N/A'}{' '}
                Hz
              </p>
              <p>
                <strong>{t('audioChannels')}:</strong>{' '}
                {selectedSegment.audioChannels
                  ? selectedSegment.audioChannels
                  : 'N/A'}
              </p>
              <p>
                <strong>{t('audioBitrate')}:</strong>{' '}
                {selectedSegment.audioBitrate
                  ? Number(selectedSegment.audioBitrate).toFixed(2)
                  : 'N/A'}{' '}
                kbps
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 浮动按钮 - 日期选择 */}
      {(() => {
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
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
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
