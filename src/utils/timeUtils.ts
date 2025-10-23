/**
 * 时间工具函数
 */

/**
 * 将分钟数格式化为易读的时长
 * @param minutes 分钟数
 * @returns 格式化后的时长字符串
 * 
 * @example
 * formatDuration(30)   // "30分钟"
 * formatDuration(60)   // "1小时"
 * formatDuration(90)   // "1.5小时"
 * formatDuration(150)  // "2.5小时"
 * formatDuration(480)  // "8小时"
 */
export function formatDuration(minutes: number): string {
  if (minutes === 0) {
    return ''
  }
  
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  
  const hours = minutes / 60
  
  // 如果是整数小时
  if (hours % 1 === 0) {
    return `${hours}小时`
  }
  
  // 如果有小数
  return `${hours}小时`
}

