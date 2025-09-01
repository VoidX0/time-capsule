'use client'

import { components } from '@/api/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { openapi } from '@/lib/http'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis } from 'recharts'

type FrameDetection = components['schemas']['FrameDetection']
type QueryDto = components['schemas']['QueryDto']

const chartConfig = {
  daily: {
    label: 'dailyDetections',
    color: '#4f46e5',
  },
  category: {
    label: 'categoryDistribution',
    color: '#16a34a',
  },
} satisfies ChartConfig

export default function DetectionChart({ cameraId }: { cameraId: string | undefined }) {
  const t = useTranslations('CameraDashboardPage')
  const tDetection = useTranslations('DetectionItem')
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>('daily') // 默认显示每日趋势

  // --- 原始数据 ---
  const [detections, setDetections] = useState<FrameDetection[]>([])

  // --- 每日数据 ---
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>(
    [],
  )

  // --- 类别数据 ---
  const [categoryData, setCategoryData] = useState<
    { name: string; value: number; percent?: number }[]
  >([])

  // --- 当前选中日期 ---
  const [selectedDate, setSelectedDate] = useState<'all' | string>('all')

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
      setDetections(data ?? [])
    }

    getDetections().then()
  }, [cameraId])

  // --- 每日数据计算 ---
  useEffect(() => {
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

    // 默认选择最后一天
    if (dailyData.length > 0) {
      setSelectedDate(dailyData[dailyData.length - 1]!.date)
    }
  }, [detections])

  // --- 类别数据计算（支持按日期筛选 / 全部） ---
  useEffect(() => {
    let filtered = detections
    if (selectedDate !== 'all') {
      filtered = detections.filter(
        (d) =>
          new Date(d.FrameTime!).toISOString().split('T')[0] === selectedDate,
      )
    }

    const categoryGrouped: Record<string, number> = {}
    filtered.forEach((d) => {
      const name = d.TargetName || 'Unknown'
      categoryGrouped[name] = (categoryGrouped[name] || 0) + 1
    })
    const total = Object.values(categoryGrouped).reduce((a, b) => a + b, 0)
    const categoryData = Object.entries(categoryGrouped)
      .map(([name, value]) => ({
        name: tDetection(name as never),
        value,
        percent: value / total,
      }))
      // 按数量从大到小排序
      .sort((a, b) => b.value - a.value)
    setCategoryData(categoryData)
  }, [detections, selectedDate, tDetection])

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
          <CardTitle>{t('detectionTrends')}</CardTitle>
          <CardDescription>{t('detectionTrendsDesc')}</CardDescription>
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
                  {t(chartConfig[chart].label as never)}
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
        {/* --- 日期选择器，仅在类别分布视图显示 --- */}
        {activeChart === 'category' && (
          <div className="mb-2 flex justify-end">
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('selectDate')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {dailyData.map((d) => (
                  <SelectItem key={d.date} value={d.date}>
                    {d.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
