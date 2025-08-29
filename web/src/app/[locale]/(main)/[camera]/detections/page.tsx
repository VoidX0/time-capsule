'use client'

import { components } from '@/api/schema'
import { getCameraById } from '@/app/[locale]/(main)/[camera]/camera'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, rangeWeek } from '@/lib/date-time'
import { openapi } from '@/lib/http'
import { ArrowUp, CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DateRange } from 'react-day-picker'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']
type Detection = components['schemas']['FrameDetection']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [detections, setDetections] = useState<Detection[] | undefined>([]) // 检测结果列表
  const [detectionsGroups, setDetectionsGroups] = useState<
    Record<string, Record<string, Detection[]>>
  >({}) // 按日期与SegmentID + FramePath分组的检测结果
  const [categories, setCategories] = useState<string[]>([]) // 目标类别列表
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]) // 当前选中的类别列表
  const [date, setDate] = useState<DateRange | undefined>(rangeWeek())
  const [popover, setPopover] = useState(false) // 控制 Popover 开关
  const [detailOpen, setDetailOpen] = useState(false) // 控制详情弹窗开关
  const [selectedDetection, setSelectedDetection] = useState<
    Detection[] | null
  >(null) // 当前选中的检测结果

  /* 加载摄像头 */
  useEffect(() => {
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => setCameraInfo(camera))
    })
  }, [params])

  /* Detections分组 */
  useEffect(() => {
    const grouped: Record<string, Record<string, Detection[]>> = {}
    // 选中的类别
    const filteredDetections =
      detections?.filter((detection) =>
        selectedCategory.length > 0
          ? detection.TargetName &&
            selectedCategory.includes(detection.TargetName)
          : true,
      ) ?? []
    // 按日期与SegmentID + FramePath分组
    filteredDetections.forEach((detection) => {
      const dateKey = new Date(detection.FrameTime!).toLocaleDateString()
      const segmentKey = `${detection.SegmentId}-${detection.FramePath}`
      if (!grouped[dateKey]) {
        grouped[dateKey] = {}
      }
      if (!grouped[dateKey][segmentKey]) {
        grouped[dateKey][segmentKey] = []
      }
      grouped[dateKey][segmentKey].push(detection)
    })
    setDetectionsGroups(grouped)
  }, [detections, selectedCategory])

  /* 加载Detections */
  useEffect(() => {
    const getDetections = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 10000,
        Condition: [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
          {
            FieldName: 'FrameTime',
            FieldValue: `${formatDate(date?.from ?? new Date())} 00:00:00`,
            ConditionalType: 3,
            CSharpTypeName: 'DateTimeOffset',
          },
          {
            FieldName: 'FrameTime',
            FieldValue: `${formatDate(date?.to ?? new Date())} 23:59:59`,
            ConditionalType: 5,
            CSharpTypeName: 'DateTimeOffset',
          },
        ],
        Order: [
          { FieldName: 'FrameTime', OrderByType: 1 },
          { FieldName: 'TargetId', OrderByType: 0 },
        ],
      }
      const { data } = await openapi.POST('/Detection/Query', { body })
      if ((data?.length ?? -1) <= 0) {
        // 清空
        setDetections([])
        return
      }
      setDetections(data!)
      // 提取类别
      const cats = Array.from(
        new Set(data!.map((detection) => detection.TargetName || 'Unknown')),
      ).sort()
      setCategories(cats)
    }
    if (cameraInfo === undefined) return
    getDetections(cameraInfo?.Id?.toString() ?? '').then()
  }, [cameraInfo, date?.from, date?.to])

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
    <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl p-8">
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.Name || ''}</h1>
      <h2 className="mb-4 text-lg font-semibold">
        {date?.from?.toLocaleDateString() || ''} -{' '}
        {date?.to?.toLocaleDateString() || ''}
      </h2>
      <div className="grid grid-cols-1 gap-4">
        {/*按天分组的检测结果*/}
        {Object.entries(detectionsGroups).map(([date, group]) => (
          <div
            key={date}
            id={`date-${date}`}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-start gap-4">
              <h2 className="text-xl font-semibold">{date}</h2>
              <Badge>{Object.keys(group).length} frames</Badge>
            </div>
            {/*/!* 按SegmentID + FramePath分组的检测结果 *!/*/}
            {/*{Object.entries(group)*/}
            {/*  .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))*/}
            {/*  .map(([frameKey, detections]) => (*/}
            {/*    <div*/}
            {/*      key={frameKey}*/}
            {/*      className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4"*/}
            {/*    >*/}
            {/*      <Image*/}
            {/*        className="my-2 rounded-lg"*/}
            {/*        src={`/api/Detection/GetImage?cameraId=${cameraInfo.Id}&segmentId=${detections[0]!.SegmentId}&framePath=${encodeURIComponent(detections[0]!.FramePath)}`}*/}
            {/*        alt={`${detections[0]!.FramePath}`}*/}
            {/*        width={1920}*/}
            {/*        height={1080}*/}
            {/*        loading="lazy"*/}
            {/*      />*/}
            {/*    </div>*/}
            {/*  ))}*/}

            {/*{group.map((detection) => {*/}
            {/*  // 包裹Detection卡片，右键 / 长按 触发详情*/}
            {/*  let touchTimer: NodeJS.Timeout | undefined = undefined*/}
            {/*  // 右键触发详情*/}
            {/*  const handleContextMenu = (e: React.MouseEvent) => {*/}
            {/*    e.preventDefault()*/}
            {/*    setSelectedDetection(detection)*/}
            {/*    setDetailOpen(true)*/}
            {/*  }*/}
            {/*  // 长按触发详情*/}
            {/*  const handleTouchStart = () => {*/}
            {/*    touchTimer = setTimeout(() => {*/}
            {/*      setSelectedDetection(detection)*/}
            {/*      setDetailOpen(true)*/}
            {/*    }, 500) // 长按 500ms*/}
            {/*  }*/}
            {/*  // 触摸结束清除定时器*/}
            {/*  const handleTouchEnd = () => {*/}
            {/*    if (touchTimer) clearTimeout(touchTimer)*/}
            {/*  }*/}

            {/*  return (*/}
            {/*    <div*/}
            {/*      key={detection.Id}*/}
            {/*      onContextMenu={handleContextMenu}*/}
            {/*      onTouchStart={handleTouchStart}*/}
            {/*      onTouchEnd={handleTouchEnd}*/}
            {/*    >*/}
            {/*      <Image*/}
            {/*        src={`/api/Detection/GetImage?cameraId=${cameraInfo.Id}&segmentId=${detection.SegmentId}&framePath=${detection.FramePath}`}*/}
            {/*        alt={`${detection.TargetName}`}*/}
            {/*        width={1920}*/}
            {/*        height={1080}*/}
            {/*        loading="lazy"*/}
            {/*      />*/}
            {/*    </div>*/}
            {/*  )*/}
            {/*})}*/}
          </div>
        ))}
      </div>
      {/* 检测结果详情 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detection Info</DialogTitle>
          </DialogHeader>
          {/*{selectedDetection && (*/}
          {/*  <div className="space-y-2">*/}
          {/*    /!*详情信息*!/*/}
          {/*    <p>*/}
          {/*      <strong>ID:</strong> {selectedDetection.Id}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>摄像头ID:</strong> {selectedDetection.CameraId}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>视频片段ID:</strong> {selectedDetection.SegmentId}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>检测时间:</strong>{' '}*/}
          {/*      {new Date(selectedDetection.FrameTime!).toLocaleString()}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>目标ID:</strong>{' '}*/}
          {/*      {selectedDetection.TargetId !== undefined*/}
          {/*        ? selectedDetection.TargetId*/}
          {/*        : 'N/A'}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>目标名称:</strong>{' '}*/}
          {/*      {selectedDetection.TargetName || 'N/A'}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>目标置信度:</strong>{' '}*/}
          {/*      {selectedDetection.TargetConfidence !== undefined*/}
          {/*        ? selectedDetection.TargetConfidence.toFixed(4)*/}
          {/*        : 'N/A'}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>目标坐标:</strong>{' '}*/}
          {/*      {selectedDetection.TargetLocationX !== undefined &&*/}
          {/*      selectedDetection.TargetLocationY !== undefined*/}
          {/*        ? `(${selectedDetection.TargetLocationX}, ${selectedDetection.TargetLocationY})`*/}
          {/*        : 'N/A'}*/}
          {/*    </p>*/}
          {/*    <p>*/}
          {/*      <strong>目标尺寸:</strong>{' '}*/}
          {/*      {selectedDetection.TargetSizeWidth !== undefined &&*/}
          {/*      selectedDetection.TargetSizeHeight !== undefined*/}
          {/*        ? `${selectedDetection.TargetSizeWidth} x ${selectedDetection.TargetSizeHeight}`*/}
          {/*        : 'N/A'}*/}
          {/*    </p>*/}
          {/*  </div>*/}
          {/*)}*/}
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
