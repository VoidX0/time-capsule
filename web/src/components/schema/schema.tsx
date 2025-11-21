import { schemas } from '@/api/generatedSchemas'
import { MagicCard } from '@/components/magicui/magic-card'
import SchemaTable from '@/components/schema/schema-table'
import { SchemaTableFooter } from '@/components/schema/schema-table-footer'
import { Card } from '@/components/ui/card'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'

/** schema 字段类型 */
export interface SchemaField {
  type: string
  description?: string
  format?: string
}

/** schema 类型 */
export type SchemaType = Record<string, SchemaField>

/**
 * 获取字段的默认值
 * @param typeStr
 * @param formatStr
 */
export function schemaDefaultValue(
  typeStr: string,
  formatStr: string,
): unknown {
  if (formatStr.includes('date-time')) return new Date('1970-01-01').getTime()
  if (typeStr.includes('boolean')) return false
  if (
    typeStr.includes('number') ||
    typeStr.includes('int') ||
    typeStr.includes('double')
  )
    return 0
  return ''
}

/**
 * Schema表格管理属性
 */
interface SchemaProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 每页数量 */
  pageSize?: number
}

/**
 * Schema表格管理组件
 */
export default function Schema<T extends Record<string, unknown>>({
  typeName,
  pageSize = 10,
}: SchemaProps<T>) {
  // 生成动态颜色
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

  // 当前页码
  const [currentPage, setCurrentPage] = useState(1)
  // 所有数据
  const [data, setData] = useState<T[]>([])
  // 显示的数据
  const displayData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return data?.slice(start, start + pageSize) || []
  }, [currentPage, data, pageSize])
  // 选中项索引
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  // 选中的数据
  const selectedData = useMemo(
    () => selectedKeys.map((key) => data[key]).filter((item) => item),
    [selectedKeys, data],
  )
  // 当前页选中项索引
  const currentKeys = useMemo(() => {
    const start = (currentPage - 1) * pageSize // 找到开始索引
    const end = start + pageSize // 找到结束索引
    const keys = selectedKeys.filter((key) => key >= start && key < end) // 找到在该范围内的已选择项
    return keys.map((key) => key - start) // 转换为当前页索引
  }, [currentPage, pageSize, selectedKeys])

  /** 选中项索引变化回调 */
  const handleSelectedChanged = (selected: number[]) => {
    const start = (currentPage - 1) * pageSize // 找到开始索引
    const globalSelected = selected.map((key) => key + start) // 转换为全局索引
    // 计算新的已选择项
    const newSelectedKeys = Array.from(
      new Set([
        ...selectedKeys.filter((key) => key < start || key >= start + pageSize), // 保留不在当前页的已选择项
        ...globalSelected, // 添加当前页已选择项
      ]),
    ).sort((a, b) => a - b)
    setSelectedKeys(newSelectedKeys)
  }

  /** 全选按钮点击回调 */
  const handleSelectAllClick = () => {
    // 获取所有已加载的数据索引
    const allKeys = data
      .map((item, index) => (Object.keys(item).length > 0 ? index : -1))
      .filter((index) => index !== -1)
    // 全部已选，取消全选
    if (selectedKeys.length === allKeys.length) {
      setSelectedKeys([])
    } else {
      // 未全部选中，执行全选
      setSelectedKeys(allKeys)
    }
  }

  /** 初始化加载数据 */
  useEffect(() => {
    /** 获取数据总数 */
    const fetch = async (): Promise<number> => {
      // 获取数据总数
      const totalCount = 955

      return totalCount
    }

    fetch().then((total) => {
      setData(Array(total).fill({})) // 设置总行数占位
      setSelectedKeys([]) // 清空已选择项
    })
  }, [])

  /** 加载当前页数据 */
  useEffect(() => {
    /** 获取分页数据 */
    const fetch = async (page: number): Promise<T[]> => {
      // 获取分页数据
      const currentDataCount = page != 96 ? 10 : 5
      const mockData: T[] = Array(currentDataCount).fill({ id: page })

      return mockData
    }

    fetch(currentPage).then((pageData) => {
      const start = (currentPage - 1) * pageSize // 找到开始索引
      const end = start + pageData.length // 找到结束索引
      // 更新数据
      setData((prevData) => {
        return [
          ...(prevData?.slice(0, start) || []),
          ...pageData,
          ...(prevData?.slice(end) || []),
        ]
      })
    })
  }, [currentPage, pageSize])

  return (
    <Card className="w-full overflow-auto border-none p-0 shadow-none">
      <MagicCard gradientColor={gradientColor} className="p-4">
        {/*Header区域*/}
        <div className="mb-4">Schema Table Header Slot</div>
        {/*表格区域*/}
        <div>
          <SchemaTable
            typeName={typeName}
            data={displayData}
            selectedKeys={currentKeys}
            onSelectedChanged={handleSelectedChanged}
          />
        </div>
        {/*Footer区域*/}
        <div className="mt-4">
          <SchemaTableFooter
            currentPage={currentPage}
            pageSize={pageSize}
            total={data.length}
            selectedKeys={selectedKeys}
            onPageChange={(page) => setCurrentPage(page)}
            onSelectAllClick={handleSelectAllClick}
          />
        </div>
      </MagicCard>
    </Card>
  )
}
