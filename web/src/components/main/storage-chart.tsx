import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { openapi } from '@/lib/http'
import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

const chartConfig = {
  detection: {
    label: '检测',
  },
  cache: {
    label: '缓存',
  },
} satisfies ChartConfig

export default function StorageChart() {
  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>('detection') // 激活的图表
  const [chartData, setChartData] = useState<
    { name: string; detection: number; cache: number }[]
  >([])

  const total = useMemo(
    () => ({
      detection: chartData
        .reduce((acc, curr) => acc + curr.detection, 0)
        .toFixed(2),
      cache: chartData.reduce((acc, curr) => acc + curr.cache, 0).toFixed(2),
    }),
    [chartData],
  )

  const COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#ef4444', '#06b6d4']

  function getColor(name: string, index: number) {
    return COLORS[index % COLORS.length]
  }

  useEffect(() => {
    const getStorage = async () => {
      const { data: detectionData } = await openapi.GET(
        '/Settings/GetStorageInfo',
        {
          params: { query: { path: 'detection' } },
        },
      )
      const { data: cacheData } = await openapi.GET(
        '/Settings/GetStorageInfo',
        {
          params: { query: { path: 'cache' } },
        },
      )
      calculateChartData(
        detectionData as Record<string, number>,
        cacheData as Record<string, number>,
      )
    }
    // 计算图表数据
    const calculateChartData = (
      detection: Record<string, number>,
      cache: Record<string, number>,
    ) => {
      // 合并名称
      const names = new Set<string>([
        ...Object.keys(detection),
        ...Object.keys(cache),
      ])
      // 构造图表数据
      const chart = Array.from(names).map((data) => ({
        name: data,
        detection: parseFloat(((detection[data] || 0) / 1024).toFixed(2)),
        cache: parseFloat(((cache[data] || 0) / 1024).toFixed(2)),
      }))
      setChartData(chart)
    }
    getStorage().then()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>额外存储</CardTitle>
          <CardDescription>摄像头额外占用的存储空间(GB)</CardDescription>
        </div>
        <div className="flex">
          {['detection', 'cache'].map((key) => {
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
          <PieChart accessibilityLayer data={chartData}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel={true} />}
            />
            <Pie
              data={chartData}
              dataKey={activeChart}
              innerRadius={60}
              label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(entry.name, index)}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
