import { schemas } from '@/api/generatedSchemas'
import { MagicCard } from '@/components/magicui/magic-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatTime } from '@/lib/date-time'
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
 * 根据数据结构自动生成表单
 */
interface SchemaFormProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 表单数据 */
  data?: T
  /** 显示列数 */
  columns?: number
  /** label 位置：top | left */
  labelPosition?: 'top' | 'left'
  /** 只读模式 */
  readOnly?: boolean
  /** 数据变更回调 */
  onChange?: (value: T) => void
  /** 点击确认 */
  onConfirm?: (value: T) => void
  /** 点击取消 */
  onCancel?: () => void
}

/** SchemaForm 组件 */
export default function SchemaForm<T extends Record<string, unknown>>({
  typeName,
  data = undefined,
  columns = 1,
  labelPosition = 'top',
  readOnly = false,
  onChange,
  onConfirm,
  onCancel,
}: SchemaFormProps<T>) {
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

  /**
   * 获取字段的默认值
   * @param typeStr
   * @param formatStr
   */
  const getDefaultValue = (typeStr: string, formatStr: string): unknown => {
    if (formatStr.includes('date-time')) return new Date().getTime()
    if (typeStr.includes('boolean')) return false
    if (
      typeStr.includes('number') ||
      typeStr.includes('int') ||
      typeStr.includes('double')
    )
      return 0
    return ''
  }

  const schema = schemas[typeName] as SchemaType
  // 初始化 formData，补全缺失字段
  const initialFormData = {
    ...(data ?? {}),
    ...(Object.fromEntries(
      Object.keys(schema)
        .filter((key) => !(key in (data ?? {})))
        .map((key) => [
          key,
          getDefaultValue(schema[key]?.type || '', schema[key]?.format || ''),
        ]),
    ) as Record<string, unknown>),
  } as T
  // 表单数据状态
  const [formData, setFormData] = useState<T>(initialFormData)
  if (!formData) return null

  /** 更新字段值 */
  const updateField = (key: keyof T, value: unknown) => {
    const newData = { ...formData, [key]: value }
    setFormData(newData)
    onChange?.(newData)
  }

  return (
    <Card className="w-full border-none p-0 shadow-none">
      <MagicCard gradientColor={gradientColor} className="p-4">
        <div
          className="gap-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {Object.keys(schema).map((key) => {
            const fieldKey = key as keyof T
            const schemaField = schema[key]
            const value = formData[fieldKey]
            const labelText = schemaField?.description ?? key

            const isDateTime = schemaField?.format?.includes('date-time')
            const isBoolean = schemaField?.type.includes('boolean')
            const isNumber =
              schemaField?.type.includes('number') ||
              schemaField?.type.includes('int') ||
              schemaField?.type.includes('double')

            return (
              <div key={key} className="flex flex-col gap-2">
                {labelPosition === 'top' && (
                  <Label className="text-sm font-medium">{labelText}</Label>
                )}

                <div
                  className={
                    labelPosition === 'left'
                      ? 'flex items-center gap-2'
                      : 'flex flex-col'
                  }
                >
                  {labelPosition === 'left' && (
                    <Label className="w-24 text-sm font-medium">
                      {labelText}
                    </Label>
                  )}
                  {/*根据类型渲染不同的输入组件*/}
                  {isBoolean ? (
                    <Checkbox
                      checked={value as boolean}
                      onCheckedChange={(v) => updateField(fieldKey, v)}
                      disabled={readOnly}
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
                      disabled={readOnly}
                      onChange={(e) => {
                        let newValue: unknown = e.target.value
                        if (isDateTime) {
                          newValue = new Date(e.target.value).getTime()
                        } else if (isNumber) {
                          newValue = Number(e.target.value)
                        }
                        updateField(fieldKey, newValue)
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/*操作*/}
        <div className="mt-6 flex justify-end gap-4">
          <Button variant="outline" onClick={onCancel}>
            <X />
          </Button>
          {!readOnly && (
            <Button onClick={() => onConfirm?.(formData)}>
              <Check />
            </Button>
          )}
        </div>
      </MagicCard>
    </Card>
  )
}
