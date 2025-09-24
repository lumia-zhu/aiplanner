// 简单的iCal解析器作为备用方案
export interface SimpleICalEvent {
  uid: string
  summary: string
  description?: string
  dtstart?: string
  dtend?: string
  location?: string
  url?: string
}

/**
 * 简单的iCal解析器（备用方案）
 * 如果ical.js库有问题，可以使用这个简单的解析器
 */
export function parseICalSimple(icalData: string): SimpleICalEvent[] {
  const events: SimpleICalEvent[] = []
  
  try {
    // 按行分割
    const lines = icalData.split(/\r?\n/)
    let currentEvent: Partial<SimpleICalEvent> | null = null
    let currentProperty = ''
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim()
      
      // 处理多行属性（以空格或制表符开头的行是前一行的继续）
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
        i++
        line += lines[i].trim()
      }
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {}
      } else if (line === 'END:VEVENT' && currentEvent) {
        // 验证必需字段
        if (currentEvent.uid && currentEvent.summary) {
          events.push(currentEvent as SimpleICalEvent)
        }
        currentEvent = null
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':')
        const property = line.substring(0, colonIndex)
        const value = line.substring(colonIndex + 1)
        
        // 解析属性名（可能包含参数）
        const propName = property.split(';')[0].toUpperCase()
        
        switch (propName) {
          case 'UID':
            currentEvent.uid = value
            break
          case 'SUMMARY':
            currentEvent.summary = unescapeICalValue(value)
            break
          case 'DESCRIPTION':
            currentEvent.description = unescapeICalValue(value)
            break
          case 'DTSTART':
            currentEvent.dtstart = value
            break
          case 'DTEND':
            currentEvent.dtend = value
            break
          case 'LOCATION':
            currentEvent.location = unescapeICalValue(value)
            break
          case 'URL':
            currentEvent.url = value
            break
        }
      }
    }
    
    console.log('简单解析器解析到的事件数量:', events.length)
    return events
    
  } catch (error) {
    console.error('简单iCal解析失败:', error)
    throw new Error('iCal数据解析失败')
  }
}

/**
 * 解析iCal日期时间
 */
export function parseICalDateTime(dtString: string): Date | null {
  if (!dtString) return null
  
  try {
    // 移除参数部分，只保留日期时间值
    const dateValue = dtString.split(';').pop() || dtString
    
    // 处理不同的日期时间格式
    if (dateValue.length === 8) {
      // YYYYMMDD 格式（全天事件）
      const year = parseInt(dateValue.substring(0, 4))
      const month = parseInt(dateValue.substring(4, 6)) - 1 // JavaScript月份从0开始
      const day = parseInt(dateValue.substring(6, 8))
      return new Date(year, month, day)
    } else if (dateValue.length === 15 && dateValue.endsWith('Z')) {
      // YYYYMMDDTHHMMSSZ 格式（UTC时间）
      const year = parseInt(dateValue.substring(0, 4))
      const month = parseInt(dateValue.substring(4, 6)) - 1
      const day = parseInt(dateValue.substring(6, 8))
      const hour = parseInt(dateValue.substring(9, 11))
      const minute = parseInt(dateValue.substring(11, 13))
      const second = parseInt(dateValue.substring(13, 15))
      return new Date(Date.UTC(year, month, day, hour, minute, second))
    } else if (dateValue.length === 15) {
      // YYYYMMDDTHHMMSS 格式（本地时间）
      const year = parseInt(dateValue.substring(0, 4))
      const month = parseInt(dateValue.substring(4, 6)) - 1
      const day = parseInt(dateValue.substring(6, 8))
      const hour = parseInt(dateValue.substring(9, 11))
      const minute = parseInt(dateValue.substring(11, 13))
      const second = parseInt(dateValue.substring(13, 15))
      return new Date(year, month, day, hour, minute, second)
    }
    
    // 尝试使用Date构造函数解析
    return new Date(dateValue)
    
  } catch (error) {
    console.warn('解析日期时间失败:', dtString, error)
    return null
  }
}

/**
 * 反转义iCal值
 */
function unescapeICalValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}
