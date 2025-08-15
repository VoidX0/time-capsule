'use client'

import { components } from '@/api/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

type QueryDto = components['schemas']['QueryDto']
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
  const locale = useLocale()
  const [summaries, setSummaries] = useState<CameraSummary[]>([]) // 摄像头汇总信息

  useEffect(() => {
    const fetchAll = async () => {
      // 获取全部摄像头
      const { data: cameras } = await openapi.POST('/Camera/Query', {
        body: { PageNumber: 1, PageSize: 1000 } as QueryDto,
      })
      if (!cameras?.length) return

      const summariesArr: CameraSummary[] = []

      for (const cam of cameras) {
        // 查询该摄像头的切片
        const { data: segs } = await openapi.POST('/Segment/Query', {
          body: {
            PageNumber: 1,
            PageSize: 10000,
            Condition: [
              {
                FieldName: 'CameraId',
                FieldValue: cam.Id?.toString(),
                CSharpTypeName: 'long',
              },
            ],
            Order: [{ FieldName: 'StartTime', OrderByType: 0 }],
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
                    new Date(s.StartTime || '').toISOString().split('T')[0],
                ),
              ).size
        const totalStorage =
          segments.reduce((sum, s) => sum + (s.Size || 0), 0) / 1024
        const totalDuration =
          segments.reduce(
            (sum, s) => sum + timeSpanToMilliseconds(s.DurationActual!),
            0,
          ) /
          1000 /
          3600
        const chartData: { date: string; storage: number }[] = []
        const grouped: Record<string, { storage: number }> = {}
        segments.forEach((seg) => {
          const key = new Date(seg.StartTime!).toISOString().split('T')[0]
          if (!grouped[key!]) grouped[key!] = { storage: 0 }
          grouped[key!]!.storage += (seg.Size || 0) / 1024
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

  if (summaries.length === 0) {
    return <div className="p-8 text-center">加载中...</div>
  }

  return (
    <div className="max-w-8xl mx-auto grid grid-cols-1 gap-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((s) => (
        <Card key={s.camera.Id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {s.camera.Name}
              <Link href={`/${locale}/${s.camera.Id}/dashboard`}>详情</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              录制天数: <strong>{s.days} 天</strong>
            </p>
            <p>
              录制时长: <strong>{s.totalDuration.toFixed(2)} h</strong>
            </p>
            <p>
              片段数量: <strong>{s.segmentCount} 个</strong>
            </p>
            <p>
              存储空间: <strong>{s.totalStorage.toFixed(2)} GB</strong>
            </p>
            {/* 小图表 */}
            {s.chartData.length > 0 && (
              <ChartContainer className="mt-2 h-[120px]" config={chartConfig}>
                <BarChart data={s.chartData.slice(-7)}>
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
                  <Bar dataKey="storage" fill="#4f46e5" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
