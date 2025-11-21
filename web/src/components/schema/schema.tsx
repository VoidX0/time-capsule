import { schemas } from '@/api/generatedSchemas'
import { components } from '@/api/schema'
import { MagicCard } from '@/components/magicui/magic-card'
import SchemaTable from '@/components/schema/schema-table'
import { SchemaTableFooter } from '@/components/schema/schema-table-footer'
import { SchemaTableHeader } from '@/components/schema/schema-table-header'
import { Card } from '@/components/ui/card'
import { openapi } from '@/lib/http'
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

/**
 * Schema表格管理属性
 */
interface SchemaProps<T extends Record<string, unknown>> {
  /** 类型名 */
  typeName: keyof typeof schemas
  /** 后端控制器名称 */
  controller?: string
  /** 表格标题 */
  title?: string
  /** 每页数量 */
  pageSize?: number
  /** label 映射 */
  labelMap?: Partial<Record<keyof T, string>>
  /** 只读模式 */
  readOnly?: boolean
  /** 查询总数回调 */
  fetchTotalCount?: (queryDto: QueryDto) => Promise<number>
  /** 查询分页数据回调 */
  fetchPageData?: (
    queryDto: QueryDto,
    page: number,
    pageSize: number,
  ) => Promise<T[]>
  /** 新增回调 */
  onAdd?: (item: T) => Promise<boolean>
  /** 编辑回调 */
  onEdit?: (item: T) => Promise<boolean>
  /** 删除回调 */
  onDelete?: (items: T[]) => Promise<boolean>
}

type QueryDto = components['schemas']['QueryDto']
/**
 * Schema表格管理组件
 */
export default function Schema<T extends Record<string, unknown>>({
  typeName,
  controller,
  title,
  pageSize = 10,
  labelMap = {},
  readOnly = false,
  fetchTotalCount,
  fetchPageData,
  onAdd,
  onEdit,
  onDelete,
}: SchemaProps<T>) {
  // 生成动态颜色
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

  // 当前页码
  const [currentPage, setCurrentPage] = useState(1)
  // 查询参数
  const [queryDto, setQueryDto] = useState<QueryDto>({})
  // 所有数据
  const [data, setData] = useState<T[]>([])
  // 当前显示列
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    Object.keys(schemas[typeName] || {}),
  )
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

  /** 新增回调 */
  const handleAdd = async (item: T): Promise<boolean> => {
    if (onAdd) {
      // 使用自定义回调
      const result = await onAdd(item)
      if (result) setQueryDto({ ...queryDto }) // 重新加载数据
      return result
    } else {
      // @ts-expect-error 动态调用接口
      const { error } = await openapi.POST(`/${controller}/Insert`, {
        body: [item],
      })
      if (!error) setQueryDto({ ...queryDto }) // 重新加载数据
      return !error
    }
  }

  /** 编辑回调 */
  const handleEdit = async (item: T): Promise<boolean> => {
    if (onEdit) {
      // 使用自定义回调
      const result = await onEdit(item)
      if (result) setQueryDto({ ...queryDto }) // 重新加载数据
      return result
    } else {
      // @ts-expect-error 动态调用接口
      const { error } = await openapi.PUT(`/${controller}/Update`, {
        body: [item],
      })
      if (!error) setQueryDto({ ...queryDto }) // 重新加载数据
      return !error
    }
  }

  /** 删除回调 */
  const handleDelete = async (items: T[]): Promise<boolean> => {
    if (onDelete) {
      // 使用自定义回调
      const result = await onDelete(items)
      if (result) setQueryDto({ ...queryDto }) // 重新加载数据
      return result
    } else {
      // @ts-expect-error 动态调用接口
      const { error } = await openapi.DELETE(`/${controller}/Delete`, {
        body: items,
      })
      if (!error) setQueryDto({ ...queryDto }) // 重新加载数据
      return !error
    }
  }

  /** 初始化加载数据 */
  useEffect(() => {
    /** 控制器API获取总数 */
    const fetch = async (): Promise<number> => {
      const body: QueryDto = {
        ...queryDto,
        pageNumber: 0,
        pageSize: 0,
      }
      // @ts-expect-error 动态调用接口
      const { data } = await openapi.POST(`/${controller}/Count`, { body })
      return data ? Number(data) : 0
    }

    const loader = fetchTotalCount
      ? fetchTotalCount(queryDto) // 使用自定义回调
      : controller
        ? fetch() // 使用控制器API
        : null

    loader?.then((total) => {
      setData(Array(total).fill({})) // 设置总行数占位
      setSelectedKeys([]) // 清空已选择项
    })
  }, [controller, fetchTotalCount, queryDto])

  /** 加载当前页数据 */
  useEffect(() => {
    /** 获取分页数据 */
    const fetch = async (page: number): Promise<T[]> => {
      const body: QueryDto = {
        ...queryDto,
        pageNumber: page,
        pageSize: pageSize,
      }
      // @ts-expect-error 动态调用接口
      const { data } = await openapi.POST(`/${controller}/Query`, { body })
      return data ? (data as unknown as T[]) : []
    }

    const loader = fetchPageData
      ? fetchPageData(queryDto, currentPage, pageSize) // 使用自定义回调
      : controller
        ? fetch(currentPage) // 使用控制器API
        : Promise.resolve([])

    if (currentPage <= 0) return // 不加载数据
    loader.then((pageData) => {
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
  }, [controller, currentPage, fetchPageData, pageSize, queryDto])

  return (
    <Card className="w-full overflow-auto border-none p-0 shadow-none">
      <MagicCard gradientColor={gradientColor} className="p-4">
        {/*Header区域*/}
        <div className="mb-4">
          <SchemaTableHeader
            title={title || ''}
            typeName={typeName}
            visibleColumns={visibleColumns as (keyof T)[]}
            labelMap={labelMap}
            queryDto={queryDto}
            selectedData={selectedData as T[]}
            readOnly={readOnly}
            onVisibleColumnsChange={(cols) =>
              setVisibleColumns(cols as string[])
            }
            onAdd={(item) => handleAdd(item)}
            onEdit={(item) => handleEdit(item)}
            onDelete={(items) => handleDelete(items)}
            onQueryDtoChange={(dto) => setQueryDto(dto)}
          />
        </div>
        {/*表格区域*/}
        <div>
          <SchemaTable
            typeName={typeName}
            data={displayData}
            labelMap={labelMap}
            visibleColumns={visibleColumns}
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
