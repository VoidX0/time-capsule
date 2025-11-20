import { schemas } from '@/api/generatedSchemas'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/date-time'
import { schemaDefaultValue } from '@/lib/schema'
import { Check, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'

/** schema 字段类型 */
interface SchemaField {
  type: string
  description?: string
  format?: string
}

/** schema 类型 */
type SchemaType = Record<string, SchemaField>

/**
 * 根据数据结构自动生成表格
 */
interface SchemaTableProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 表格数据列表 */
  data?: T[]
  /** 是否只读 */
  readOnly?: boolean
  /** 数据变更回调 */
  onChange?: (data: T[]) => void
  /** 点击确认 */
  onConfirm?: (data: T[]) => void
  /** 点击取消 */
  onCancel?: () => void
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
}

/**
 * 根据数据结构自动生成表格
 */
export default function SchemaTable<T extends Record<string, unknown>>({
  typeName,
  data = [],
  readOnly = false,
  onChange,
  onConfirm,
  onCancel,
  labelMap = {},
}: SchemaTableProps<T>) {
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

  const schema = schemas[typeName] as SchemaType
  // 初始化表格数据
  const initialData = data.map((row) => ({
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

  const [tableData, setTableData] = useState<T[]>(initialData)

  /** 更新单元格数据 */
  const updateCell = (rowIndex: number, key: keyof T, value: unknown) => {
    const newData = [...tableData]
    newData[rowIndex] = { ...newData[rowIndex], [key]: value } as T
    setTableData(newData)
    onChange?.(newData)
  }

  return (
    <Card className="w-full overflow-auto border-none p-0 shadow-none">
      <MagicCard gradientColor={gradientColor} className="p-4">
        <div>
          <Table className="min-w-full border">
            <TableHeader>
              <TableRow>
                {Object.keys(schema).map((key) => (
                  <TableHead key={key}>
                    {labelMap[key as keyof T] ??
                      schema[key]?.description ??
                      key}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Object.keys(schema).map((key) => {
                    const fieldKey = key as keyof T
                    const value = row[fieldKey]
                    const field = schema[key] as SchemaField

                    const isDateTime = field.format?.includes('date-time')
                    const isBoolean = field.type.includes('boolean')
                    const isNumber =
                      field.type.includes('number') ||
                      field.type.includes('int') ||
                      field.type.includes('double')

                    return (
                      <TableCell key={key}>
                        {readOnly ? (
                          <span>
                            {isDateTime
                              ? formatDate(new Date(value as number)) +
                                ' ' +
                                formatTime(new Date(value as number))
                              : String(value)}
                          </span>
                        ) : isBoolean ? (
                          <Checkbox
                            checked={value as boolean}
                            onCheckedChange={(v) =>
                              updateCell(rowIndex, fieldKey, v)
                            }
                          />
                        ) : (
                          <Input
                            type={
                              isDateTime
                                ? 'datetime-local'
                                : isNumber
                                  ? 'number'
                                  : 'text'
                            }
                            value={
                              isDateTime
                                ? `${formatDate(new Date(value as number))}T${formatTime(new Date(value as number))}`
                                : String(value ?? '')
                            }
                            onChange={(e) => {
                              let newValue: unknown = e.target.value
                              if (isDateTime)
                                newValue = new Date(e.target.value).getTime()
                              else if (isNumber)
                                newValue = Number(e.target.value)
                              updateCell(rowIndex, fieldKey, newValue)
                            }}
                          />
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 操作按钮 */}
          {!readOnly && (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                <X />
              </Button>
              <Button onClick={() => onConfirm?.(tableData)}>
                <Check />
              </Button>
            </div>
          )}
        </div>
      </MagicCard>
    </Card>
  )
}
