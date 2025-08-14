'use client'

import { components } from '@/api/schema'
import CameraPlayer, { CameraPlayerHandle } from '@/components/camera/camera-player'
import CameraTimeline, { CameraTimelineHandle } from '@/components/camera/camera-timeline'
import { Button } from '@/components/ui/button'
import { openapi } from '@/lib/http'
import { ChevronsLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const initialTime = Date.now() - 10 * 24 * 60 * 60 * 1000 // 初始时间为两天前
  const playerRef = useRef<CameraPlayerHandle>(null) // 播放器引用
  const timelineRef = useRef<CameraTimelineHandle>(null) // 时间轴引用
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [progress, setProgress] = useState(initialTime) // 播放进度
  const [playbackRate, setPlaybackRate] = useState(1) // 播放速率

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
    playerRef.current?.setPlaybackRate(playbackRate)
  }, [playbackRate])

  return (
    <div className="md:p-8">
      <h1 className="mb-6 text-3xl font-bold">{cameraInfo?.Name || ''}</h1>
      {/*自适应高度*/}
      <div className="mx-auto max-w-6xl rounded-xl">
        {/*播放器*/}
        <CameraPlayer
          ref={playerRef}
          cameraId={cameraInfo?.Id?.toString() ?? ''}
          initialStartTime={initialTime}
          onPlayProgress={(ts) => {
            // setProgress(ts) // 更新进度
            // timelineRef.current?.seekTo(ts) // 同步到时间轴
          }}
          onStartTimeChange={() =>
            playerRef.current?.setPlaybackRate(playbackRate)
          }
        />
        {/*播放器控制*/}
        <p>{new Date(progress).toLocaleString()}</p>
        <div className="flex items-center justify-between gap-4 p-4">
          <Button
            size="icon"
            onClick={() => setProgress(progress - 3 * 24 * 60 * 60 * 1000)}
          >
            <ChevronsLeft />
          </Button>
        </div>
        {/*时间轴*/}
        <CameraTimeline
          ref={timelineRef}
          cameraId={cameraInfo?.Id?.toString() ?? ''}
          initialTime={initialTime}
          onTimeChange={(ts) => {
            setProgress(ts) // 更新进度
            playerRef.current?.seekTo(ts) // 同步到播放器
          }}
        />
      </div>
    </div>
  )
}
