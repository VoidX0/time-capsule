'use client'

import FlvJs from 'flv.js'
import { useEffect, useRef } from 'react'
import Player = FlvJs.Player

export default function SegmentPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Player | null>(null)

  const loadStream = () => {
    if (!videoRef.current) return
    // 销毁旧播放器实例
    if (playerRef.current) playerRef.current.destroy()
    // 创建新播放器
    playerRef.current = FlvJs.createPlayer({
      type: 'flv',
      isLive: false,
      url: `/api/Video/StreamSegment?cameraId=1952571427730677769&segmentId=1952625044269490183`,
    })
    try {
      // 绑定视频元素并加载流
      playerRef.current.attachMediaElement(videoRef.current)
      playerRef.current.load()
    } catch (error) {
      console.error('Error loading FLV stream:', error)
      return
    }
  }

  useEffect(() => {
    if (!FlvJs.isSupported() || !videoRef.current) return
    // 加载流
    loadStream()
    // 清理函数
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-contain"
      autoPlay
      controls
    >
      Your browser does not support the video tag.
    </video>
  )
}
