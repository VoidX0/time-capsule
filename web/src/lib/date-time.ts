import { DateRange } from 'react-day-picker'

/**
 * 最近一周的时间范围
 */
export function rangeWeek(): DateRange {
  const now = Date.now()
  const weeksAgo = now - 60 * 24 * 60 * 60 * 1000
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

export function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
