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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { openapi } from '@/lib/http'
import { Calendar, CircleAlert, CircleDot, CircleX, Info } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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

/* 聚类方法：按时间排序 & 按 thresholdMs 归类 */
function clusterTimeline(events: Timeline[], thresholdMs: number) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.Time!).getTime() - new Date(b.Time!).getTime(),
  )
  const clusters: Timeline[][] = []
  let cluster: Timeline[] = []

  for (const item of sorted) {
    if (cluster.length === 0) {
      cluster.push(item)
    } else {
      const last = cluster[cluster.length - 1]
      if (!last) continue // 防止空聚类
      if (
        new Date(item.Time!).getTime() - new Date(last.Time!).getTime() <=
        thresholdMs
      ) {
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
    const scrollTimeout = useRef<NodeJS.Timeout | undefined>(undefined) // 滚动结束后的延时处理
    const [timeline, setTimeline] = useState<Timeline[] | undefined>(undefined) // 摄像头时间线数据
    const [currentTime, setCurrentTime] = useState(initialTime) // 当前时间戳
    const [minTime, setMinTime] = useState(initialTime - 2 * 60 * 60 * 1000) // 最小时间戳
    const [maxTime, setMaxTime] = useState(initialTime + 22 * 60 * 60 * 1000) // 最大时间戳
    const [selectedCluster, setSelectedCluster] = useState<
      Timeline[] | undefined
    >(undefined)

    /* 获取摄像头时间线数据 */
    useEffect(() => {
      const getTimeline = async () => {
        const query: GetTimelineQuery = { cameraId: cameraId }
        const { data } = await openapi.GET('/Camera/GetTimeline', {
          params: { query: query },
        })
        return data
      }
      if (!cameraId) return
      getTimeline().then((data) => setTimeline(data))
    }, [cameraId, maxTime, minTime])

    /* 监控当前时间戳变化, 触发通知并调整时间范围 */
    useEffect(() => {
      const hours2 = 2 * 60 * 60 * 1000
      if (currentTime - minTime < hours2) {
        setMinTime(minTime - hours2)
        setMaxTime(maxTime - hours2)
      }
      if (maxTime - currentTime < hours2) {
        setMinTime(minTime + hours2)
        setMaxTime(maxTime + hours2)
      }
    }, [currentTime, maxTime, minTime])

    /* 滚轮滚动事件 */
    useEffect(() => {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (e.shiftKey) {
          const delta = e.deltaY > 0 ? 10 * 60 * 1000 : -10 * 60 * 1000
          const newMinTime = minTime - delta
          const newMaxTime = maxTime + delta
          if (newMaxTime - newMinTime < 6 * 60 * 60 * 1000) return
          if (newMaxTime - newMinTime > 30 * 24 * 60 * 60 * 1000) return
          setMinTime(newMinTime)
          setMaxTime(newMaxTime)
        } else {
          // 滚动开始，触发时间变更，清除定时器
          onTimeChange?.(currentTime)
          if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
          // 处理时间滚动
          const delta = e.deltaY > 0 ? 10 * 60 * 1000 : -10 * 60 * 1000
          setCurrentTime((prev) => prev + delta)
          // 滚动结束，初始化定时器
          scrollTimeout.current = setTimeout(
            () => onTimeCommit?.(currentTime),
            500,
          )
        }
      }
      window.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        window.removeEventListener('wheel', handleWheel)
      }
    }, [currentTime, maxTime, minTime, onTimeChange, onTimeCommit])

    /* 对外暴露接口 */
    useImperativeHandle(ref, () => ({
      seekTo: (timestampMs: number) => {
        setCurrentTime(timestampMs)
      },
    }))

    /* 过滤 + 聚类 */
    const clusters = clusterTimeline(
      (timeline ?? []).filter(
        (item) =>
          new Date(item.Time!).getTime() >= minTime &&
          new Date(item.Time!).getTime() <= maxTime,
      ),
      60 * 60 * 1000, // 60分钟内的事件归为一类
    )

    return (
      <TooltipProvider>
        {/* Slider */}
        <div className="w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Slider
                value={[currentTime]}
                min={minTime}
                max={maxTime}
                step={1000}
                onValueChange={(val) => {
                  onTimeChange?.(currentTime)
                  setCurrentTime(val[0]!)
                }}
                onValueCommit={(val) => onTimeCommit?.(val[0]!)}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col items-center space-y-1">
                <p>{new Date(currentTime).toLocaleString()}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 时间轴 */}
        <div className="mt-8">
          <div className="relative">
            {/*时间线*/}
            <div className="absolute top-4 right-0 left-0 border-t-2" />
            {/* 时间轴上的聚类点 */}
            {clusters.map((group, index) => {
              const first = group[0]
              if (!first) return null // 防止空聚类
              // 30秒内的事件视为当前活动事件
              const isActive =
                Math.abs(currentTime - new Date(first.Time!).getTime()) <
                30 * 1000
              const positionPercent =
                ((new Date(first.Time!).getTime() - minTime) /
                  (maxTime - minTime)) *
                100

              return (
                <div
                  key={index}
                  onClick={() => {
                    if (group.length === 1) {
                      // 单个事件，直接跳转
                      onTimeChange?.(currentTime)
                      setCurrentTime(new Date(first.Time!).getTime())
                      onTimeCommit?.(new Date(first.Time!).getTime())
                    } else {
                      setSelectedCluster(group) // 多个事件，显示聚类详情
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: `${positionPercent}%`, // 计算位置百分比
                    transform: 'translateX(-50%)', // 居中对齐
                  }}
                  className="flex cursor-pointer flex-col items-center text-center"
                >
                  {/* 圆点/聚合 */}
                  {group.length > 1 ? (
                    <div className="absolute top-4 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs">
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
                  <div className="mt-8 w-40 space-y-2">
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-accent flex h-9 w-9 items-center justify-center rounded-full">
                        {first.Level === 'verbose' && (
                          <CircleDot className="text-muted-foreground h-5 w-5" />
                        )}
                        {first.Level === 'info' && (
                          <Info className="h-5 w-5 text-blue-500" />
                        )}
                        {first.Level === 'warning' && (
                          <CircleAlert className="h-5 w-5 text-yellow-500" />
                        )}
                        {first.Level === 'error' && (
                          <CircleX className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{first.Title}</h3>
                      <div className="mt-1 flex items-center justify-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(first.Time!).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {first.Description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 聚类详细信息弹窗 */}
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
                    // 点击事件，跳转到对应时间
                    onTimeChange?.(currentTime)
                    setCurrentTime(new Date(item.Time!).getTime())
                    onTimeCommit?.(currentTime)
                    // 关闭弹窗
                    setSelectedCluster(undefined)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.Title}</span>
                    <span className="text-muted-foreground text-sm">
                      {new Date(item.Time!).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {item.Description}
                  </p>
                  <Badge variant="secondary" className="mt-1 rounded-full">
                    {item.Level}
                  </Badge>
                </div>
              ))}
            </div>
            <DialogClose asChild>
              <button className="mt-4 w-full rounded px-4 py-2">关闭</button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    )
  },
)

CameraTimeline.displayName = 'CameraTimeline'

export default CameraTimeline
