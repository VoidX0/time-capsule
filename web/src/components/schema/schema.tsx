import { QueryDto, schemas } from '@/api/generatedSchemas'
import { MagicCard } from '@/components/magicui/magic-card'
import SchemaTable from '@/components/schema/schema-table'
import { SchemaTableFooter } from '@/components/schema/schema-table-footer'
import { SchemaTableHeader } from '@/components/schema/schema-table-header'
import { Card } from '@/components/ui/card'
import { openapi } from '@/lib/http'
import { useTheme } from 'next-themes'
import {
  forwardRef,
  Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'

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
  /** 查询分页数据回调 */
  fetchPageData?: (
    queryDto: QueryDto,
    page: number,
    pageSize: number,
  ) => Promise<{ items: T[]; total: number }>
  /** 新增回调 */
  onAdd?: (item: T) => Promise<boolean>
  /** 编辑回调 */
  onEdit?: (item: T) => Promise<boolean>
  /** 删除回调 */
  onDelete?: (items: T[]) => Promise<boolean>
}

/** Schema表格管理组件引用实例 */
export interface SchemaRef<T> {
  /** 获取当前选中的数据 */
  getSelectedData: () => T[]
  /** 获取当前所有数据 */
  getData: () => T[]
}

/**
 * Schema表格管理组件
 */
const Schema = forwardRef(function Schema<T extends Record<string, unknown>>(
  props: SchemaProps<T>,
  ref: Ref<SchemaRef<T>>,
) {
  // 生成动态颜色
  const { resolvedTheme } = useTheme()
  const gradientColor = useMemo(() => {
    return resolvedTheme === 'dark' ? '#262626' : '#D9D9D955'
  }, [resolvedTheme])

  // props 解构
  const {
    typeName,
    controller,
    title,
    pageSize = 10,
    labelMap = {},
    readOnly = false,
    fetchPageData,
    onAdd,
    onEdit,
    onDelete,
  } = props
  // 正在加载所有数据
  const [isLoadingAllData, setIsLoadingAllData] = useState(false)
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

  /** 加载数据 */
  useEffect(() => {
    const load = async () => {
      const body: QueryDto = {
        ...queryDto,
        pageNumber: currentPage,
        pageSize: pageSize,
      }

      let pagedItems: T[] = []
      let totalCount = 0
      // 请求
      if (fetchPageData) {
        // 自定义回调
        const res = await fetchPageData(queryDto, currentPage, pageSize)
        pagedItems = res.items
        totalCount = res.total
      } else if (controller) {
        // 通用控制器请求
        // @ts-expect-error 动态调用接口
        const { data: res } = await openapi.POST(`/${controller}/Query`, {
          body,
        })
        if (res) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pagedItems = (res as any).items || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalCount = Number((res as any).totalCount) || 0
        }
      }

      // 更新状态
      setData((prevData) => {
        // 如果是首次加载，或者总数发生了变化，重置整个数组
        let nextData = prevData
        if (prevData.length !== totalCount) {
          nextData = Array(totalCount).fill({}) // 设置总行数占位
          setSelectedKeys([]) // 清空已选择项
        }

        // 计算当前页在全局数组中的位置
        const start = (currentPage - 1) * pageSize
        const end = start + pagedItems.length
        // 将当前页数据填充到大数组的对应位置
        return [
          ...nextData.slice(0, start),
          ...pagedItems,
          ...nextData.slice(end), // 处理后续空位
        ]
      })
    }

    load().then()
  }, [controller, currentPage, fetchPageData, pageSize, queryDto])

  /** 加载所有数据 */
  const handleLoadAllData = async () => {
    setIsLoadingAllData(true)

    try {
      const totalPages = Math.ceil(data.length / pageSize)
      const requests: Promise<{ page: number; items: T[] } | null>[] = []

      // 定义纯粹的获取数据函数 (不操作 State)
      const fetchPage = async (page: number) => {
        const body: QueryDto = {
          ...queryDto,
          pageNumber: page,
          pageSize: pageSize,
        }

        try {
          if (fetchPageData) {
            const res = await fetchPageData(queryDto, page, pageSize)
            return { page, items: res.items }
          } else if (controller) {
            // @ts-expect-error 动态调用
            const { data: res } = await openapi.POST(`/${controller}/Query`, {
              body,
            })
            if (res) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return { page, items: (res as any).items || [] }
            }
          }
        } catch (err) {
          console.error(`Page ${page} load failed`, err)
        }
        return null
      }

      // 准备所有请求 (并发)
      for (let page = 1; page <= totalPages; page++) {
        requests.push(fetchPage(page))
      }
      // 等待所有请求完成
      const results = await Promise.all(requests)
      // 组装数据 & 一次性更新 State
      setData((prevData) => {
        // 创建一个新的数组副本
        const nextData = [...prevData]
        results.forEach((res) => {
          if (res && res.items) {
            const start = (res.page - 1) * pageSize
            // 使用 splice 高效替换数据
            nextData.splice(start, res.items.length, ...res.items)
          }
        })

        return nextData
      })
    } catch (error) {
      console.error('Load all data failed', error)
    } finally {
      setIsLoadingAllData(false)
    }
  }

  /** 导出 Excel */
  const handleDownload = async () => {
    // 发起请求
    const { data, response } = await openapi.POST(
      // @ts-expect-error 动态调用接口
      `/${controller}/DownloadExcel`,
      {
        body: queryDto, // 传入当前的查询条件
        parseAs: 'blob', // 强制将响应解析为 Blob 对象，而不是 JSON
      },
    )

    // 获取文件名 (从 Content-Disposition 响应头中提取)
    // 后端返回格式通常是: attachment; filename="User_Export_20251125.xlsx"
    const contentDisposition = response.headers.get('content-disposition')
    let filename = `${typeName}_Export.xlsx` // 默认文件名
    if (contentDisposition) {
      // 正则提取 filename="xxx.xlsx" 或 filename=xxx.xlsx
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
        contentDisposition,
      )
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '') // 去除可能存在的引号
      }
    }
    // 触发浏览器下载
    const url = window.URL.createObjectURL(data as unknown as Blob) // 创建一个临时的 Blob URL
    // 创建一个隐藏的 a 标签
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename) // 设置下载文件名
    document.body.appendChild(link)
    // 模拟点击
    link.click()
    // 清理资源
    link.remove() // 移除 a 标签
    window.URL.revokeObjectURL(url) // 释放 Blob URL 内存
  }

  /** 暴露方法给父组件 */
  useImperativeHandle(
    ref,
    () => ({
      getSelectedData: () => selectedData.map((item) => item as T),
      getData: () => data,
    }),
    [selectedData, data],
  )

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
            data={data}
            selectedData={selectedData as T[]}
            readOnly={readOnly}
            isLoadingAllData={isLoadingAllData}
            onVisibleColumnsChange={(cols) =>
              setVisibleColumns(cols as string[])
            }
            onAdd={(item) => handleAdd(item)}
            onEdit={(item) => handleEdit(item)}
            onDelete={(items) => handleDelete(items)}
            onConditionChange={(conditions) =>
              setQueryDto({ ...queryDto, condition: conditions })
            }
            onOrderChange={(orders) =>
              setQueryDto({ ...queryDto, order: orders })
            }
            onLoadAllData={handleLoadAllData}
            onDownload={handleDownload}
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
}) as <T extends Record<string, unknown>>(
  props: SchemaProps<T> & { ref?: Ref<SchemaRef<T>> },
) => React.ReactElement

export default Schema
