'use client'

import { components } from '@/api/schema'
import CameraPlayer, { CameraPlayerHandle } from '@/components/camera/camera-player'
import CameraTimeline, { CameraTimelineHandle } from '@/components/camera/camera-timeline'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { openapi } from '@/lib/http'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CirclePause,
  CirclePlay,
  Fullscreen,
  Volume2,
  VolumeOff
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const playerRef = useRef<CameraPlayerHandle>(null) // 播放器引用
  const timelineRef = useRef<CameraTimelineHandle>(null) // 时间轴引用
  const [initialTime, setInitialTime] = useState<number>(0) // 初始时间为两天前
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [progress, setProgress] = useState(initialTime) // 播放进度
  const [playbackRate, setPlaybackRate] = useState(1) // 播放速率

  /* 初始化时间 */
  useEffect(() => {
    setInitialTime(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }, [])

  /* 加载摄像头信息 */
  useEffect(() => {
    const getCameraInfo = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1,
        Condition: [
          { FieldName: 'Id', FieldValue: cameraId, CSharpTypeName: 'long' },
        ],
      }
      const { data } = await openapi.POST('/Camera/Query', { body: body })
      if ((data?.length ?? -1) <= 0) return
      setCameraInfo(data![0])
    }
    params.then((param) => {
      const cameraId = param.camera
      if (!cameraId) return
      getCameraInfo(cameraId).then()
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
    <div className="max-w-8xl mx-auto grid w-full gap-4 rounded-xl md:w-2/3 md:p-8">
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
          <Calendar />
          <p>{new Date(progress).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-10 p-4">
          {/*基础控制*/}
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.videoElement?.requestFullscreen()
              }
            >
              <Fullscreen />
            </Button>
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
            {playerRef.current?.videoElement?.muted ? null : (
              <Slider
                className="w-48"
                defaultValue={[0]}
                max={100}
                step={1}
                onValueChange={(value) => {
                  if (!playerRef.current?.videoElement) return
                  playerRef.current.videoElement.volume = value[0]! / 100
                }}
              />
            )}
          </div>
          {/*快进快退*/}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.seekTo(progress - 3 * 24 * 60 * 60 * 1000)
              }
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.seekTo(progress - 24 * 60 * 60 * 1000)
              }
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.seekTo(progress + 24 * 60 * 60 * 1000)
              }
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                playerRef.current?.seekTo(progress + 3 * 24 * 60 * 60 * 1000)
              }
            >
              <ChevronsRight />
            </Button>
          </div>
          {/*倍速*/}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant={playbackRate === 1 ? 'outline' : 'ghost'}
              onClick={() => setPlaybackRate(1)}
            >
              X1
            </Button>
            <Button
              size="icon"
              variant={playbackRate === 4 ? 'outline' : 'ghost'}
              onClick={() => setPlaybackRate(4)}
            >
              X4
            </Button>
            <Button
              size="icon"
              variant={playbackRate === 8 ? 'outline' : 'ghost'}
              onClick={() => setPlaybackRate(8)}
            >
              X8
            </Button>
            <Button
              size="icon"
              variant={playbackRate === 16 ? 'outline' : 'ghost'}
              onClick={() => setPlaybackRate(16)}
            >
              X16
            </Button>
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
