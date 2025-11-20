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
