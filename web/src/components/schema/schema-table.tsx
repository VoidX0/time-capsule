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
  selectedKeys = [],
  onSelectedChanged,
}: SchemaTableProps<T>) {
  const schema = schemas[typeName] as SchemaType
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
          {Object.keys(schema).map((key) => (
            <TableHead key={key}>
              {labelMap[key as keyof T] ?? schema[key]?.description ?? key}
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
                  if (newSelected.has(rowIndex)) {
                    newSelected.delete(rowIndex)
                  } else {
                    newSelected.add(rowIndex)
                  }
                  onSelectedChanged?.([...newSelected])
                }}
              />
            </TableCell>
            {Object.keys(schema).map((key) => {
              const fieldKey = key as keyof T
              const value = row[fieldKey]
              const field = schema[key] as SchemaField

              const isDateTime = field.format?.includes('date-time')
              const isBoolean = field.type.includes('boolean')

              return (
                <TableCell key={key}>
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
