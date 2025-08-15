'use client'

import { components } from '@/api/schema'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { ArrowUpRight } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']
type Segment = components['schemas']['VideoSegment']

const chartConfig = {
  views: {
    label: '新增',
  },
  storage: {
    label: '存储',
    color: '#4f46e5',
  },
  segment: {
    label: '片段',
    color: '#16a34a',
  },
  duration: {
    label: '时长',
    color: '#f59e0b',
  },
} satisfies ChartConfig

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const locale = useLocale()
  const [cameraInfo, setCameraInfo] = useState<Camera | undefined>(undefined) // 摄像头信息
  const [segments, setSegments] = useState<Segment[]>([]) // 视频切片列表
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>('storage') // 激活的图表
  const [chartData, setChartData] = useState<
    { date: string; storage: number; segment: number; duration: number }[]
  >([])

  const total = useMemo(
    () => ({
      storage: chartData
        .reduce((acc, curr) => acc + curr.storage, 0)
        .toFixed(2),
      segment: chartData.reduce((acc, curr) => acc + curr.segment, 0),
      duration: chartData
        .reduce((acc, curr) => acc + curr.duration, 0)
        .toFixed(2),
    }),
    [chartData],
  )

  useEffect(() => {
    const getCameraInfo = async (cameraId: string) => {
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1,
        Condition: [
          { FieldName: 'Id', FieldValue: cameraId, CSharpTypeName: 'long' },
        ],
      }
      const { data } = await openapi.POST('/Camera/Query', { body })
      if (data?.length) setCameraInfo(data[0])
    }

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
      calculateChartData(data)
    }
    // 计算图表数据
    const calculateChartData = (segments: Segment[]) => {
      const groupedData: Record<
        string,
        { storage: number; segment: number; duration: number }
      > = {}
      segments.forEach((seg) => {
        const dateKey = new Date(seg.StartTime!).toISOString().split('T')[0]
        if (!groupedData[dateKey!]) {
          groupedData[dateKey!] = { storage: 0, segment: 0, duration: 0 }
        }
        groupedData[dateKey!]!.storage += (seg.Size || 0) / 1024 // 转换为 GB
        groupedData[dateKey!]!.segment += 1
        groupedData[dateKey!]!.duration +=
          timeSpanToMilliseconds(seg.DurationActual!) / 1000 / 60 / 60 // 转换为小时
      })
      const chartData = Object.entries(groupedData).map(([date, values]) => ({
        date,
        storage: values.storage,
        segment: values.segment,
        duration: values.duration,
      }))
      setChartData(chartData)
    }

    params.then((p) => {
      const cameraId = p.camera
      if (!cameraId) return
      getCameraInfo(cameraId).then()
      getSegments(cameraId).then()
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
      <div className="flex h-96 items-center justify-center">
        <p>Loading camera...</p>
      </div>
    )
  }

  return (
    <div className="max-w-8xl mx-auto grid w-full gap-6 p-8 md:w-2/3">
      <h1 className="text-3xl font-bold">{cameraInfo.Name}</h1>

      {/* Camera Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center justify-between">
              摄像头信息
              <Link href={`/${locale}/${cameraInfo.Id}/settings`}>
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
                    (segments.reduce(
                      (sum, seg) => sum + (seg.AudioBitrate || 0),
                      0,
                    ) /
                      segments.length) *
                    1000
                  ).toFixed(2)
                : 0}{' '}
              bps
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
            <p className="text-2xl font-bold">{daysRecorded} 天</p>
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
            <p className="text-2xl font-bold">{totalDuration.toFixed(2)} h</p>
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
            <p className="text-2xl font-bold">{segments.length} 个</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>存储空间</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{storageUsed.toFixed(2)} GB</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天时长</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {daysRecorded > 0 ? (totalDuration / daysRecorded).toFixed(2) : 0}{' '}
              h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每段时长</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {segments.length > 0
                ? (totalDuration / segments.length).toFixed(2)
                : 0}{' '}
              h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天片段</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {segments.length > 0
                ? (segments.length / daysRecorded).toFixed(2)
                : 0}{' '}
              个
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>平均每天存储</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(segments.length > 0 ? storageUsed / daysRecorded : 0).toFixed(
                2,
              )}{' '}
              GB
            </p>
          </CardContent>
        </Card>
      </div>
      {/*chart*/}
      <Card>
        <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
            <CardTitle>每日趋势</CardTitle>
            <CardDescription>
              摄像头每日存储空间、片段数量和录制时长
            </CardDescription>
          </div>
          <div className="flex">
            {['storage', 'segment', 'duration'].map((key) => {
              const chart = key as keyof typeof chartConfig
              return (
                <button
                  key={chart}
                  data-active={activeChart === chart}
                  className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                  onClick={() => setActiveChart(chart)}
                >
                  <span className="text-muted-foreground text-xs">
                    {chartConfig[chart].label}
                  </span>
                  <span className="text-xl leading-none font-bold sm:text-3xl">
                    {total[key as keyof typeof total].toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:p-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString()
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    nameKey="views"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString()
                    }}
                  />
                }
              />
              <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
