import { schemas } from '@/api/generatedSchemas'
import { SchemaType } from '@/components/schema/schema'
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
import { Check, Columns3Cog, Edit, Plus, Trash2 } from 'lucide-react'
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
  /** 选中的数据 */
  selectedData?: T[]
  /** 列显示/隐藏变化回调 */
  onVisibleColumnsChange: (columns: (keyof T)[]) => void
  /** 新增回调 */
  onAdd?: (item: T) => void
  /** 编辑回调 */
  onEdit?: (item: T) => void
  /** 删除回调 */
  onDelete?: (items: T[]) => void
}

/** 表格头部组件 */
export function SchemaTableHeader<T extends Record<string, unknown>>({
  title,
  typeName,
  visibleColumns,
  labelMap,
  selectedData = [],
  onVisibleColumnsChange,
  onAdd,
  onEdit,
  onDelete,
}: SchemaTableHeaderProps<T>) {
  const isMobile = useIsMobile()
  const t = useTranslations('Schema')
  const [columnSetOpen, setColumnSetOpen] = useState(false) // 列名设置下拉菜单打开状态
  const [detailOpen, setDetailOpen] = useState(false) // 详情对话框打开状态
  const [detailData, setDetailData] = useState<T | null>(null) // 详情数据
  const [detailMode, setDetailMode] = useState<'add' | 'edit'>('add') // 详情模式

  const schema = useMemo(() => schemas[typeName] as SchemaType, [typeName])
  const columns = useMemo(() => Object.keys(schema) as (keyof T)[], [schema])

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
        {onAdd && (
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
        {selectedData?.length === 1 && onEdit && (
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
        {selectedData?.length >= 1 && onDelete && (
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
      <div className="flex flex-1 justify-end">
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
              if (detailMode === 'add') onAdd?.(item)
              else if (detailMode === 'edit') onEdit?.(item)
              setDetailOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
