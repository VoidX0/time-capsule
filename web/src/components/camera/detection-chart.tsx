'use client'

import { components } from '@/api/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis } from 'recharts'

type FrameDetection = components['schemas']['FrameDetection']
type QueryDto = components['schemas']['QueryDto']

const chartConfig = {
  daily: {
    label: '每日目标',
    color: '#4f46e5',
  },
  category: {
    label: '类别占比',
    color: '#16a34a',
  },
} satisfies ChartConfig

export default function DetectionChart({
  cameraId,
}: {
  cameraId: string | undefined
}) {
  const tDetection = useTranslations('DetectionItem')
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>('daily') // 默认显示每日趋势
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>(
    [],
  )
  const [categoryData, setCategoryData] = useState<
    { name: string; value: number; percent?: number }[]
  >([])

  const totalDetections = useMemo(
    () => dailyData.reduce((acc, curr) => acc + curr.count, 0),
    [dailyData],
  )

  useEffect(() => {
    const getDetections = async () => {
      if (!cameraId) return
      const body: QueryDto = {
        PageNumber: 1,
        PageSize: 1000 * 1000 * 1000,
        Order: [{ FieldName: 'FrameTime', OrderByType: 0 }],
      }
      if (cameraId != '0')
        body.Condition = [
          {
            FieldName: 'CameraId',
            FieldValue: cameraId,
            CSharpTypeName: 'long',
          },
        ]

      const { data } = await openapi.POST('/Detection/Query', { body })
      calculateChartData(data ?? [])
    }

    const calculateChartData = (detections: FrameDetection[]) => {
      // --- 每日数据 ---
      const dailyGrouped: Record<string, number> = {}
      detections.forEach((d) => {
        const dateKey = new Date(d.FrameTime!).toISOString().split('T')[0]
        dailyGrouped[dateKey!] = (dailyGrouped[dateKey!] || 0) + 1
      })
      const dailyData = Object.entries(dailyGrouped).map(([date, count]) => ({
        date,
        count,
      }))
      setDailyData(dailyData)

      // --- 类别数据 ---
      const categoryGrouped: Record<string, number> = {}
      detections.forEach((d) => {
        const name = d.TargetName || 'Unknown'
        categoryGrouped[name] = (categoryGrouped[name] || 0) + 1
      })
      const total = Object.values(categoryGrouped).reduce((a, b) => a + b, 0)
      const categoryData = Object.entries(categoryGrouped).map(
        ([name, value]) => ({
          name: tDetection(name as never),
          value,
          percent: value / total,
        }),
      )
      setCategoryData(categoryData)
    }

    getDetections().then()
  }, [cameraId])

  // 为饼图生成颜色
  const colors = [
    '#4f46e5',
    '#16a34a',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#8b5cf6',
    '#84cc16',
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>检测趋势</CardTitle>
          <CardDescription>每日检测数量与目标类别分布</CardDescription>
        </div>
        <div className="flex">
          {(['daily', 'category'] as (keyof typeof chartConfig)[]).map(
            (chart) => (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-muted-foreground text-xs">
                  {chartConfig[chart].label}
                </span>
                {chart === 'daily' ? (
                  <span className="text-xl leading-none font-bold whitespace-nowrap sm:text-3xl">
                    {totalDetections > 1000
                      ? totalDetections > 1000000
                        ? (totalDetections / 1000000).toFixed(2) + ' M'
                        : (totalDetections / 1000).toFixed(2) + ' K'
                      : totalDetections}
                  </span>
                ) : (
                  <span className="text-xl leading-none font-bold sm:text-3xl">
                    {categoryData.length}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          {activeChart === 'daily' ? (
            <LineChart
              data={dailyData}
              margin={{ left: 12, right: 12 }}
              accessibilityLayer
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
                    nameKey="count"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString()
                    }}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-daily)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    nameKey="name"
                    hideLabel={true}
                    // 光标悬浮显示实际数量
                    labelFormatter={(value) => `${value}`}
                  />
                }
              />
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
