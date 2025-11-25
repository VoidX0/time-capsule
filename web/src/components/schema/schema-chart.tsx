'use client'

import { schemas } from '@/api/generatedSchemas'
import { SchemaType } from '@/components/schema/schema'
import { Button } from '@/components/ui/button'
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AreaChart as AreaIcon,
  ArrowDownWideNarrow,
  BarChart3,
  Calculator,
  Clock,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Sigma,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

/** 图表组件属性 */
interface SchemaChartProps<T> {
  /** 标题 */
  title: string
  /** 是否打开 */
  open: boolean
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void
  /** 数据源 */
  data: T[]
  /** 数据类型名称 */
  typeName: keyof typeof schemas
  /** 字段标签映射 */
  labelMap?: Partial<Record<keyof T, string>>
}

type ChartType = 'bar' | 'line' | 'area' | 'pie' // 图表类型
type AggType = 'sum' | 'avg' | 'count' // 聚合方式
type SortType = 'x-asc' | 'y-desc' | 'y-asc' // 排序方式
type TimeGrain = 'day' | 'hour' | 'minute' | 'raw' // 时间粒度

/** 格式化时间戳为指定粒度 */
const formatTimestamp = (val: string | number, grain: TimeGrain) => {
  if (!val) return ''
  // 尝试解析时间
  const date = new Date(Number(val))
  // 如果解析失败（由 isNaN 判断），可能本身就是日期字符串，直接尝试用 Date 构造
  const validDate = isNaN(date.getTime()) ? new Date(val) : date

  if (isNaN(validDate.getTime())) return String(val) // 还是失败，返回原始值

  const Y = validDate.getFullYear()
  const M = String(validDate.getMonth() + 1).padStart(2, '0')
  const D = String(validDate.getDate()).padStart(2, '0')
  const h = String(validDate.getHours()).padStart(2, '0')
  const m = String(validDate.getMinutes()).padStart(2, '0')
  const s = String(validDate.getSeconds()).padStart(2, '0')

  switch (grain) {
    case 'day':
      return `${Y}-${M}-${D}`
    case 'hour':
      return `${Y}-${M}-${D} ${h}:00`
    case 'minute':
      return `${Y}-${M}-${D} ${h}:${m}`
    case 'raw':
    default:
      return `${Y}-${M}-${D} ${h}:${m}:${s}`
  }
}

