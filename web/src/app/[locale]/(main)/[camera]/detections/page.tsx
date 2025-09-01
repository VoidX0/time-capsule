'use client'

import { components } from '@/api/schema'
import { getCameraById } from '@/app/[locale]/(main)/[camera]/camera'
import { Lens } from '@/components/magicui/lens'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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
import { Slider } from '@/components/ui/slider'
import { formatDate, rangeWeek } from '@/lib/date-time'
import { openapi } from '@/lib/http'
import { ArrowUp, CalendarIcon, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
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
  const tDetection = useTranslations('DetectionItem')
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [detections, setDetections] = useState<Detection[] | undefined>([]) // 检测结果列表
  const [detectionsGroups, setDetectionsGroups] = useState<
    Record<string, Record<string, Detection[]>>
  >({}) // 按日期与SegmentID + FramePath分组的检测结果
  const [categories, setCategories] = useState<string[]>([]) // 目标类别列表
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]) // 当前选中的类别列表
  const [minConfidence, setMinConfidence] = useState(0.3) // 最小置信度过滤
  const [date, setDate] = useState<DateRange | undefined>(rangeWeek())
  const [filterOpen, setFilterOpen] = useState(false) // 类别筛选开关
  const [datePopover, setDatePopover] = useState(false) // 日期选择弹窗开关
  const [detailOpen, setDetailOpen] = useState(false) // 控制详情弹窗开关
  const [selectedDetection, setSelectedDetection] = useState<
    Detection[] | null
  >(null) // 当前选中的检测结果

  /* 加载摄像头 */
  useEffect(() => {
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => {
        setCameraInfo(camera)
        setMinConfidence(camera?.DetectionConfidence || 0.3)
      })
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
    filteredDetections
      .filter((d) => (d.TargetConfidence ?? 0) >= minConfidence) // 置信度过滤
      .forEach((detection) => {
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
  }, [detections, minConfidence, selectedCategory])

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
      // 提取类别（按 TargetId 排序，再去重）
      const cats = Array.from(
        new Map(
          data!
            .slice()
            .sort((a, b) => (a.TargetId ?? 0) - (b.TargetId ?? 0)) // 按 TargetId 排序
            .map((d) => [d.TargetName || 'Unknown', d.TargetId ?? 0]), // 保留 TargetId 做顺序参考
        ).keys(),
      )
      setCategories(cats)
      // 设置已选类别
      setSelectedCategory((prev) => {
        // 只有当 selectedCategory 为空时，设置默认选项
        if (prev.length === 0 && cats.length > 0) {
          return [cats[0]!]
        }
        // 保持已选类别，但移除不存在的类别
        return prev.filter((cat) => cats.includes(cat))
      })
    }
    if (cameraInfo === undefined) return
    getDetections(cameraInfo?.Id?.toString() ?? '').then()
  }, [cameraInfo, date?.from, date?.to])

  // 等待摄像头准备好
  if (cameraInfo == undefined) {
    return (
      <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl p-8">
        {/* 标题骨架 */}
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="mb-4 h-6 w-80" />

        {/* 日期分组骨架 */}
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-muted/50 space-y-4 rounded-xl p-4">
              {/* 日期 & badge */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              {/* 图片网格骨架 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[...Array(4)].map((_, j) => (
                  <Skeleton
                    key={j}
                    className="aspect-video w-full rounded-lg"
                  />
                ))}
              </div>
            </div>
          ))}
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
        {/* 按日期分组 */}
        {Object.entries(detectionsGroups).map(([date, detectionsByKey]) => (
          <div
            key={date}
            id={`date-${date}`}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-start gap-4">
              <h2 className="text-xl font-semibold">{date}</h2>
              <Badge>{Object.keys(detectionsByKey).length} items</Badge>
            </div>

            {/* 同一张图片内的 detections */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {Object.entries(detectionsByKey).map(([groupKey, detections]) => {
                if (!detections.length) return null
                const firstDetection = detections[0] // 只显示第一张
                return (
                  <div key={groupKey} className="overflow-hidden rounded-lg">
                    <Lens
                      zoomFactor={2}
                      lensSize={150}
                      isStatic={false}
                      ariaLabel="Zoom Area"
                    >
                      <Image
                        src={`/api/Detection/GetImage?cameraId=${cameraInfo.Id}&segmentId=${detections[0]!.SegmentId}&framePath=${encodeURIComponent(detections[0]!.FramePath!)}`}
                        alt={`Detection ${firstDetection!.Id}`}
                        width={1920}
                        height={1080}
                        className="aspect-video w-full cursor-pointer object-cover hover:scale-105"
                        onClick={() => {
                          setSelectedDetection(detections)
                          setDetailOpen(true)
                        }}
                      />
                    </Lens>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {/* 检测结果详情 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detections Info</DialogTitle>
          </DialogHeader>
          {selectedDetection && (
            <div className="space-y-2">
              <div className="space-y-1 text-sm">
                <p>
                  <strong>摄像头ID:</strong> {selectedDetection[0]?.CameraId}
                </p>
                <p>
                  <strong>视频片段ID:</strong> {selectedDetection[0]?.SegmentId}
                </p>
                <p>
                  <strong>检测时间:</strong>{' '}
                  {new Date(selectedDetection[0]!.FrameTime!).toLocaleString()}
                </p>
              </div>
              {selectedDetection.map((detection) => (
                <div
                  key={detection.Id}
                  className="rounded-lg border p-4 shadow"
                >
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>类别:</strong> {detection.TargetName || 'N/A'} (
                      {tDetection(detection.TargetName! as never) || 'N/A'})
                    </p>
                    <p>
                      <strong>置信度:</strong>{' '}
                      {`${((detection.TargetConfidence ?? 0) * 100).toFixed(2)}%`}
                    </p>
                    <p>
                      <strong>坐标:</strong>{' '}
                      {detection.TargetLocationX !== undefined &&
                      detection.TargetLocationY !== undefined
                        ? `${detection.TargetLocationX}, ${detection.TargetLocationY}`
                        : 'N/A'}
                    </p>
                    <p>
                      <strong>尺寸:</strong>{' '}
                      {detection.TargetSizeWidth !== undefined &&
                      detection.TargetSizeHeight !== undefined
                        ? `${detection.TargetSizeWidth} x ${detection.TargetSizeHeight}`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 浮动按钮 - 日期选择 */}
      {(() => {
        return (
          <Popover open={datePopover} onOpenChange={setDatePopover}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                className="fixed right-4 bottom-4 z-50 rounded-full shadow-lg"
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

      {/*浮动按钮 - 目标过滤*/}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            className="fixed right-16 bottom-4 z-50 rounded-full shadow-lg"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>目标过滤</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            <div className="flex items-center space-x-2">
              <label className="w-24 text-sm">
                最小置信度({(minConfidence * 100).toFixed(0)}%)
              </label>
              <Slider
                className="w-full"
                value={[minConfidence]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(value) => setMinConfidence(value[0]!)}
              />
            </div>
            {categories.map((cat) => (
              <label
                key={cat}
                className="flex cursor-pointer items-center space-x-2"
              >
                <Checkbox
                  checked={selectedCategory.includes(cat)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCategory((prev) => [...prev, cat])
                    } else {
                      setSelectedCategory((prev) =>
                        prev.filter((c) => c !== cat),
                      )
                    }
                  }}
                />
                <span>
                  {cat} ({tDetection(cat as never)})
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setMinConfidence(cameraInfo?.DetectionConfidence || 0.3)
                setSelectedCategory(
                  categories.length > 0 ? [categories[0]!] : [],
                )
              }}
            >
              重置
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 浮动按钮 - 回到顶部 */}
      <Button
        size="icon"
        className="fixed right-28 bottom-4 z-50 rounded-full shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  )
}
