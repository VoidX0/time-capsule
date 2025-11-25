import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { ArrowRightLeft, CircleCheckBig } from 'lucide-react'
import { useMemo, useState } from 'react'

interface SchemaTableFooterProps {
  /** 当前页码 */
  currentPage: number
  /** 每页数量 */
  pageSize: number
  /** 数据总数 */
  total: number
  /** 选中行索引数组 */
  selectedKeys?: number[]
  /** 页码变更回调 */
  onPageChange: (page: number) => void
  /** 全选回调 */
  onSelectAllClick?: () => void
}

/** 表格底部组件 */
export function SchemaTableFooter({
  currentPage,
  pageSize,
  total,
  selectedKeys,
  onPageChange,
  onSelectAllClick,
}: SchemaTableFooterProps) {
  // 最大页码按钮数
  const maxButtons = 5
  // 总页数
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )
  // 跳转输入框值
  const [jumpValue, setJumpValue] = useState(String(currentPage))
  /** 页码按钮生成（带省略号） */
  const getPageNumbers = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    const side = Math.floor((maxButtons - 3) / 2)
    const left = Math.max(2, currentPage - side)
    const right = Math.min(totalPages - 1, currentPage + side)

    pages.push(1)
    if (left > 2) pages.push('...')

    for (let i = left; i <= right; i++) pages.push(i)

    if (right < totalPages - 1) pages.push('...')
    pages.push(totalPages)

    return pages
  }
  /** 跳转到指定页码 */
  const goToPage = (p: number) => {
    const page = Math.min(Math.max(1, p), totalPages)
    setJumpValue(String(page))
    onPageChange(page)
  }

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-3 md:flex-row md:items-center md:justify-between">
      {/* 已选数量 */}
      <div
        className="text-muted-foreground flex items-center gap-1 text-sm whitespace-nowrap"
        onClick={onSelectAllClick}
      >
        <CircleCheckBig />
        {selectedKeys?.length || 0} / {total}
      </div>

      {/* Pagination */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
              className={
                currentPage <= 1 ? 'pointer-events-none opacity-50' : ''
              }
            />
          </PaginationItem>

          {getPageNumbers().map((p, index) =>
            p === '...' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === currentPage}
                  onClick={() => goToPage(p as number)}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() =>
                currentPage < totalPages && goToPage(currentPage + 1)
              }
              className={
                currentPage >= totalPages
                  ? 'pointer-events-none opacity-50'
                  : ''
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* 跳页功能 */}
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="text-muted-foreground h-4 w-4" />
        <Input
          className="h-8 w-16"
          value={jumpValue}
          onChange={(e) => {
            const val = e.target.value
            setJumpValue(val)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const num = Number(jumpValue)
              if (!isNaN(num)) goToPage(num)
            }
          }}
          onBlur={() => {
            const num = Number(jumpValue)
            if (isNaN(num)) setJumpValue(String(currentPage))
            else goToPage(num)
          }}
        />
        <span className="text-sm whitespace-nowrap">/ {totalPages}</span>
      </div>
    </div>
  )
}
