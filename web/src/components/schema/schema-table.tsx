import { schemas } from '@/api/generatedSchemas'
import {
  schemaDefaultValue,
  SchemaField,
  SchemaType,
} from '@/components/schema/schema'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/date-time'
import { useMemo } from 'react'

/**
 * 根据数据结构自动生成表格
 */
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
  const columns = useMemo(() => {
    // 如果 visibleColumns 有值，就用它，否则显示所有列
    return visibleColumns?.length
      ? visibleColumns
      : (Object.keys(schema) as (keyof T)[])
  }, [schema, visibleColumns])
  // 初始化显示数据
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

  return (
    <Table className="min-w-full">
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              checked={
                allSelected ? true : partiallySelected ? 'indeterminate' : false
              }
              onCheckedChange={() => {
                if (allSelected) {
                  onSelectedChanged?.([])
                } else {
                  onSelectedChanged?.(tableData.map((_, i) => i))
                }
              }}
            />
          </TableHead>
          {columns.map((col) => (
            <TableHead key={String(col)}>
              {labelMap[col] ??
                schema[col as string]?.description ??
                String(col)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableData.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            <TableCell>
              <Checkbox
                checked={selectedSet.has(rowIndex)}
                onCheckedChange={() => {
                  const newSelected = new Set(selectedSet)
                  if (newSelected.has(rowIndex)) newSelected.delete(rowIndex)
                  else newSelected.add(rowIndex)
                  onSelectedChanged?.([...newSelected])
                }}
              />
            </TableCell>
            {columns.map((col) => {
              const fieldKey = col as keyof T
              const value = row[fieldKey]
              const field = schema[col as string]
              const isDateTime = field?.format?.includes('date-time')
              const isBoolean = field?.type.includes('boolean')
              return (
                <TableCell key={String(col)}>
                  <span>
                    {isDateTime ? (
                      formatDate(new Date(value as number)) +
                      ' ' +
                      formatTime(new Date(value as number))
                    ) : isBoolean ? (
                      <Checkbox checked={value as boolean} disabled />
                    ) : (
                      String(value)
                    )}
                  </span>
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
