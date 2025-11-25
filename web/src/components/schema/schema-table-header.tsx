import { QueryCondition, QueryOrder, schemas } from '@/api/generatedSchemas'
import { SchemaType } from '@/components/schema/schema'
import { SchemaChart } from '@/components/schema/schema-chart'
import { SchemaFilter } from '@/components/schema/schema-filter'
import SchemaForm from '@/components/schema/schema-form'
import { SchemaOrder } from '@/components/schema/schema-order'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ChartArea,
  Check,
  Columns3Cog,
  Download,
  Edit,
  Ellipsis,
  ListFilter,
  ListOrdered,
  Loader,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

interface SchemaTableHeaderProps<T extends Record<string, unknown>> {
  /** 表格标题 */
  title: string
  /** 类型名，用于获取 schema */
  typeName: keyof typeof schemas
  /** 当前显示的列 */
  visibleColumns: (keyof T)[]
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 表格数据 */
  data?: T[]
  /** 选中的数据 */
  selectedData?: T[]
  /** 只读模式 */
  readOnly?: boolean
  /** 正在加载所有数据 */
  isLoadingAllData?: boolean
  /** 列显示/隐藏变化回调 */
  onVisibleColumnsChange: (columns: (keyof T)[]) => void
  /** 新增回调 */
  onAdd?: (item: T) => Promise<boolean>
  /** 编辑回调 */
  onEdit?: (item: T) => Promise<boolean>
  /** 删除回调 */
  onDelete?: (items: T[]) => Promise<boolean>
  /** 查询条件变化回调 */
  onConditionChange?: (conditions: QueryCondition[]) => void
  /** 排序变化回调 */
  onOrderChange?: (orders: QueryOrder[]) => void
  /** 加载全部数据回调 */
  onLoadAllData?: () => void
  /** 导出回调 */
  onDownload?: () => void
}

/** 根据 format 获取 C# 类型名 */
function getCSharpTypeName(typeStr: string, formatStr: string): string {
  if (formatStr.includes('date-time')) return 'DateTimeOffset'
  if (typeStr.includes('boolean')) return 'Bool'
  return formatStr
}

