'use client'

import { components } from '@/api/schema'
import { getCameraById } from '@/app/[locale]/(main)/[camera]/camera'
import CameraChart from '@/components/camera/camera-chart'
import DetectionChart from '@/components/camera/detection-chart'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { ArrowUpRight } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']
type Segment = components['schemas']['VideoSegment']

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const locale = useLocale()
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [segments, setSegments] = useState<Segment[]>([]) // 视频切片列表
  const [detectionCount, setDetectionCount] = useState(0) // 检测到的目标数量

  useEffect(() => {
    const getSegments = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 10000,
        Condition: [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
        ],
        Order: [{ FieldName: 'StartTime', OrderByType: 0 }],
      }
      const { data } = await openapi.POST('/Segment/Query', { body })
      if (!data?.length) return
      setSegments(data)
    }

    const getDetectionCount = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1,
        Condition: [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
        ],
      }
      const { data } = await openapi.POST('/Detection/Count', { body })
      if (data) setDetectionCount(data)
    }

    params.then((p) => {
      const cameraId = p.camera
      if (!cameraId) return
      getCameraById(cameraId).then((camera) => setCameraInfo(camera))
      getSegments(cameraId).then()
      getDetectionCount(cameraId).then()
    })
  }, [params])

  const firstSegment = segments.length > 0 ? segments[0] : undefined
  const lastSegment =
    segments.length > 0 ? segments[segments.length - 1] : undefined
  // 总存储空间使用量 GB
  const storageUsed =
    segments.length == 0
      ? 0
      : segments.reduce((sum, seg) => sum + (seg.Size || 0), 0) / 1024
  // 总录制时长 h
  const totalDuration =
    segments.length == 0
      ? 0
      : segments.reduce((sum, seg) => {
          return sum + timeSpanToMilliseconds(seg.DurationActual!)
        }, 0) /
        1000 /
        60 /
        60
  // 录制的天数
  const daysRecorded =
    segments.length == 0
      ? 0
      : new Set(
          segments.map(
            (seg) => new Date(seg.StartTime || '').toISOString().split('T')[0],
          ),
        ).size

  if (!cameraInfo) {
    return (
      <div className="max-w-8xl mx-auto grid w-full gap-6 p-8">
        {/* 标题骨架 */}
        <Skeleton className="mb-6 h-10 w-64" />

        {/* Camera Info Card 骨架 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>

        {/* 统计 Card 骨架 */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-muted/50 space-y-2 rounded-lg p-4">
              <Skeleton className="mb-2 h-5 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>

        {/* Chart 骨架 */}
        <div className="mt-6 space-y-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-8xl mx-auto grid w-full gap-6 p-8">
      <h1 className="text-3xl font-bold">{cameraInfo.Name}</h1>
      {/* Camera Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center justify-between">
              摄像头信息
              <Link href={`/${locale}/cameras`}>
                <ArrowUpRight />
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <p>
            <strong>ID:</strong> {cameraInfo.Id}
          </p>
          <p>
            <strong>存储位置:</strong> {cameraInfo.BasePath}
          </p>
          <p>
            <strong>首次上线:</strong>{' '}
            {new Date(firstSegment?.StartTime ?? '').toLocaleString()}
          </p>
          <p>
            <strong>最后上线:</strong>{' '}
            {new Date(lastSegment?.EndTime ?? '').toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Camera Video Params Card */}
        <Card>
          <CardHeader>
            <CardTitle>视频参数</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p>
              <strong>编码器:</strong> {firstSegment?.VideoCodec}
            </p>
            <p>
              <strong>分辨率:</strong> {firstSegment?.VideoWidth} x{' '}
              {firstSegment?.VideoHeight}
            </p>
            <p>
              <strong>平均帧率:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (seg.VideoFps || 0),
                      0,
                    ) / segments.length
                  ).toFixed(2)
                : 0}{' '}
              fps
            </p>
            <p>
              <strong>平均码率:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (seg.VideoBitrate || 0),
                      0,
                    ) / segments.length
                  ).toFixed(2)
                : 0}{' '}
              kbps
            </p>
          </CardContent>
        </Card>
        {/* Camera Audio Params Card */}
        <Card>
          <CardHeader>
            <CardTitle>音频参数</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p>
              <strong>音频编码器:</strong> {firstSegment?.AudioCodec}
            </p>
            <p>
              <strong>采样率:</strong> {firstSegment?.AudioSampleRate} Hz
            </p>
            <p>
              <strong>声道数:</strong> {firstSegment?.AudioChannels}
            </p>
            <p>
              <strong>平均码率:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (seg.AudioBitrate || 0),
                      0,
                    ) / segments.length
                  ).toFixed(2)
                : 0}{' '}
              kbps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segments Statistics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>录制天数</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker value={daysRecorded} className="text-2xl font-bold" />{' '}
            天
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                检测目标
                <Link href={`/${locale}/${cameraInfo.Id}/detections`}>
                  <ArrowUpRight />
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={Number(
                detectionCount > 1000
                  ? detectionCount > 1000000
                    ? (detectionCount / 1000000).toFixed(2)
                    : (detectionCount / 1000).toFixed(2)
                  : detectionCount.toFixed(0),
              )}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />
            {detectionCount > 1000
              ? detectionCount > 1000000
                ? ' M'
                : ' K'
              : ' 个'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                录制时长
                <Link href={`/${locale}/${cameraInfo.Id}/playback`}>
                  <ArrowUpRight />
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={totalDuration}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />{' '}
            h
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天时长</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={daysRecorded > 0 ? totalDuration / daysRecorded : 0}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />{' '}
            h
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                片段数量
                <Link href={`/${locale}/${cameraInfo.Id}/segments`}>
                  <ArrowUpRight />
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={segments.length}
              className="text-2xl font-bold"
            />{' '}
            个
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天片段</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={daysRecorded > 0 ? segments.length / daysRecorded : 0}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />{' '}
            个
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>存储空间</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={storageUsed}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />{' '}
            GB
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天存储</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={daysRecorded > 0 ? storageUsed / daysRecorded : 0}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />{' '}
            GB
          </CardContent>
        </Card>
      </div>
      {/*chart*/}
      <div className="space-y-6">
        <CameraChart cameraId={cameraInfo.Id?.toString()} />
        <DetectionChart cameraId={cameraInfo.Id?.toString()} />
      </div>
    </div>
  )
}
