'use client'

import { components } from '@/api/schema'
import { getCameraById } from '@/app/[locale]/(main)/[camera]/camera'
import CameraPlayer, {
  CameraPlayerHandle,
} from '@/components/camera/camera-player'
import CameraTimeline, {
  CameraTimelineHandle,
} from '@/components/camera/camera-timeline'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Calendar as CalendarIcon,
  CirclePause,
  CirclePlay,
  Fullscreen,
  Volume2,
  VolumeOff,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Camera = components['schemas']['Camera']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const playerRef = useRef<CameraPlayerHandle>(null) // 播放器引用
  const timelineRef = useRef<CameraTimelineHandle>(null) // 时间轴引用
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [initialTime, setInitialTime] = useState(0) // 初始时间
  const [progress, setProgress] = useState(0) // 播放进度
  const [playbackRate, setPlaybackRate] = useState(1) // 播放速率
  const [calendarOpen, setCalendarOpen] = useState(false) // 日历弹窗状态

  /* 初始化时间 */
  useEffect(() => {
    const ts = Date.now() - 2 * 24 * 60 * 60 * 1000
    setInitialTime(ts) // 设置初始时间
    setProgress(ts) // 设置进度为初始时间
  }, [])

  /* 加载摄像头信息 */
  useEffect(() => {
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => setCameraInfo(camera))
    })
  }, [params])

  /* 设置播放速率 */
  useEffect(() => {
    if (!playerRef.current?.videoElement?.playbackRate) return
    playerRef.current.videoElement.playbackRate = playbackRate
  }, [playbackRate])

  // 等待初始时间准备好
  if (initialTime == 0 || cameraInfo == undefined) {
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
    <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl p-8 md:w-2/3">
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.Name || ''}</h1>
      {/*播放器*/}
      <CameraPlayer
        ref={playerRef}
        cameraId={cameraInfo?.Id?.toString() ?? ''}
        initialStartTime={initialTime}
        onPlayProgress={(ts) => {
          setProgress(ts) // 更新进度
          timelineRef.current?.seekTo(ts) // 同步到时间轴
        }}
        onStartTimeChange={() => {
          if (!playerRef.current?.videoElement?.playbackRate) return
          playerRef.current.videoElement.playbackRate = playbackRate
        }}
      />
      {/*播放器控制*/}
      <div className="bg-muted/50 rounded-xl">
        <div className="flex flex-wrap items-center justify-center gap-2 p-4">
          <CalendarIcon />
          <p>{new Date(progress).toLocaleString()}</p>
        </div>
        {/*控制*/}
        <div className="flex flex-col items-center gap-2 p-4">
          <div className="flex items-center gap-2">
            {/*播放/暂停*/}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (playerRef.current?.videoElement?.paused) {
                  playerRef.current?.videoElement?.play().catch(console.warn)
                } else {
                  playerRef.current?.videoElement?.pause()
                }
              }}
            >
              {playerRef.current?.videoElement?.paused ? (
                <CirclePlay />
              ) : (
                <CirclePause />
              )}
            </Button>
            {/*全屏*/}
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.videoElement?.requestFullscreen()
              }
            >
              <Fullscreen />
            </Button>
            {/*静音*/}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (playerRef.current?.videoElement == null) return
                playerRef.current.videoElement.muted =
                  !playerRef.current.videoElement.muted
              }}
            >
              {playerRef.current?.videoElement?.muted ? (
                <VolumeOff />
              ) : (
                <Volume2 />
              )}
            </Button>
            {/*音量控制*/}
            <Slider
              className="w-40"
              defaultValue={[0]}
              max={100}
              step={1}
              disabled={playerRef.current?.videoElement?.muted} // 静音时禁用
              onValueChange={(value) => {
                if (!playerRef.current?.videoElement) return
                playerRef.current.videoElement.volume = value[0]! / 100
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* 倍速下拉选择 */}
            <Select
              value={playbackRate.toString()}
              onValueChange={(val) => setPlaybackRate(Number(val))}
            >
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1X</SelectItem>
                <SelectItem value="4">4X</SelectItem>
                <SelectItem value="8">8X</SelectItem>
                <SelectItem value="16">16X</SelectItem>
              </SelectContent>
            </Select>
            {/* 日期选择 */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="outline">
                  <CalendarIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={new Date(progress)}
                  onSelect={(date) => {
                    if (!date) return
                    const ts = date.getTime()
                    playerRef.current?.seekTo(ts)
                    setCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      {/*时间轴*/}
      <CameraTimeline
        ref={timelineRef}
        cameraId={cameraInfo?.Id?.toString() ?? ''}
        initialTime={initialTime}
        onTimeChange={() => playerRef.current?.videoElement?.pause()}
        onTimeCommit={(ts) => {
          playerRef.current?.seekTo(ts)
          playerRef.current?.videoElement?.play().catch(console.warn)
        }}
      />
    </div>
  )
}
