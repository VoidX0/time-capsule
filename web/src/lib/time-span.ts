/**
 * 将 C# TimeSpan 字符串解析为毫秒数
 * @param timeSpan 格式为 [d.]hh:mm:ss[.fffffff] 的时间字符串
 * @returns 总毫秒数（浮点数，保留微秒精度）
 */
export function timeSpanToMilliseconds(timeSpan: string): number {
  // 处理负号
  const isNegative = timeSpan.startsWith('-')
  const cleanString = isNegative ? timeSpan.substring(1) : timeSpan

  // 区分天数和时间部分
  let days = 0
  let timePart = cleanString

  // 检查是否包含天数（格式为 "d.hh:mm:ss..."）
  const dotIndex = cleanString.indexOf('.')
  const firstColonIndex = cleanString.indexOf(':')

  // 如果点号存在且在第一个冒号之前，则点号前是天数
  if (dotIndex > -1 && dotIndex < firstColonIndex) {
    const parts = cleanString.split('.', 2) // 只分割一次
    days = parseInt(parts[0]!, 10)
    timePart = parts[1]!
  }

  // 分割时间部分（时:分:秒.毫秒）
  const timeParts = timePart.split(':')
  if (timeParts.length !== 3) {
    throw new Error(`Invalid TimeSpan format: ${timeSpan}`)
  }

  // 解析时分秒
  const hours = parseInt(timeParts[0]!, 10)
  const minutes = parseInt(timeParts[1]!, 10)

  // 处理秒和小数秒
  const secondsParts = timeParts[2]!.split('.')
  const seconds = parseInt(secondsParts[0]!, 10)

  // 处理小数秒（最高精度 100 纳秒）
  let milliseconds = 0
  if (secondsParts.length > 1) {
    // 补全到 7 位（C# 的 100 纳秒单位）
    const fractionalSeconds = secondsParts[1]!.padEnd(7, '0').substring(0, 7)
    milliseconds = parseInt(fractionalSeconds, 10) / 10000 // 转换为毫秒
  }

  // 计算总毫秒数
  const totalMs =
    days * 24 * 60 * 60 * 1000 +
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000 +
    milliseconds

  return isNegative ? -totalMs : totalMs
}
