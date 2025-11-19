'use client'

import { components } from '@/api/schema'
import { getCameras } from '@/app/[locale]/(main)/[camera]/camera'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

type Camera = components['schemas']['Camera']
type Segment = components['schemas']['VideoSegment']

type CameraSummary = {
  camera: Camera
  segments: Segment[]
  days: number
  totalStorage: number
  totalDuration: number
  segmentCount: number
  chartData: { date: string; storage: number }[]
}
const chartConfig = {
  views: {
    label: '存储',
  },
} satisfies ChartConfig

export default function Page() {
  const t = useTranslations('DashboardPage')
  const locale = useLocale()
  const [summaries, setSummaries] = useState<CameraSummary[]>([]) // 摄像头汇总信息

  useEffect(() => {
    const fetchAll = async () => {
      // 获取全部摄像头
      const cameras = await getCameras()
      const summariesArr: CameraSummary[] = []
      for (const cam of cameras ?? []) {
        // 查询该摄像头的切片
        const { data: segs } = await openapi.POST('/Segment/Query', {
          body: {
            pageNumber: 1,
            pageSize: 10000,
            condition: [
              {
                fieldName: 'CameraId',
                fieldValue: cam.id?.toString(),
                cSharpTypeName: 'long',
              },
            ],
            order: [{ fieldName: 'StartTime', orderByType: 0 }],
          },
        })
        const segments: Segment[] = segs || []

        // 汇总
        const daysRecorded =
          segments.length === 0
            ? 0
            : new Set(
                segments.map(
                  (s) =>
                    new Date(s.startTime || '').toISOString().split('T')[0],
                ),
              ).size
        const totalStorage =
          segments.reduce((sum, s) => sum + (Number(s.size) || 0), 0) / 1024
        const totalDuration =
          segments.reduce(
            (sum, s) => sum + timeSpanToMilliseconds(s.durationActual!),
            0,
          ) /
          1000 /
          3600
        const chartData: { date: string; storage: number }[] = []
        const grouped: Record<string, { storage: number }> = {}
        segments.forEach((seg) => {
          const key = new Date(seg.startTime!).toISOString().split('T')[0]
          if (!grouped[key!]) grouped[key!] = { storage: 0 }
          grouped[key!]!.storage += (Number(seg.size) || 0) / 1024
        })
        for (const [date, val] of Object.entries(grouped)) {
          chartData.push({ date, storage: val.storage })
        }

        summariesArr.push({
          camera: cam,
          segments,
          days: daysRecorded,
          totalStorage,
          totalDuration,
          segmentCount: segments.length,
          chartData,
        })
      }
      setSummaries(summariesArr)
    }

    fetchAll().then()
  }, [])

  return (
    <div className="max-w-8xl mx-auto grid grid-cols-1 gap-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((s) => (
        <Card key={s.camera.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {s.camera.name}
              <Link href={`/${locale}/${s.camera.id}/dashboard`}>
                {t('details')}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              {t('recordingDays')}: <strong>{s.days}</strong>
            </p>
            <p>
              {t('recordingDuration')}:{' '}
              <strong>{s.totalDuration.toFixed(2)} h</strong>
            </p>
            <p>
              {t('segmentCount')}: <strong>{s.segmentCount}</strong>
            </p>
            <p>
              {t('storage')}: <strong>{s.totalStorage.toFixed(2)} GB</strong>
            </p>
            {/* 小图表 */}
            {s.chartData.length > 0 && (
              <ChartContainer className="mt-2 h-[120px]" config={chartConfig}>
                <LineChart data={s.chartData.slice(-7)}>
                  {' '}
                  {/* 最近7天 */}
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="views"
                        labelFormatter={(value) => {
                          return new Date(value).toLocaleDateString()
                        }}
                      />
                    }
                  />
                  <Line dataKey="storage" fill="#4f46e5" type="monotone" />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
