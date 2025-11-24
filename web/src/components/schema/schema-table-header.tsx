import { schemas } from '@/api/generatedSchemas'
import { components } from '@/api/schema'
import { SchemaType } from '@/components/schema/schema'
import { SchemaFilter } from '@/components/schema/schema-filter'
import SchemaForm from '@/components/schema/schema-form'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { Check, Columns3Cog, Edit, ListFilter, ListOrdered, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

type QueryCondition = components['schemas']['QueryCondition']
type QueryOrder = components['schemas']['QueryOrder']
interface SchemaTableHeaderProps<T extends Record<string, unknown>> {
  /** 表格标题 */
  title: string
  /** 类型名，用于获取 schema */
  typeName: keyof typeof schemas
  /** 当前显示的列 */
  visibleColumns: (keyof T)[]
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 选中的数据 */
  selectedData?: T[]
  /** 只读模式 */
  readOnly?: boolean
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
  selectedData = [],
  readOnly = false,
  onVisibleColumnsChange,
  onAdd,
  onEdit,
  onDelete,
  onConditionChange,
  onOrderChange,
}: SchemaTableHeaderProps<T>) {
  const isMobile = useIsMobile()
  const t = useTranslations('Schema')
  const [conditionSetOpen, setConditionSetOpen] = useState(false) // 过滤条件下拉菜单打开状态
  const [orderSetOpen, setOrderSetOpen] = useState(false) // 排序下拉菜单打开状态
  const [columnSetOpen, setColumnSetOpen] = useState(false) // 列名设置下拉菜单打开状态
  const [detailOpen, setDetailOpen] = useState(false) // 详情对话框打开状态
  const [detailData, setDetailData] = useState<T | null>(null) // 详情数据
  const [detailMode, setDetailMode] = useState<'add' | 'edit'>('add') // 详情模式

  const schema = useMemo(() => schemas[typeName] as SchemaType, [typeName])
  const columns = useMemo(() => Object.keys(schema) as (keyof T)[], [schema])

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
    <div className="mb-4 flex w-full items-center justify-between">
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
      <div className="flex-1 text-center text-lg font-semibold">{title}</div>

      {/* 右侧区域 */}
      <div className="flex flex-1 justify-end gap-2">
        {/*过滤控制*/}
        <DropdownMenu
          open={conditionSetOpen}
          onOpenChange={setConditionSetOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
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
            <Button variant="outline" size="icon">
              <ListOrdered />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
          ></DropdownMenuContent>
        </DropdownMenu>
        {/*显示列控制*/}
        <DropdownMenu open={columnSetOpen} onOpenChange={setColumnSetOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
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
      </div>
      {/*详情Dialog*/}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-background max-h-[90vh] w-full !max-w-[90vw] overflow-auto border-none p-0 shadow-none sm:w-fit">
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
            columns={isMobile ? 1 : 2}
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
    </div>
  )
}