// --- 组件主体 ---
export function SchemaChart<T extends Record<string, unknown>>({
  title,
  open,
  onOpenChange,
  data,
  typeName,
  labelMap = {},
}: SchemaChartProps<T>) {
  const t = useTranslations('Schema')
  const schema = useMemo(() => schemas[typeName] as SchemaType, [typeName])

  // 1. 提取列信息
  const columns = useMemo(() => {
    if (!data || data.length === 0) return []
    // @ts-expect-error key extraction
    return Object.keys(data[0]) as (keyof T)[]
  }, [data])

  const numericColumns = useMemo(() => {
    if (!data || data.length === 0) return []
    return columns.filter((col) => {
      // @ts-expect-error value check
      const val = data[0][col]
      return typeof val === 'number'
    })
  }, [data, columns])

  const textColumns = useMemo(() => {
    return columns.filter((col) => !numericColumns.includes(col))
  }, [columns, numericColumns])

  // 2. UI 状态管理
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [xAxisKey, setXAxisKey] = useState<string>(
    String(textColumns[0] || columns[0] || ''),
  )
  const [yAxisKey, setYAxisKey] = useState<string>(
    String(numericColumns[0] || columns[1] || ''),
  )

  // 数据处理控制状态
  const [aggType, setAggType] = useState<AggType>('sum')
  const [sortType, setSortType] = useState<SortType>('x-asc')
  const [limit, setLimit] = useState<string>('all')
  const [timeGrain, setTimeGrain] = useState<TimeGrain>('raw')

  // 3. 判断 X 轴是否为时间类型
  const isXAxisDate = useMemo(() => {
    // 优先检查 Schema 定义
    if (schema && schema[xAxisKey]?.format?.includes('date-time')) return true

    // 启发式检查：如果有数据，且看起来像时间戳 (数字且长度13位，或者毫秒级)
    if (data && data.length > 0) {
      const sample = data[0]?.[xAxisKey]
      if (typeof sample === 'number' && String(sample).length === 13)
        return true
    }
    return false
  }, [schema, xAxisKey, data])

  // 4. 获取字段标签
  const getLabel = (key: string) => {
    let label = key
    if (labelMap[key as keyof T]) label = labelMap[key as keyof T]!
    else if (schema && schema[key]?.description)
      label = schema[key].description!
    return label
  }

  // 5. 核心：数据处理引擎 (格式化 -> 聚合 -> 排序 -> 截取)
  const processedData = useMemo(() => {
    if (!data || data.length === 0 || !xAxisKey || !yAxisKey) return []

    // 使用 Map 进行聚合 (Key: X轴值, Value: 累加器)
    const map = new Map<string, { sum: number; count: number; raw: unknown }>()

    data.forEach((item) => {
      let xVal = item[xAxisKey] as string | number

      // A. 时间格式化与归一化
      if (isXAxisDate) {
        xVal = formatTimestamp(xVal, timeGrain)
      } else {
        xVal = String(xVal)
      }
      const yVal = Number(item[yAxisKey]) || 0

      // B. 聚合计算
      if (!map.has(xVal)) {
        map.set(xVal, { sum: 0, count: 0, raw: item })
      }
      const entry = map.get(xVal)!

      if (aggType === 'count') {
        entry.count += 1
        entry.sum += 1 // 计数模式下，sum 即为数量
      } else {
        entry.sum += yVal
        entry.count += 1
      }
    })

    // C. 转换为数组并计算平均值
    let result = Array.from(map.entries()).map(([xKey, val]) => {
      let finalY = val.sum
      if (aggType === 'avg') {
        finalY =
          val.count === 0 ? 0 : parseFloat((val.sum / val.count).toFixed(2))
      }

      return {
        [xAxisKey]: xKey, // 这里已经是格式化后的字符串
        [yAxisKey]: finalY,
        _count: val.count, // 保留元数据
        _tooltipLabel: xKey, // 用于 Tooltip 显示
      }
    })

    // D. 排序
    result.sort((a, b) => {
      if (sortType === 'x-asc') {
        const xA = String(a[xAxisKey])
        const xB = String(b[xAxisKey])
        // 尝试自然排序 (包含数字比较)
        return xA.localeCompare(xB, undefined, { numeric: true })
      } else if (sortType === 'y-desc') {
        // @ts-expect-error numeric sort
        return b[yAxisKey] - a[yAxisKey]
      } else {
        // @ts-expect-error numeric sort
        return a[yAxisKey] - b[yAxisKey]
      }
    })

    // E. 截取 Top N
    if (limit !== 'all') {
      result = result.slice(0, Number(limit))
    }

    return result
  }, [
    data,
    xAxisKey,
    yAxisKey,
    aggType,
    sortType,
    limit,
    isXAxisDate,
    timeGrain,
  ])

  // 6. 图表颜色配置 (直接使用 CSS 变量，适配深色模式)
  const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ]

  const chartConfig = {
    [yAxisKey]: {
      label: `${getLabel(yAxisKey)} (${aggType === 'sum' ? 'SUM' : aggType === 'avg' ? 'AVG' : 'COUNT'})`,
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  // 7. 渲染逻辑
  const renderChart = () => {
    if (!processedData || processedData.length === 0)
      return (
        <div className="text-muted-foreground flex h-[300px] items-center justify-center">
          {t('chartEmpty')}
        </div>
      )
    if (!xAxisKey || !yAxisKey)
      return (
        <div className="text-muted-foreground flex h-[300px] items-center justify-center">
          {t('chartEmptyText')}
        </div>
      )

    const commonProps = {
      data: processedData,
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
    }

    // X轴通用配置
    const xAxisProps = {
      dataKey: xAxisKey,
      tickLine: false,
      axisLine: false,
      tickMargin: 8,
      tickFormatter: (value: unknown) => {
        const str = String(value)
        // Raw 模式下时间太长，截断显示
        if (timeGrain === 'raw' && str.length > 11) return str.slice(5) // 去掉年份
        // 普通文本过长截断
        if (str.length > 10) return str.slice(0, 10) + '...'
        return str
      },
    }

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...xAxisProps} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey={yAxisKey}
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...xAxisProps} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey={yAxisKey}
              fill="var(--chart-1)"
              fillOpacity={0.2}
              stroke="var(--chart-1)"
            />
          </AreaChart>
        )
      case 'pie':
        return (
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey={xAxisKey} hideLabel />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Pie
              data={processedData}
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            >
              {processedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  className="stroke-background hover:opacity-80"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        )
      case 'bar':
      default:
        return (
          <BarChart {...commonProps}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...xAxisProps} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey={yAxisKey}
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background max-h-[90vh] w-full max-w-[95vw] overflow-y-auto border-none p-0 shadow-none md:max-w-screen-lg lg:max-w-screen-xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>
            {t('chart')} - {title}
          </DialogTitle>
          <DialogDescription>{t('chartDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6 pt-2">
          {/* --- 控制栏 --- */}
          <div className="bg-muted/30 flex flex-wrap items-end gap-4 rounded-lg border p-4">
            {/* 1. 图表类型 */}
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground text-xs">
                {t('chartType')}
              </Label>
              <div className="bg-background flex items-center gap-1 rounded-md border p-1">
                <Button
                  variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setChartType('bar')}
                  title={t('chartBar')}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'line' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setChartType('line')}
                  title={t('chartLine')}
                >
                  <LineIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'area' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setChartType('area')}
                  title={t('chartArea')}
                >
                  <AreaIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setChartType('pie')}
                  title={t('chartPie')}
                >
                  <PieIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 2. X 轴选择 */}
            <div className="flex min-w-[120px] flex-col gap-2">
              <Label className="text-muted-foreground text-xs">
                {t('chartDimension')} (X)
              </Label>
              <Select value={xAxisKey} onValueChange={setXAxisKey}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('chartColumnSelect')} />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={String(col)} value={String(col)}>
                      {getLabel(String(col))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Y 轴选择 */}
            <div className="flex min-w-[120px] flex-col gap-2">
              <Label className="text-muted-foreground text-xs">
                {t('chartMetric')} (Y)
              </Label>
              <Select value={yAxisKey} onValueChange={setYAxisKey}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('chartColumnSelect')} />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={String(col)} value={String(col)}>
                      {getLabel(String(col))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. 时间粒度 (仅当 X 轴是时间时显示) */}
            {isXAxisDate && (
              <div className="flex min-w-[100px] flex-col gap-2">
                <Label className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" /> {t('chartPrecision')}
                </Label>
                <Select
                  value={timeGrain}
                  onValueChange={(v) => setTimeGrain(v as TimeGrain)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">
                      {t('chartPrecisionDay')}
                    </SelectItem>
                    <SelectItem value="hour">
                      {t('chartPrecisionHour')}
                    </SelectItem>
                    <SelectItem value="minute">
                      {t('chartPrecisionMinute')}
                    </SelectItem>
                    <SelectItem value="raw">
                      {t('chartPrecisionRaw')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 分隔线 */}
            <div className="bg-border/50 mx-2 hidden h-10 w-[1px] md:block" />

            {/* 5. 聚合方式 */}
            <div className="flex min-w-[100px] flex-col gap-2">
              <Label className="text-muted-foreground flex items-center gap-1 text-xs">
                <Calculator className="h-3 w-3" /> {t('chartAggregation')}
              </Label>
              <Select
                value={aggType}
                onValueChange={(v) => setAggType(v as AggType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">
                    {t('chartAggregationSum')}
                  </SelectItem>
                  <SelectItem value="avg">
                    {t('chartAggregationAvg')}
                  </SelectItem>
                  <SelectItem value="count">
                    {t('chartAggregationCount')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 6. 排序 */}
            <div className="flex min-w-[100px] flex-col gap-2">
              <Label className="text-muted-foreground flex items-center gap-1 text-xs">
                <ArrowDownWideNarrow className="h-3 w-3" /> {t('chartSort')}
              </Label>
              <Select
                value={sortType}
                onValueChange={(v) => setSortType(v as SortType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="x-asc">
                    {t('chartSortDimension')}
                  </SelectItem>
                  <SelectItem value="y-desc">
                    {t('chartSortMetricDesc')}
                  </SelectItem>
                  <SelectItem value="y-asc">
                    {t('chartSortMetricAsc')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 7. 截取 Top N */}
            <div className="flex min-w-[90px] flex-col gap-2">
              <Label className="text-muted-foreground flex items-center gap-1 text-xs">
                <Sigma className="h-3 w-3" /> {t('chartLimit')}
              </Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                  <SelectItem value="all">{t('chartLimitAll')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 图表容器 */}
          <div className="h-[400px] w-full rounded-lg border p-4">
            <ChartContainer config={chartConfig} className="h-full w-full">
              {renderChart()}
            </ChartContainer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
