import { schemas } from '@/api/generatedSchemas'
import { MagicCard } from '@/components/magicui/magic-card'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/date-time'
import { schemaDefaultValue } from '@/lib/schema'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

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
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 新增：Header 插槽 */
  headerSlot?: React.ReactNode
  /** 新增：Footer 插槽 */
  footerSlot?: React.ReactNode
}

/**
 * 根据数据结构自动生成表格
 */
export default function SchemaTable<T extends Record<string, unknown>>({
  typeName,
  data = [],
  labelMap = {},
  headerSlot,
  footerSlot,
}: SchemaTableProps<T>) {
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

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

  return (
    <Card className="w-full overflow-auto border-none p-0 shadow-none">
      <MagicCard gradientColor={gradientColor} className="p-4">
        {/*Header 插槽*/}
        {headerSlot && <div className="mb-4">{headerSlot}</div>}
        {/*表格区域*/}
        <div>
          <Table className="min-w-full">
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
          {/*Footer 插槽*/}
          {footerSlot && <div className="mt-4">{footerSlot}</div>}
        </div>
      </MagicCard>
    </Card>
  )
}
