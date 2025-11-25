'use client'

import { Camera, FrameDetection, QueryDto } from '@/api/generatedSchemas'
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
import { rsaEncrypt } from '@/lib/security'
import { ArrowUp, CalendarIcon, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { DateRange } from 'react-day-picker'

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const t = useTranslations('CameraDetectionsPage')
  const tDetection = useTranslations('DetectionItem')
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [detections, setDetections] = useState<FrameDetection[] | undefined>([]) // 检测结果列表
  const [categories, setCategories] = useState<string[]>([]) // 目标类别列表
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]) // 当前选中的类别列表
  const [minConfidence, setMinConfidence] = useState(0.3) // 最小置信度过滤
  const [date, setDate] = useState<DateRange | undefined>(rangeWeek())
  const [filterOpen, setFilterOpen] = useState(false) // 类别筛选开关
  const [datePopover, setDatePopover] = useState(false) // 日期选择弹窗开关
  const [detailOpen, setDetailOpen] = useState(false) // 控制详情弹窗开关
  const [selectedDetection, setSelectedDetection] = useState<
    FrameDetection[] | null
  >(null) // 当前选中的检测结果

  /* 加载摄像头 */
  useEffect(() => {
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => {
        setCameraInfo(camera)
        setMinConfidence(Number(camera?.detectionConfidence) || 0.3)
      })
    })
  }, [params])

  /* Detections分组 */
  const detectionsGroups = useMemo(() => {
    const grouped: Record<string, Record<string, FrameDetection[]>> = {}
    // 选中的类别
    const filteredDetections =
      detections?.filter((detection) =>
        selectedCategory.length > 0
          ? detection.targetName &&
            selectedCategory.includes(detection.targetName)
          : true,
      ) ?? []
    // 按日期与SegmentID + FramePath分组
    filteredDetections
      .filter((d) => (Number(d.targetConfidence) ?? 0) >= minConfidence) // 置信度过滤
      .forEach((detection) => {
        const dateKey = new Date(detection.frameTime!).toLocaleDateString()
        const segmentKey = `${detection.segmentId}-${detection.framePath}`
        if (!grouped[dateKey]) {
          grouped[dateKey] = {}
        }
        if (!grouped[dateKey][segmentKey]) {
          grouped[dateKey][segmentKey] = []
        }
        grouped[dateKey][segmentKey].push(detection)
      })
    return grouped
  }, [detections, minConfidence, selectedCategory])

  /* 加载Detections */
  useEffect(() => {
    const getDetections = async (cameraId: string) => {
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
            fieldName: 'FrameTime',
            fieldValue: `${formatDate(date?.from ?? new Date())} 00:00:00`,
            conditionalType: 3,
            cSharpTypeName: 'DateTimeOffset',
          },
          {
            fieldName: 'FrameTime',
            fieldValue: `${formatDate(date?.to ?? new Date())} 23:59:59`,
            conditionalType: 5,
            cSharpTypeName: 'DateTimeOffset',
          },
        ],
        order: [
          { fieldName: 'FrameTime', orderByType: 1 },
          { fieldName: 'TargetId', orderByType: 0 },
        ],
      }
      const { data } = await openapi.POST('/Detection/Query', { body })
      if ((data?.items.length ?? -1) <= 0) {
        // 清空
        setDetections([])
        return
      }
      setDetections(data!.items)
      // 提取类别（按 TargetId 排序，再去重）
      const cats = Array.from(
        new Map(
          data!.items
            .slice()
            .sort(
              (a, b) => (Number(a.targetId) ?? 0) - (Number(b.targetId) ?? 0),
            ) // 按 TargetId 排序
            .map((d) => [d.targetName || 'Unknown', d.targetId ?? 0]), // 保留 TargetId 做顺序参考
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
    getDetections(cameraInfo?.id?.toString() ?? '').then()
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
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.name || ''}</h1>
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
                      <img
                        src={`/api/Detection/GetImage?cameraId=${cameraInfo.id}&segmentId=${detections[0]!.segmentId}&framePath=${encodeURIComponent(detections[0]!.framePath!)}&token=${encodeURIComponent(rsaEncrypt(Date.now().toString()))}`}
                        alt={`Detection ${firstDetection!.id}`}
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
            <DialogTitle>{t('detectionInfoTitle')}</DialogTitle>
          </DialogHeader>
          {selectedDetection && (
            <div className="space-y-2">
              <div className="space-y-1 text-sm">
                <p>
                  <strong>{t('cameraId')}:</strong> {cameraInfo?.id}
                </p>
                <p>
                  <strong>{t('segmentId')}:</strong>{' '}
                  {selectedDetection[0]?.segmentId}
                </p>
                <p>
                  <strong>{t('detectionTime')}:</strong>{' '}
                  {new Date(selectedDetection[0]!.frameTime!).toLocaleString()}
                </p>
              </div>
              {selectedDetection.map((detection) => (
                <div
                  key={detection.id}
                  className="rounded-lg border p-4 shadow"
                >
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>{t('category')}:</strong> (
                      {tDetection(detection.targetName! as never) || 'N/A'})
                    </p>
                    <p>
                      <strong>{t('confidence')}:</strong>{' '}
                      {`${((Number(detection.targetConfidence) ?? 0) * 100).toFixed(2)}%`}
                    </p>
                    <p>
                      <strong>{t('coordinates')}:</strong>{' '}
                      {detection.targetLocationX !== undefined &&
                      detection.targetLocationY !== undefined
                        ? `${detection.targetLocationX}, ${detection.targetLocationY}`
                        : 'N/A'}
                    </p>
                    <p>
                      <strong>{t('size')}:</strong>{' '}
                      {detection.targetSizeWidth !== undefined &&
                      detection.targetSizeHeight !== undefined
                        ? `${detection.targetSizeWidth} x ${detection.targetSizeHeight}`
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
            <DialogTitle>{t('detectionFilterTitle')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            <div className="flex items-center space-x-2">
              <label className="w-24 text-sm">
                {t('minConfidenceLabel')}({(minConfidence * 100).toFixed(0)}%)
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
            {/* 全选选项 */}
            <label className="flex cursor-pointer items-center space-x-2">
              <Checkbox
                checked={
                  categories.length > 0 &&
                  selectedCategory.length === categories.length
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedCategory(categories)
                  } else {
                    setSelectedCategory([])
                  }
                }}
              />
              <span>All</span>
            </label>
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
                setMinConfidence(Number(cameraInfo?.detectionConfidence) || 0.3)
                setSelectedCategory(
                  categories.length > 0 ? [categories[0]!] : [],
                )
              }}
            >
              {t('resetButton')}
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
