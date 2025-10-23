/**
 * 时间估计工具函数
 * 用于时间解析、格式化、编码/解码等操作
 */

/**
 * 解析用户输入的时间估计（支持多种格式）
 * @param input 用户输入的字符串（如 "2小时"、"120分钟"、"2h"）
 * @returns 分钟数，解析失败返回 null
 */
export function parseTimeEstimate(input: string): number | null {
  if (!input || typeof input !== 'string') return null
  
  const normalized = input.toLowerCase().trim()
  
  // 去掉 buffer 相关文字（不影响解析）
  const cleanText = normalized.replace(/[\+\s]*(buffer|缓冲|余量)/gi, '').trim()
  
  // 解析模式（按常见程度排序）
  const patterns: Array<{
    regex: RegExp
    parse: (match: RegExpMatchArray) => number
  }> = [
    // 1. 纯数字（假设是分钟）
    {
      regex: /^(\d+)$/,
      parse: (m) => parseInt(m[1])
    },
    
    // 2. X小时Y分钟（如 "2小时30分钟"）
    {
      regex: /(\d+)\s*(?:小时|h|hour|hours?)\s*(\d+)\s*(?:分钟|分|min|minute|minutes?)/i,
      parse: (m) => parseInt(m[1]) * 60 + parseInt(m[2])
    },
    
    // 3. X小时（如 "2小时"、"2h"）
    {
      regex: /(\d+)\s*(?:小时|h|hour|hours?)/i,
      parse: (m) => parseInt(m[1]) * 60
    },
    
    // 4. X.X小时（如 "2.5小时"）
    {
      regex: /(\d+\.\d+)\s*(?:小时|h|hour|hours?)/i,
      parse: (m) => Math.round(parseFloat(m[1]) * 60)
    },
    
    // 5. X分钟（如 "90分钟"、"90min"）
    {
      regex: /(\d+)\s*(?:分钟|分|min|minute|minutes?)/i,
      parse: (m) => parseInt(m[1])
    },
  ]
  
  for (const pattern of patterns) {
    const match = cleanText.match(pattern.regex)
    if (match) {
      const minutes = pattern.parse(match)
      // 验证结果合理性（1分钟到1440分钟，即24小时）
      if (minutes > 0 && minutes <= 1440) {
        return minutes
      }
    }
  }
  
  return null
}

/**
 * 格式化分钟数为友好的显示文本
 * @param minutes 分钟数
 * @returns 格式化后的字符串（如 "2小时"、"2小时30分钟"）
 */
export function formatMinutes(minutes: number | string): string {
  const num = typeof minutes === 'string' ? parseInt(minutes) : minutes
  
  if (isNaN(num) || num <= 0) return ''
  
  if (num < 60) {
    return `${num} minutes`
  }
  
  const hours = Math.floor(num / 60)
  const mins = num % 60
  
  if (mins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`
}

/**
 * 格式化为简短显示（如 "2h30m"）
 * @param minutes 分钟数
 * @returns 简短格式字符串
 */
export function formatMinutesShort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (mins === 0) {
    return `${hours}h`
  }
  
  return `${hours}h${mins}m`
}

/**
 * 检测文本中是否包含 buffer 标记
 * @param text 文本
 * @returns 是否包含 buffer
 */
export function hasBufferTag(text: string): boolean {
  if (!text) return false
  return /buffer|缓冲|余量/i.test(text)
}

/**
 * 计算缓冲时间（默认20%）
 * @param minutes 原始分钟数
 * @param percent 缓冲百分比（默认20）
 * @returns 缓冲分钟数
 */
export function calculateBuffer(minutes: number, percent: number = 20): number {
  return Math.ceil(minutes * (percent / 100))
}

/**
 * 添加缓冲时间
 * @param minutes 原始分钟数
 * @param percent 缓冲百分比（默认20）
 * @returns 包含缓冲的总分钟数
 */
export function addBuffer(minutes: number, percent: number = 20): number {
  return minutes + calculateBuffer(minutes, percent)
}

/**
 * 编码时间估计（用于存储到数据库）
 * @param minutes 原始分钟数
 * @param hasBuffer 是否包含缓冲
 * @returns 编码后的数值（10000+ 表示含buffer）
 */
export function encodeEstimatedDuration(
  minutes: number,
  hasBuffer: boolean
): number {
  if (hasBuffer) {
    const totalMinutes = addBuffer(minutes)
    return 10000 + totalMinutes
  }
  return minutes
}

/**
 * 解码时间估计（从数据库读取）
 * @param encoded 编码后的数值
 * @returns { minutes: 原始分钟数, hasBuffer: 是否含buffer, totalMinutes: 总分钟数 }
 */
export function decodeEstimatedDuration(encoded: number | undefined): {
  minutes: number
  hasBuffer: boolean
  totalMinutes: number
} {
  if (!encoded || encoded <= 0) {
    return { minutes: 0, hasBuffer: false, totalMinutes: 0 }
  }
  
  if (encoded >= 10000) {
    // 含buffer
    const totalMinutes = encoded - 10000
    const originalMinutes = Math.round(totalMinutes / 1.2)
    return {
      minutes: originalMinutes,
      hasBuffer: true,
      totalMinutes: totalMinutes
    }
  }
  
  // 不含buffer
  return {
    minutes: encoded,
    hasBuffer: false,
    totalMinutes: encoded
  }
}

/**
 * 格式化编码后的时间估计为显示文本
 * @param encoded 编码后的数值
 * @returns 格式化的显示文本（如 "90分钟（含缓冲）"）
 */
export function formatEncodedDuration(encoded: number | undefined): string {
  const { totalMinutes, hasBuffer } = decodeEstimatedDuration(encoded)
  
  if (totalMinutes === 0) return ''
  
  return hasBuffer ? `${totalMinutes} minutes (with buffer)` : `${totalMinutes} minutes`
}

/**
 * 验证时间估计的合理性
 * @param minutes 分钟数
 * @returns { valid: boolean, message?: string }
 */
export function validateTimeEstimate(minutes: number): {
  valid: boolean
  message?: string
} {
  if (isNaN(minutes)) {
    return { valid: false, message: 'Please enter a valid number' }
  }
  
  if (minutes <= 0) {
    return { valid: false, message: 'Time must be greater than 0' }
  }
  
  if (minutes > 1440) {
    return { valid: false, message: 'Time cannot exceed 24 hours' }
  }
  
  if (minutes < 5) {
    return { valid: false, message: 'Recommended minimum is 5 minutes' }
  }
  
  return { valid: true }
}

/**
 * 获取常用的快速选择时间选项
 * @returns 分钟数数组
 */
export function getQuickTimeOptions(): number[] {
  return [15, 30, 45, 60, 90, 120, 180, 240, 360]
}

/**
 * 计算多个任务的总时长
 * @param durations 编码后的时间数组
 * @returns 总分钟数
 */
export function sumDurations(durations: (number | undefined)[]): number {
  return durations.reduce((sum, encoded) => {
    const { totalMinutes } = decodeEstimatedDuration(encoded)
    return sum + totalMinutes
  }, 0)
}

