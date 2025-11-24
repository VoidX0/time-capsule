import { schemas } from '@/api/generatedSchemas'
import { components } from '@/api/schema'
import { SchemaType } from '@/components/schema/schema'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatDateTime, formatTime } from '@/lib/date-time'
import { Check, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

type QueryCondition = components['schemas']['QueryCondition']

interface SchemaFilterProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 初始条件 */
  conditions?: QueryCondition[]
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 条件变更回调 */
  onConditionChange?: (conditions: QueryCondition[]) => void
  /** 确认条件变更回调 */
  onSubmit?: (value: QueryCondition[]) => void
}

export function SchemaFilter<T extends Record<string, unknown>>({
  typeName,
  conditions = [],
  labelMap = {},
  onConditionChange,
  onSubmit,
}: SchemaFilterProps<T>) {
  const schema = schemas[typeName] as SchemaType
  const columns = useMemo(() => Object.keys(schema) as (keyof T)[], [schema])

  /** 获取列的显示标签 */
  const getColumnLabel = (col: keyof T) => {
    return labelMap?.[col] ?? schema[col as string]?.description ?? String(col)
  }

  /** 提交条件 */
  const submit = (conditions: QueryCondition[]) => {
    const cond = conditions
      .filter((c) => c.fieldValue !== undefined)
      .map((c) => {
        // 处理范围数据
        if (Array.isArray(c.fieldValue)) {
          return {
            ...c,
            fieldValue: c.fieldValue
              .map(
                (v) =>
                  c.cSharpTypeName == 'DateTimeOffset'
                    ? formatDateTime(new Date(v)) // 转换为时间范围
                    : String(v), // 转换为数值范围
              )
              .join(','),
          }
        }
        // value统一转为string
        return {
          ...c,
          fieldValue: String(c.fieldValue),
        }
      })

    onSubmit?.(cond) // 调用提交回调
  }

  return (
    <>
      <div className="mb-2 flex justify-end gap-2">
        {/*提交按钮*/}
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            submit(conditions)
          }}
        >
          <Check className="h-4 w-4" />
        </Button>
        {/* 重置按钮 */}
        {conditions.some((c) => c.fieldValue !== undefined) && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              const resetConditions = conditions.map((c) => ({
                ...c,
                fieldValue: undefined,
              }))
              onConditionChange?.(resetConditions)
              submit(resetConditions)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 条件列表 */}
      <div className="flex max-h-96 flex-col gap-2 overflow-auto">
        {columns.map((col) => {
          const fieldSchema = schema[col as string]
          const condition = conditions.find((c) => c.fieldName === col)
          const value = condition?.fieldValue
          const conditionalType = condition?.conditionalType

          const isBoolean = fieldSchema?.type.includes('boolean')
          const isNumber =
            fieldSchema?.type.includes('number') ||
            fieldSchema?.type.includes('int') ||
            fieldSchema?.type.includes('double')
          const isDateTime = fieldSchema?.format?.includes('date-time')
          const isString = !isBoolean && !isNumber && !isDateTime

          return (
            <div key={String(col)} className="flex items-center gap-2">
              {/* 字段名 */}
              <span className="w-24 text-sm">{getColumnLabel(col)}</span>
              {/* 条件类型 */}
              <Select
                value={String(conditionalType)}
                onValueChange={(value) => {
                  const newConditions = conditions.map((c) =>
                    c.fieldName === col
                      ? { ...c, conditionalType: Number(value) }
                      : c,
                  )
                  onConditionChange?.(newConditions)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isBoolean || isNumber || isString) && (
                    <SelectItem value="0">
                      <span className="mr-2">=</span>
                      <span className="text-muted-foreground text-xs">
                        Equal
                      </span>
                    </SelectItem>
                  )}
                  {isString && (
                    <SelectItem value="1">
                      <span className="mr-2">~</span>
                      <span className="text-muted-foreground text-xs">
                        Like
                      </span>
                    </SelectItem>
                  )}
                  {isNumber && (
                    <SelectItem value="2">
                      <span className="mr-2">{'>'}</span>
                      <span className="text-muted-foreground text-xs">
                        GreaterThan
                      </span>
                    </SelectItem>
                  )}
                  {isNumber && (
                    <SelectItem value="4">
                      <span className="mr-2">{'<'}</span>
                      <span className="text-muted-foreground text-xs">
                        LessThan
                      </span>
                    </SelectItem>
                  )}
                  {(isNumber || isString) && (
                    <SelectItem value="10">
                      <span className="mr-2">!=</span>
                      <span className="text-muted-foreground text-xs">
                        NoEqual
                      </span>
                    </SelectItem>
                  )}
                  {(isNumber || isDateTime) && (
                    <SelectItem value="16">
                      <span className="mr-2">↔</span>
                      <span className="text-muted-foreground text-xs">
                        Range
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {/* 条件值 */}
              {isBoolean ? (
                <Checkbox
                  checked={Boolean(value)}
                  onCheckedChange={(v) => {
                    const newConditions = conditions.map((c) =>
                      c.fieldName === col ? { ...c, fieldValue: v } : c,
                    )
                    onConditionChange?.(newConditions as QueryCondition[])
                  }}
                />
              ) : conditionalType === 16 ? (
                // 范围输入值
                <div className="flex flex-col gap-2">
                  <Input
                    type={
                      isDateTime
                        ? 'datetime-local'
                        : isNumber
                          ? 'number'
                          : 'text'
                    }
                    value={
                      Array.isArray(value) && value[0] !== undefined
                        ? isDateTime
                          ? `${formatDate(new Date(Number(value[0])))}T${formatTime(new Date(Number(value[0])))}`
                          : value[0]
                        : ''
                    }
                    onChange={(e) => {
                      const newValue = Array.isArray(value)
                        ? [...value]
                        : [undefined, undefined]
                      newValue[0] = isNumber
                        ? String(e.target.value) // 使用string避免int64越界
                        : isDateTime
                          ? new Date(e.target.value).getTime()
                          : e.target.value
                      const newConditions = conditions.map((c) =>
                        c.fieldName === col
                          ? { ...c, fieldValue: newValue }
                          : c,
                      )
                      onConditionChange?.(newConditions as QueryCondition[])
                    }}
                    placeholder="From"
                  />
                  <Input
                    type={
                      isDateTime
                        ? 'datetime-local'
                        : isNumber
                          ? 'number'
                          : 'text'
                    }
                    value={
                      Array.isArray(value) && value[1] !== undefined
                        ? isDateTime
                          ? `${formatDate(new Date(Number(value[1])))}T${formatTime(new Date(Number(value[1])))}`
                          : value[1]
                        : ''
                    }
                    onChange={(e) => {
                      const newValue = Array.isArray(value)
                        ? [...value]
                        : [undefined, undefined]
                      newValue[1] = isNumber
                        ? String(e.target.value) // 使用string避免int64越界
                        : isDateTime
                          ? new Date(e.target.value).getTime()
                          : e.target.value
                      const newConditions = conditions.map((c) =>
                        c.fieldName === col
                          ? { ...c, fieldValue: newValue }
                          : c,
                      )
                      onConditionChange?.(newConditions as QueryCondition[])
                    }}
                    placeholder="To"
                  />
                </div>
              ) : (
                // 单个输入值
                <Input
                  type={
                    isDateTime ? 'datetime-local' : isNumber ? 'number' : 'text'
                  }
                  value={
                    isDateTime && value
                      ? `${formatDate(new Date(Number(value)))}T${formatTime(new Date(Number(value)))}`
                      : (value ?? '')
                  }
                  onChange={(e) => {
                    let v: string | number | undefined = e.target.value
                    if (isNumber) v = String(e.target.value) // 使用string避免int64越界
                    if (isDateTime) v = new Date(e.target.value).getTime()
                    const newConditions = conditions.map((c) =>
                      c.fieldName === col ? { ...c, fieldValue: v } : c,
                    )
                    onConditionChange?.(newConditions as QueryCondition[])
                  }}
                  placeholder="Value"
                />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
