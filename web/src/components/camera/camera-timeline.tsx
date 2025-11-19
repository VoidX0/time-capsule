'use client'

import { components, paths } from '@/api/schema'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { openapi } from '@/lib/http'
import { CircleAlert, CircleDot, CircleX, Info } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

type GetTimelineQuery =
  paths['/Camera/GetTimeline']['get']['parameters']['query']
type Timeline = components['schemas']['Timeline']

export interface CameraTimelineHandle {
  /**
   * 跳转到指定时间戳
   * @param timestampMs 时间戳，单位毫秒
   */
  seekTo: (timestampMs: number) => void
}

interface CameraTimelineProps {
  cameraId: string // 摄像头ID
  initialTime: number // 初始时间戳，单位毫秒
  onTimeChange?: (ts: number) => void // 时间开始调整
  onTimeCommit?: (ts: number) => void // 时间调整完成
}

/* 聚类方法：按时间排序 & 按像素距离归类 */
function clusterTimeline(
  events: Timeline[],
  containerWidth: number, // 容器宽度，用于按像素聚类
  viewport: { min: number; max: number },
  maxPointPx = 40, // 最大像素间隔，低于该值归为同一类
) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime(),
  )
  const clusters: Timeline[][] = []
  let cluster: Timeline[] = []

  for (const item of sorted) {
    if (cluster.length === 0) {
      cluster.push(item)
    } else {
      const last = cluster[cluster.length - 1]
      if (!last) continue // 防止空聚类

      // 计算当前事件与上一个事件在屏幕上的像素距离
      const lastX =
        ((new Date(last.time!).getTime() - viewport.min) /
          (viewport.max - viewport.min)) *
        containerWidth
      const currentX =
        ((new Date(item.time!).getTime() - viewport.min) /
          (viewport.max - viewport.min)) *
        containerWidth

      if (currentX - lastX <= maxPointPx) {
        cluster.push(item)
      } else {
        clusters.push(cluster)
        cluster = [item]
      }
    }
  }
  if (cluster.length) clusters.push(cluster)

  return clusters
}