/** 表格头部组件 */
export function SchemaTableHeader<T extends Record<string, unknown>>({
  title,
  typeName,
  visibleColumns,
  labelMap,
  data = [],
  selectedData = [],
  readOnly = false,
  isLoadingAllData = false,
  onVisibleColumnsChange,
  onAdd,
  onEdit,
  onDelete,
  onConditionChange,
  onOrderChange,
  onLoadAllData,
  onDownload,
}: SchemaTableHeaderProps<T>) {
  const isMobile = useIsMobile()
  const t = useTranslations('Schema')
  const [conditionSetOpen, setConditionSetOpen] = useState(false) // 过滤条件下拉菜单打开状态
  const [orderSetOpen, setOrderSetOpen] = useState(false) // 排序下拉菜单打开状态
  const [columnSetOpen, setColumnSetOpen] = useState(false) // 列名设置下拉菜单打开状态
  const [chartOpen, setChartOpen] = useState(false) // 控制图表Dialog状态
  const [detailOpen, setDetailOpen] = useState(false) // 详情对话框打开状态
  const [detailData, setDetailData] = useState<T | null>(null) // 详情数据
  const [detailMode, setDetailMode] = useState<'add' | 'edit'>('add') // 详情模式

  const schema = useMemo(() => schemas[typeName] as SchemaType, [typeName])
  const columns = useMemo(() => Object.keys(schema) as (keyof T)[], [schema])

  // 图表数据源
  const chartData = useMemo(() => {
    // 优先使用用户手动选中的数据
    if (selectedData && selectedData.length > 0) return selectedData
    // 如果没有选中，则使用 data 中已加载的数据
    if (data && data.length > 0)
      return data.filter((item) => item && Object.keys(item).length > 0)
    return []
  }, [selectedData, data])

  // 筛选条件
  const [conditions, setConditions] = useState<QueryCondition[]>(
    columns.map((col) => ({
      fieldName: String(col),
      fieldValue: undefined,
      conditionalType: schema[String(col)]?.format?.includes('date-time')
        ? 16
        : 0,
      cSharpTypeName: getCSharpTypeName(
        schema[String(col)]?.type ?? '',
        schema[String(col)]?.format ?? '',
      ),
    })),
  )

  // 排序条件
  const [orders, setOrders] = useState<QueryOrder[]>(
    columns.map((col) => ({
      fieldName: String(col),
      orderByType: undefined,
    })),
  )

  /** 切换列显示/隐藏 */
  const toggleColumn = (col: keyof T) => {
    if (visibleColumns.includes(col)) {
      onVisibleColumnsChange(visibleColumns.filter((c) => c !== col))
    } else {
      onVisibleColumnsChange([...visibleColumns, col])
    }
  }

  /** 获取列的显示标签 */
  const getColumnLabel = (col: keyof T) => {
    return labelMap?.[col] ?? schema[col as string]?.description ?? String(col)
  }

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-3 md:flex-row md:items-center md:justify-between">
      {/* 左侧区域 */}
      <div className="flex flex-1 items-center gap-2">
        {!readOnly && onAdd && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setDetailMode('add')
              setDetailData(null)
              setDetailOpen(true)
            }}
          >
            <Plus />
          </Button>
        )}
        {!readOnly && onEdit && selectedData?.length === 1 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setDetailMode('edit')
              setDetailData(selectedData?.[0] as T)
              setDetailOpen(true)
            }}
          >
            <Edit />
          </Button>
        )}
        {!readOnly && onDelete && selectedData?.length >= 1 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t('deleteConfirm')}</DialogTitle>
                <DialogDescription>
                  {t('deleteConfirmText', { param: selectedData?.length })}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(selectedData as T[])}
                  >
                    {t('delete')}
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 中间区域 */}
      <div className="order-first flex-1 text-center text-lg font-semibold md:order-none">
        {title}
      </div>

      {/* 右侧区域 */}
      <div className="flex flex-1 justify-end gap-2">
        {/* 加载状态指示 */}
        {isLoadingAllData && (
          <div className="bg-muted/50 text-muted-foreground animate-in fade-in zoom-in-95 flex items-center gap-2 rounded-md px-3 py-2 text-sm duration-300">
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
            <span className="hidden text-xs font-medium sm:inline">
              Loading...
            </span>
          </div>
        )}

        {/*过滤控制*/}
        <DropdownMenu
          open={conditionSetOpen}
          onOpenChange={setConditionSetOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant={
                conditions.some((o) => o.fieldValue !== undefined)
                  ? 'default'
                  : 'outline'
              }
              size="icon"
            >
              <ListFilter />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2 md:w-110">
            <SchemaFilter
              typeName={typeName}
              conditions={conditions}
              labelMap={labelMap}
              onConditionChange={(conditions) => setConditions(conditions)}
              onSubmit={(conditions) => {
                onConditionChange?.(conditions)
                setConditionSetOpen(false)
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {/*排序控制*/}
        <DropdownMenu open={orderSetOpen} onOpenChange={setOrderSetOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={
                orders.some((o) => o.orderByType !== undefined)
                  ? 'default'
                  : 'outline'
              }
              size="icon"
            >
              <ListOrdered />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <SchemaOrder
              typeName={typeName}
              orders={orders}
              labelMap={labelMap}
              onOrderChange={(orders) => setOrders(orders)}
              onSubmit={(orders) => {
                onOrderChange?.(orders)
                setOrderSetOpen(false)
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {/*显示列控制*/}
        <DropdownMenu open={columnSetOpen} onOpenChange={setColumnSetOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={
                columns.length !== visibleColumns.length ? 'default' : 'outline'
              }
              size="icon"
            >
              <Columns3Cog />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {columns.map((col) => (
              <div
                key={String(col)}
                className="hover:bg-muted/10 flex cursor-pointer items-center gap-2 px-3 py-1 select-none"
                onClick={() => toggleColumn(col)}
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  {visibleColumns.includes(col) && (
                    <Check className="h-4 w-4" />
                  )}
                </div>
                <span>{getColumnLabel(col)}</span>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/*其他功能区域*/}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {/*加载全部数据*/}
            <DropdownMenuItem
              disabled={isLoadingAllData}
              onClick={() => onLoadAllData?.()}
            >
              <Loader />
              <span>{t('loadAllData')}</span>
            </DropdownMenuItem>
            {/*导出Excel*/}
            <DropdownMenuItem onClick={() => onDownload?.()}>
              <Download />
              <span>{t('downloadExcel')}</span>
            </DropdownMenuItem>
            {/* 图表分析 */}
            <DropdownMenuItem onClick={() => setChartOpen(true)}>
              <ChartArea />
              <span>{t('chart')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/*详情Dialog*/}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-background max-h-[90vh] w-full max-w-[90vw] overflow-y-auto border-none p-0 shadow-none md:max-w-screen-lg lg:max-w-screen-xl">
          <DialogHeader>
            <DialogTitle />
            <DialogDescription />
          </DialogHeader>
          {/* 详情内容 */}
          <SchemaForm
            typeName={typeName}
            data={detailData as T}
            labelMap={labelMap}
            labelPosition={isMobile ? 'top' : 'left'}
            onConfirm={(item) => {
              if (detailMode === 'add') {
                onAdd?.(item).then((success) => {
                  if (success) setDetailOpen(false)
                })
              } else if (detailMode === 'edit') {
                onEdit?.(item).then((success) => {
                  if (success) setDetailOpen(false)
                })
              }
            }}
          />
        </DialogContent>
      </Dialog>
      {/*图表Dialog*/}
      <SchemaChart
        title={title}
        open={chartOpen}
        onOpenChange={setChartOpen}
        data={chartData}
        typeName={typeName}
        labelMap={labelMap}
      />
    </div>
  )
}
