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
import { useLocale, useTranslations } from 'next-intl'
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
  const t = useTranslations('CameraDashboardPage')
  const locale = useLocale()
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [segments, setSegments] = useState<Segment[]>([]) // 视频切片列表
  const [detectionCount, setDetectionCount] = useState(0) // 检测到的目标数量

  useEffect(() => {
    const getSegments = async (cameraId: string) => {
      const body: QueryDto = {
        pageNumber: 1,
        pageSize: 10000,
        condition: [
          {
            fieldName: 'CameraId',
            fieldValue: cameraId,
            cSharpTypeName: 'long',
          },
        ],
        order: [{ fieldName: 'StartTime', orderByType: 0 }],
      }
      const { data } = await openapi.POST('/Segment/Query', { body })
      if (!data?.items.length) return
      setSegments(data?.items)
    }

    const getDetectionCount = async (cameraId: string) => {
      const body: QueryDto = {
        pageNumber: 1,
        pageSize: 1,
        condition: [
          {
            fieldName: 'CameraId',
            fieldValue: cameraId,
            cSharpTypeName: 'long',
          },
        ],
      }
      const { data } = await openapi.POST('/Detection/Count', { body })
      if (data) setDetectionCount(Number(data))
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
      : segments.reduce((sum, seg) => sum + (Number(seg.size) || 0), 0) / 1024
  // 总录制时长 h
  const totalDuration =
    segments.length == 0
      ? 0
      : segments.reduce((sum, seg) => {
          return sum + timeSpanToMilliseconds(seg.durationActual!)
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
            (seg) => new Date(seg.startTime || '').toISOString().split('T')[0],
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
      <h1 className="text-3xl font-bold">{cameraInfo.name}</h1>
      {/* Camera Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center justify-between">
              {t('cameraInfo')}
              <Link href={`/${locale}/cameras`}>
                <ArrowUpRight />
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <p>
            <strong>ID:</strong> {cameraInfo.id}
          </p>
          <p>
            <strong>{t('basePath')}:</strong> {cameraInfo.basePath}
          </p>
          <p>
            <strong>{t('firstOnline')}:</strong>{' '}
            {new Date(firstSegment?.startTime ?? '').toLocaleString()}
          </p>
          <p>
            <strong>{t('lastOnline')}:</strong>{' '}
            {new Date(lastSegment?.endTime ?? '').toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Camera Video Params Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('videoParams')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p>
              <strong>{t('videoCodec')}:</strong> {firstSegment?.videoCodec}
            </p>
            <p>
              <strong>{t('resolution')}:</strong> {firstSegment?.videoWidth} x{' '}
              {firstSegment?.videoHeight}
            </p>
            <p>
              <strong>{t('avgFps')}:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (Number(seg.videoFps) || 0),
                      0,
                    ) / segments.length
                  ).toFixed(2)
                : 0}{' '}
              fps
            </p>
            <p>
              <strong>{t('avgBitrate')}:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (Number(seg.videoBitrate) || 0),
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
            <CardTitle>{t('audioParams')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p>
              <strong>{t('audioCodec')}:</strong> {firstSegment?.audioCodec}
            </p>
            <p>
              <strong>{t('sampleRate')}</strong> {firstSegment?.audioSampleRate}{' '}
              Hz
            </p>
            <p>
              <strong>{t('channels')}:</strong> {firstSegment?.audioChannels}
            </p>
            <p>
              <strong>{t('avgBitrate')}:</strong>{' '}
              {segments.length > 0
                ? (
                    segments.reduce(
                      (sum, seg) => sum + (Number(seg.audioBitrate) || 0),
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
            <CardTitle>{t('daysRecorded')}</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker value={daysRecorded} className="text-2xl font-bold" />{' '}
            {t('dayUnit')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                {t('detections')}
                <Link href={`/${locale}/${cameraInfo.id}/detections`}>
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
              : ''}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                {t('recordDuration')}
                <Link href={`/${locale}/${cameraInfo.id}/playback`}>
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
            <CardTitle>{t('avgDailyDuration')}</CardTitle>
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
                {t('segmentCount')}
                <Link href={`/${locale}/${cameraInfo.id}/segments`}>
                  <ArrowUpRight />
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={segments.length}
              className="text-2xl font-bold"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('avgDailySegment')}</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberTicker
              value={daysRecorded > 0 ? segments.length / daysRecorded : 0}
              className="text-2xl font-bold"
              decimalPlaces={2}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('storageUsed')}</CardTitle>
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
            <CardTitle>{t('avgDailyStorage')}</CardTitle>
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
        <CameraChart cameraId={cameraInfo.id?.toString()} />
        <DetectionChart cameraId={cameraInfo.id?.toString()} />
      </div>
    </div>
  )
}
