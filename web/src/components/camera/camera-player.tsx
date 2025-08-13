'use client'

import Hls from 'hls.js'
import React, { useEffect, useRef } from 'react'

interface CameraPlayerProps {
  cameraId: string
  startTime: number
}

const CameraPlayer: React.FC<CameraPlayerProps> = ({ cameraId, startTime }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const m3u8Url = `/api/Video/CameraPlaylist?cameraId=${cameraId}&start=${startTime}&durationSec=1800&segmentSec=10`

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30, // 最大缓冲秒数
        liveSyncDurationCount: 2,
      })
      hls.loadSource(m3u8Url)
      hls.attachMedia(videoRef.current)
      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch((err) => {
          console.warn('Autoplay failed:', err)
        })
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error:', data)
      })
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 原生支持
      videoRef.current.src = m3u8Url
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play()
      })
    }

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [cameraId, startTime])

  return (
    <div>
      <video
        ref={videoRef}
        controls
        style={{ width: '100%', background: '#000' }}
      />
    </div>
  )
}

export default CameraPlayer