const CameraTimeline = forwardRef<CameraTimelineHandle, CameraTimelineProps>(
  ({ cameraId, initialTime, onTimeChange, onTimeCommit }, ref) => {
    const [timeline, setTimeline] = useState<Timeline[]>([]) // 摄像头时间线数据
    const [currentTime, setCurrentTime] = useState(initialTime) // 当前时间戳
    const [containerWidth, setContainerWidth] = useState(1)

    // viewport 表示事件区的展示窗口
    const [viewport, setViewport] = useState({
      min: initialTime - 2 * 60 * 60 * 1000,
      max: initialTime + 22 * 60 * 60 * 1000,
    })

    const [selectedCluster, setSelectedCluster] = useState<
      Timeline[] | undefined
    >(undefined) // 选中的聚类事件

    // 拖动相关
    const dragging = useRef(false) // 是否正在拖动
    const lastX = useRef(0) // 上一次鼠标位置，用于计算拖动距离
    const containerRef = useRef<HTMLDivElement>(null) // 时间轴容器引用

    /* 获取时间线数据 */
    useEffect(() => {
      const getTimeline = async () => {
        const query: GetTimelineQuery = { cameraId }
        const { data } = await openapi.GET('/Camera/GetTimeline', {
          params: { query },
        })
        return data
      }
      if (!cameraId) return
      getTimeline().then((data) => setTimeline(data ?? []))
    }, [cameraId])

    /* 监听容器宽度变化 */
    useLayoutEffect(() => {
      const updateWidth = () => {
        if (containerRef.current) {
          setContainerWidth(containerRef.current.offsetWidth)
        }
      }
      updateWidth()
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }, [])

    /* currentTime 变化时，调整 viewport */
    useEffect(() => {
      setViewport((v) => {
        const viewportWidth = v.max - v.min
        const buffer = viewportWidth * 0.3
        let { min, max } = v

        if (currentTime > max - buffer) {
          const shift = currentTime - (max - buffer)
          min += shift
          max += shift
        } else if (currentTime < min + buffer) {
          const shift = min + buffer - currentTime
          min -= shift
          max -= shift
        }

        return { min, max }
      })
    }, [currentTime])

    /* 事件区拖动 */
    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return
        const deltaPx = e.clientX - lastX.current
        lastX.current = e.clientX
        const width = containerRef.current.offsetWidth
        const deltaMs = (deltaPx / width) * (viewport.max - viewport.min)
        setViewport((v) => ({
          min: v.min - deltaMs,
          max: v.max - deltaMs,
        }))
      }
      const onMouseUp = () => {
        dragging.current = false
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
    }, [viewport])

    /* 对外暴露接口 */
    useImperativeHandle(ref, () => ({
      seekTo: (timestampMs: number) => {
        setCurrentTime(timestampMs)
      },
    }))

    // 使用按像素聚类的方法
    const clusters = clusterTimeline(
      (timeline ?? []).filter(
        (item) =>
          new Date(item.time!).getTime() >= viewport.min &&
          new Date(item.time!).getTime() <= viewport.max,
      ),
      containerWidth,
      viewport,
      40, // 最大像素间隔，可调
    )

    return (
      <div>
        {/* Slider */}
        <Slider
          value={[currentTime]}
          min={viewport.min}
          max={viewport.max}
          step={1000}
          onValueChange={(val) => {
            onTimeChange?.(val[0]!)
            setCurrentTime(val[0]!)
          }}
          onValueCommit={(val) => {
            onTimeCommit?.(val[0]!)
          }}
        />
        {/* 时间轴 */}
        <div
          ref={containerRef}
          className="relative mt-8 h-60 overflow-hidden select-none"
          onMouseDown={(e) => {
            dragging.current = true
            lastX.current = e.clientX
          }}
          // 触摸事件处理
          onTouchStart={(e) => {
            dragging.current = true
            lastX.current = e.touches[0]?.clientX ?? 0
          }}
          onTouchMove={(e) => {
            if (!dragging.current || !containerRef.current) return
            const deltaPx = (e.touches[0]?.clientX ?? 0) - lastX.current
            lastX.current = e.touches[0]?.clientX ?? 0
            const width = containerRef.current.offsetWidth
            const deltaMs = (deltaPx / width) * (viewport.max - viewport.min)
            setViewport((v) => ({
              min: v.min - deltaMs,
              max: v.max - deltaMs,
            }))
          }}
          onTouchEnd={() => {
            dragging.current = false
          }}
        >
          {/* 中心线 */}
          <div className="absolute top-4 right-0 left-0 border-t-2" />

          {/* eslint-disable-next-line react-hooks/refs */}
          {clusters.map((group, index) => {
            const first = group[0]
            if (!first) return null

            // 计算事件在屏幕上的百分比位置
            const positionPercent =
              ((new Date(first.time!).getTime() - viewport.min) /
                (viewport.max - viewport.min)) *
              100

            const isActive =
              Math.abs(currentTime - new Date(first.time!).getTime()) <
              30 * 1000

            const pointWidth = 120 // 子元素 max-width，px
            const containerWidth = containerRef.current?.offsetWidth ?? 1

            // 根据百分比计算初步像素位置
            let leftPx = (positionPercent / 100) * containerWidth

            // 限制左边界
            leftPx = Math.max(leftPx, pointWidth / 2)
            // 限制右边界
            leftPx = Math.min(leftPx, containerWidth - pointWidth / 2)

            return (
              <div
                key={index}
                onClick={() => {
                  if (group.length === 1) {
                    // 单个事件，直接跳转
                    onTimeChange?.(new Date(first.time!).getTime())
                    setCurrentTime(new Date(first.time!).getTime())
                    onTimeCommit?.(new Date(first.time!).getTime())
                  } else {
                    // 聚类事件，显示聚类详情
                    setSelectedCluster(group)
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${leftPx}px`, // 安全像素位置
                  transform: 'translateX(-50%)', // 保持居中
                }}
                className="flex cursor-pointer flex-col items-center text-center"
              >
                {/* 聚类点 / 单点显示 */}
                {group.length > 1 ? (
                  <div className="bg-accent absolute top-4 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs">
                    {group.length}
                  </div>
                ) : (
                  <div
                    className={`absolute top-4 h-3 w-3 -translate-y-1/2 rounded-full border-2 transition-all ${
                      isActive
                        ? 'bg-primary border-primary scale-125'
                        : 'bg-background border-primary'
                    }`}
                  />
                )}

                {/* 内容 */}
                <div className="mt-8 max-w-[120px] space-y-2 text-xs sm:max-w-[160px] sm:text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-accent flex h-9 w-9 items-center justify-center rounded-full">
                      {first.level === 'verbose' && (
                        <CircleDot className="text-muted-foreground h-5 w-5" />
                      )}
                      {first.level === 'info' && (
                        <Info className="h-5 w-5 text-blue-500" />
                      )}
                      {first.level === 'warning' && (
                        <CircleAlert className="h-5 w-5 text-yellow-500" />
                      )}
                      {first.level === 'error' && (
                        <CircleX className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{first.title}</h3>
                    <div className="mt-1 flex rotate-45 items-center justify-center gap-2 text-sm">
                      <span>{new Date(first.time!).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {first.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        {/* 聚类详情 */}
        <Dialog
          open={!!selectedCluster}
          onOpenChange={(open) => !open && setSelectedCluster(undefined)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>事件详情 ({selectedCluster?.length})</DialogTitle>
            </DialogHeader>
            <div className="mt-4 max-h-[400px] space-y-4 overflow-y-auto">
              {selectedCluster?.map((item, idx) => (
                <div
                  key={idx}
                  className="hover:bg-muted/10 cursor-pointer rounded border-b p-2 pb-2 last:border-b-0"
                  onClick={() => {
                    onTimeChange?.(new Date(item.time!).getTime())
                    setCurrentTime(new Date(item.time!).getTime())
                    onTimeCommit?.(new Date(item.time!).getTime())
                    setSelectedCluster(undefined)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-muted-foreground text-sm">
                      {new Date(item.time!).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                  {item.level === 'verbose' && (
                    <Badge variant="secondary" className="mt-1 rounded-full">
                      {item.level}
                    </Badge>
                  )}
                  {item.level === 'info' && (
                    <Badge
                      variant="secondary"
                      className="mt-1 rounded-full text-blue-500"
                    >
                      {item.level}
                    </Badge>
                  )}
                  {item.level === 'warning' && (
                    <Badge
                      variant="secondary"
                      className="mt-1 rounded-full text-yellow-500"
                    >
                      {item.level}
                    </Badge>
                  )}
                  {item.level === 'error' && (
                    <Badge
                      variant="secondary"
                      className="mt-1 rounded-full text-red-500"
                    >
                      {item.level}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <DialogClose asChild>
              <button className="mt-4 w-full rounded px-4 py-2">关闭</button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    )
  },
)

CameraTimeline.displayName = 'CameraTimeline'

export default CameraTimeline
