'use client'

import { schemas } from '@/api/generatedSchemas'
import { schemaDefaultValue, SchemaField, SchemaType } from '@/components/schema/schema'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/date-time'
import { useMemo, useState } from 'react'

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SchemaTableProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 表格数据列表 */
  data?: T[]
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 当前显示的列 */
  visibleColumns?: (keyof T)[]
  /** 选中行索引数组 */
  selectedKeys?: number[]
  /** 选中行变化回调 */
  onSelectedChanged?: (selected: number[]) => void
}

/**
 * 根据数据结构自动生成表格
 */
export default function SchemaTable<T extends Record<string, unknown>>({
  typeName,
  data = [],
  labelMap = {},
  visibleColumns,
  selectedKeys = [],
  onSelectedChanged,
}: SchemaTableProps<T>) {
  const schema = useMemo(() => schemas[typeName] as SchemaType, [typeName])

  // 全部列顺序
  const [columnOrder, setColumnOrder] = useState<(keyof T)[]>(
    Object.keys(schema) as (keyof T)[],
  )

  // 渲染列，受 visibleColumns 控制
  const renderedColumns = useMemo(() => {
    if (visibleColumns?.length) {
      return columnOrder.filter((col) => visibleColumns.includes(col))
    }
    return columnOrder
  }, [columnOrder, visibleColumns])

  // 表格数据：填充默认值
  const tableData = useMemo(() => {
    return data.map((row) => ({
      ...row,
      ...Object.fromEntries(
        Object.keys(schema)
          .filter((key) => !(key in row))
          .map((key) => {
            const field = schema[key] as SchemaField
            const defaultValue = schemaDefaultValue(
              field.type,
              field.format ?? '',
            )
            return [key, defaultValue]
          }),
      ),
    })) as T[]
  }, [data, schema])

  // 选中行索引集合
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  // 全选
  const allSelected =
    tableData.length > 0 && selectedSet.size === tableData.length
  // 部分选中
  const partiallySelected =
    selectedSet.size > 0 && selectedSet.size < tableData.length

  const sensors = useSensors(useSensor(PointerSensor))

  // 拖拽列头组件，只渲染 <th>
  function SortableTableHead({
    id,
    children,
  }: {
    id: string
    children: React.ReactNode
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <TableHead
        ref={setNodeRef}
        style={style}
        className="select-none"
        {...attributes}
      >
        <div className="flex items-center gap-2">
          <span {...listeners} className="inline-flex items-center">
            <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
          </span>
          {children}
        </div>
      </TableHead>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
          const oldIndex = columnOrder.findIndex(
            (col) => String(col) === String(active.id),
          )
          const newIndex = columnOrder.findIndex(
            (col) => String(col) === String(over.id),
          )
          setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex))
        }
      }}
    >
      <SortableContext
        items={renderedColumns.map(String)}
        strategy={rectSortingStrategy}
      >
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {/*选中列*/}
              <TableHead>
                <Checkbox
                  checked={
                    allSelected
                      ? true
                      : partiallySelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={() => {
                    if (allSelected) onSelectedChanged?.([])
                    else onSelectedChanged?.(tableData.map((_, i) => i))
                  }}
                />
              </TableHead>
              {/*数据列*/}
              {renderedColumns.map((col) => (
                <SortableTableHead key={String(col)} id={String(col)}>
                  {labelMap[col as keyof T] ??
                    schema[col as string]?.description ??
                    String(col)}
                </SortableTableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {tableData.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="odd:bg-muted/50 even:bg-background"
              >
                {/*选中列*/}
                <TableCell>
                  <Checkbox
                    checked={selectedSet.has(rowIndex)}
                    onCheckedChange={() => {
                      const newSelected = new Set(selectedSet)
                      if (newSelected.has(rowIndex))
                        newSelected.delete(rowIndex)
                      else newSelected.add(rowIndex)
                      onSelectedChanged?.([...newSelected])
                    }}
                  />
                </TableCell>
                {/*数据列*/}
                {renderedColumns.map((col) => {
                  const value = row[col]
                  const field = schema[col as string]
                  const isDateTime = field?.format?.includes('date-time')
                  const isBoolean = field?.type.includes('boolean')
                  return (
                    <TableCell key={String(col)}>
                      {isDateTime ? (
                        formatDate(new Date(value as number)) +
                        ' ' +
                        formatTime(new Date(value as number))
                      ) : isBoolean ? (
                        <Checkbox checked={value as boolean} disabled />
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SortableContext>
    </DndContext>
  )
}
