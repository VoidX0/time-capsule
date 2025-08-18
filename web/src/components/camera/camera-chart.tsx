import { components } from '@/api/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { timeSpanToMilliseconds } from '@/lib/time-span'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

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
type QueryDto = components['schemas']['QueryDto']
type Segment = components['schemas']['VideoSegment']
export default function CameraChart({
  cameraId,
}: {
  cameraId: string | undefined
}) {
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
    const getSegments = async () => {
      if (!cameraId) return
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1000 * 1000 * 1000,
        Order: [{ FieldName: 'StartTime', OrderByType: 0 }],
      }
      if (cameraId != '0')
        body.Condition = [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
        ]
      const { data } = await openapi.POST('/Segment/Query', { body })
      // 按天分组
      const segmentsByDay: Record<string, Segment[]> = {}
      data?.forEach((segment: Segment) => {
        const date = new Date(segment.StartTime!).toISOString().split('T')[0]
        if (!segmentsByDay[date!]) {
          segmentsByDay[date!] = []
        }
        segmentsByDay[date!]!.push(segment)
      })
      calculateChartData(data ?? [])
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
    getSegments().then()
  }, [cameraId])

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>每日趋势</CardTitle>
          <CardDescription>每日存储空间、片段数量和录制时长</CardDescription>
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
  )
}
