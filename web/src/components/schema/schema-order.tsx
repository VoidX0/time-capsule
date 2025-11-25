import { QueryOrder, schemas } from '@/api/generatedSchemas'
import { SchemaType } from '@/components/schema/schema'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUpAZ, ArrowUpZA, Check, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

interface SchemaOrderProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 初始条件 */
  orders?: QueryOrder[]
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 条件变更回调 */
  onOrderChange?: (orders: QueryOrder[]) => void
  /** 确认条件变更回调 */
  onSubmit?: (value: QueryOrder[]) => void
}

export function SchemaOrder<T extends Record<string, unknown>>({
  typeName,
  orders = [],
  labelMap = {},
  onOrderChange,
  onSubmit,
}: SchemaOrderProps<T>) {
  const schema = schemas[typeName] as SchemaType
  const columns = useMemo(() => Object.keys(schema) as (keyof T)[], [schema])

  /** 获取列的显示标签 */
  const getColumnLabel = (col: keyof T) => {
    return labelMap?.[col] ?? schema[col as string]?.description ?? String(col)
  }

  /** 提交条件 */
  const submit = (orders: QueryOrder[]) => {
    const ord = orders
      .filter((c) => c.orderByType !== undefined)
      .map((c) => {
        // value统一转为number
        return {
          ...c,
          orderByType: Number(c.orderByType),
        }
      })

    onSubmit?.(ord) // 调用提交回调
  }

  return (
    <>
      <div className="mb-2 flex justify-end gap-2">
        {/*提交按钮*/}
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            submit(orders)
          }}
        >
          <Check className="h-4 w-4" />
        </Button>
        {/* 重置按钮 */}
        {orders.some((c) => c.orderByType !== undefined) && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              const resetOrders = orders.map((c) => ({
                ...c,
                orderByType: undefined,
              }))
              onOrderChange?.(resetOrders)
              submit(resetOrders)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 条件列表 */}
      <div className="flex max-h-96 flex-col gap-2 overflow-auto">
        {columns.map((col) => {
          const order = orders.find((c) => c.fieldName === col)
          const value = order?.orderByType

          return (
            <div key={String(col)} className="flex items-center gap-2">
              {/* 字段名 */}
              <span className="w-24 text-sm">{getColumnLabel(col)}</span>
              {/* 类型 */}
              <Select
                value={value === undefined ? undefined : String(value)}
                onValueChange={(value) => {
                  const newOrders = orders.map((c) =>
                    c.fieldName === col
                      ? { ...c, orderByType: Number(value) }
                      : c,
                  )
                  onOrderChange?.(newOrders)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    <span className="mr-2">
                      <ArrowUpAZ />
                    </span>
                    <span className="text-muted-foreground text-xs">Asc</span>
                  </SelectItem>
                  <SelectItem value="1">
                    <span className="mr-2">
                      <ArrowUpZA />
                    </span>
                    <span className="text-muted-foreground text-xs">Desc</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </>
  )
}
