'use client'

import Hls from 'hls.js'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

export interface CameraPlayerHandle {
  /**
   * 跳转到指定时间戳（毫秒）
   */
  seekTo: (timestampMs: number) => void
}

interface CameraPlayerProps {
  cameraId: string // 摄像头ID
  initialStartTime: number // 毫秒时间戳
  segmentDurationSec?: number // 每个切片时长，秒
  onPlayProgress?: (currentAbsoluteTimeMs: number) => void // 播放进度更新
  onStartTimeChange?: (startTimeMs: number) => void // 播放源切换
}

const CameraPlayer = forwardRef<CameraPlayerHandle, CameraPlayerProps>(
  (
    {
      cameraId,
      initialStartTime,
      segmentDurationSec = 60 * 60,
      onPlayProgress,
      onStartTimeChange,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const hlsRef = useRef<Hls | null>(null)
    const [currentStartTime, setCurrentStartTime] = useState(initialStartTime) // 当前播放源的起始时间戳
    const [, setCurrentPlayTime] = useState(initialStartTime) // 当前播放时间戳

    // 加载指定起点的播放列表
    const loadPlaylist = useCallback(
      (startTime: number) => {
        if (!videoRef.current) return
        // 销毁之前的 HLS 实例
        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
        // 创建新的 HLS 实例
        const hls = new Hls({
          maxBufferLength: 60,
          enableWorker: true,
          liveSyncDurationCount: 3,
          debug: false,
        })
        hlsRef.current = hls
        // 设置视频源 URL
        const m3u8Url = `/api/Video/CameraPlaylist?cameraId=${encodeURIComponent(
          cameraId,
        )}&start=${startTime}&durationSec=${segmentDurationSec}&segmentSec=10`
        // 加载 M3U8 播放列表
        hls.loadSource(m3u8Url)
        hls.attachMedia(videoRef.current)
        // 自动播放
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(console.warn)
        })
        // 处理错误
        hls.on(Hls.Events.ERROR, (_, data) => {
          console.error('HLS error:', data)
        })
      },
      [cameraId, segmentDurationSec],
    )

    // 当 currentStartTime 改变时，重新加载播放列表
    useEffect(() => {
      loadPlaylist(currentStartTime)
    }, [currentStartTime, loadPlaylist])

    // 监听播放源变化
    useEffect(() => {
      onStartTimeChange?.(currentStartTime)
    }, [currentStartTime, onStartTimeChange])

    // 监听播放进度更新
    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      const onTimeUpdate = () => {
        const absTime = currentStartTime + video.currentTime * 1000
        setCurrentPlayTime(absTime)
        onPlayProgress?.(absTime)
      }
      video.addEventListener('timeupdate', onTimeUpdate)
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate)
      }
    }, [currentStartTime, onPlayProgress])

    // 监听播放结束，自动播放下一个时间段
    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      const onEnded = () => {
        const nextStartTime = currentStartTime + segmentDurationSec * 1000
        setCurrentStartTime(nextStartTime)
      }
      video.addEventListener('ended', onEnded)
      return () => {
        video.removeEventListener('ended', onEnded)
      }
    }, [currentStartTime, segmentDurationSec])

    // 对外暴露接口
    useImperativeHandle(
      ref,
      () => ({
        seekTo: (timestampMs: number) => {
          const segmentEnd = currentStartTime + segmentDurationSec * 1000
          if (timestampMs >= currentStartTime && timestampMs < segmentEnd) {
            // 在当前播放源范围内，直接调整视频播放时间
            const seekSec = (timestampMs - currentStartTime) / 1000
            if (videoRef.current) {
              videoRef.current.currentTime = seekSec
            }
          } else {
            // 超出当前播放源范围，重新加载播放源
            setCurrentStartTime(timestampMs)
          }
        },
      }),
      [currentStartTime, segmentDurationSec],
    )

    return (
      <div>
        <video
          ref={videoRef}
          controls
          style={{ width: '100%', background: '#000' }}
          playsInline
        />
      </div>
    )
  },
)

CameraPlayer.displayName = 'CameraPlayer'

export default CameraPlayer
