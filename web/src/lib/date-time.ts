import { DateRange } from 'react-day-picker'

/**
 * 最近一周的时间范围
 */
export function rangeWeek(): DateRange {
  const now = Date.now()
  const weeksAgo = now - 7 * 24 * 60 * 60 * 1000
  const nowDate = new Date(now)
  const weeksAgoDate = new Date(weeksAgo)
  return {
    from: new Date(
      weeksAgoDate.getFullYear(),
      weeksAgoDate.getMonth(),
      weeksAgoDate.getDate(),
      0,
      0,
      0,
    ),
    to: new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      23,
      59,
      59,
    ),
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param date
 */
export function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间为 HH:MM:SS
 * @param date
 */
export function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:MM:SS
 * @param date
 */
export function formatDateTime(date: Date) {
  return `${formatDate(date)} ${formatTime(date)}`
}
