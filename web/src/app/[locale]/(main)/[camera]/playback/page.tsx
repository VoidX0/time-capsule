'use client'

import CameraPlayer, {
  CameraPlayerHandle,
} from '@/components/camera/camera-player'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const [cameraInfo, setCameraInfo] = useState('')
  useEffect(() => {
    params.then(({ camera }) => {
      setCameraInfo(camera)
    })
  }, [params])
  const playerRef = useRef<CameraPlayerHandle>(null)
  const [progress, setProgress] = useState(0)
  const [startTime, setStartTime] = useState(0)

  const jumpToTime = () => {
    // 跳转到指定时间
    const targetTimestamp = new Date('2025-08-05 08:10:00').getTime()
    playerRef.current?.seekTo(targetTimestamp)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-4 text-white md:p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Camera Playback - {cameraInfo || 'Loading...'}
      </h1>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-xl bg-gray-800 p-6">
          {/*<SegmentPlayer />*/}
          <Button onClick={jumpToTime}>跳转</Button>
          播放进度: {new Date(progress).toLocaleString()} <br />
          当前播放源开始时间: {new Date(startTime).toLocaleString()}
          <CameraPlayer
            ref={playerRef}
            cameraId={cameraInfo}
            initialStartTime={new Date('2025-08-05 08:01:00').getTime()}
            segmentDurationSec={60 * 60}
            onPlayProgress={(time) => setProgress(time)}
            onStartTimeChange={(time) => setStartTime(time)}
          />
        </div>
      </div>
    </div>
  )
}
