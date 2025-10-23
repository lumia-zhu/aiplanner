/**
 * 日期工具函数
 * 提供日期范围计算、任务筛选等核心日期逻辑
 */

import type { Task, DateScope, DateScopePreset } from '@/types'

// ============================================
// 基础日期操作函数
// ============================================

/**
 * 获取日期的零点时间（00:00:00.000）
 * @param date 输入日期
 * @returns 零点时间的新Date对象
 */
export function getStartOfDay(date: Date): Date {
  const newDate = new Date(date)
  newDate.setHours(0, 0, 0, 0)
  return newDate
}

/**
 * 获取日期的结束时间（23:59:59.999）
 * @param date 输入日期
 * @returns 当天结束时间的新Date对象
 */
export function getEndOfDay(date: Date): Date {
  const newDate = new Date(date)
  newDate.setHours(23, 59, 59, 999)
  return newDate
}

/**
 * 判断两个日期是否为同一天
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 是否为同一天
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getStartOfDay(date1).getTime() === getStartOfDay(date2).getTime()
}

/**
 * 检查日期是否在范围内（包含边界）
 * @param date 要检查的日期
 * @param rangeStart 范围起始日期
 * @param rangeEnd 范围结束日期
 * @returns 是否在范围内
 */
export function isDateInRange(
  date: Date, 
  rangeStart: Date | null, 
  rangeEnd: Date | null
): boolean {
  if (!rangeStart || !rangeEnd) return false
  
  const dateTime = getStartOfDay(date).getTime()
  const startTime = getStartOfDay(rangeStart).getTime()
  const endTime = getStartOfDay(rangeEnd).getTime()
  
  return dateTime >= startTime && dateTime <= endTime
}

/**
 * 格式化日期为 YYYY-MM-DD 字符串
 * @param date 日期对象
 * @returns YYYY-MM-DD 格式字符串
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ============================================
// 日期范围计算函数
// ============================================

/**
 * 根据预设类型计算起止日期
 * @param preset 预设类型
 * @param referenceDate 参考日期（默认为当前时间）
 * @returns 包含起止日期的对象
 */
export function calculatePresetDates(
  preset: DateScopePreset,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const today = getStartOfDay(referenceDate)

  switch (preset) {
    case 'today':
      return {
        start: today,
        end: getEndOfDay(today)
      }

    case '3days': {
      const end = new Date(today)
      end.setDate(today.getDate() + 2) // 今天 + 2天 = 3天
      return {
        start: today,
        end: getEndOfDay(end)
      }
    }

    case '7days': {
      const end = new Date(today)
      end.setDate(today.getDate() + 6) // 今天 + 6天 = 7天
      return {
        start: today,
        end: getEndOfDay(end)
      }
    }

    case 'week': {
      // 本周一至周日
      const dayOfWeek = referenceDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 周日算作上周末，offset为-6
      const monday = new Date(today)
      monday.setDate(today.getDate() + mondayOffset)
      
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      
      return {
        start: getStartOfDay(monday),
        end: getEndOfDay(sunday)
      }
    }

    case 'month': {
      // 本月1号至月末
      const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
      const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
      
      return {
        start: getStartOfDay(firstDay),
        end: getEndOfDay(lastDay)
      }
    }

    case 'custom':
    default:
      // custom类型不应该调用此函数，返回今天作为fallback
      return {
        start: today,
        end: getEndOfDay(today)
      }
  }
}

// ============================================
// 任务筛选函数
// ============================================

/**
 * 检查任务是否逾期（截止日期 < 今天零点 且 未完成）
 * @param task 任务对象
 * @param now 当前时间（可选，默认为系统当前时间）
 * @returns 是否逾期
 */
export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  // 已完成的任务不算逾期
  if (task.completed) return false
  
  // 没有截止日期的任务不算逾期
  if (!task.deadline_datetime) return false
  
  const deadline = new Date(task.deadline_datetime)
  const todayStart = getStartOfDay(now)
  
  // 截止日期在今天之前（严格小于今天零点）
  return deadline < todayStart
}

/**
 * 检查任务是否在指定日期范围内
 * @param task 任务对象
 * @param scope 日期范围
 * @returns 是否在范围内
 */
export function isTaskInScope(task: Task, scope: DateScope): boolean {
  // 没有截止日期的任务：只在"今天"范围内显示
  if (!task.deadline_datetime) {
    const today = getStartOfDay(new Date())
    return scope.start.getTime() === today.getTime()
  }
  
  // 有截止日期的任务：检查截止日期是否在范围内
  const deadline = new Date(task.deadline_datetime)
  const deadlineDay = getStartOfDay(deadline)
  
  return deadlineDay >= scope.start && deadlineDay <= getStartOfDay(scope.end)
}

/**
 * 根据日期范围筛选任务列表
 * @param tasks 任务列表
 * @param scope 日期范围
 * @returns 筛选后的任务列表
 */
export function filterTasksByScope(tasks: Task[], scope: DateScope): Task[] {
  console.log('🔍 [filterTasksByScope] 开始筛选:')
  console.log('  - 输入任务数:', tasks.length)
  console.log('  - scope.start:', scope.start)
  console.log('  - scope.end:', scope.end)
  console.log('  - scope.includeOverdue:', scope.includeOverdue)
  
  const filtered = tasks.filter(task => {
    // 如果勾选了"包含逾期任务"，先检查是否逾期
    if (scope.includeOverdue && isTaskOverdue(task)) {
      console.log(`  ✅ [逾期] ${task.title}`)
      return true
    }
    
    // 检查任务是否在范围内
    const inScope = isTaskInScope(task, scope)
    if (inScope) {
      console.log(`  ✅ [范围内] ${task.title} (deadline: ${task.deadline_datetime})`)
    } else {
      console.log(`  ❌ [范围外] ${task.title} (deadline: ${task.deadline_datetime})`)
    }
    return inScope
  })
  
  console.log('  - 输出任务数:', filtered.length)
  return filtered
}

// ============================================
// 日期范围描述函数（用于UI显示）
// ============================================

/**
 * 获取日期范围的文本描述
 * @param scope 日期范围
 * @returns 描述文本（如"今天"、"10/19-10/25"）
 */
export function getScopeDescription(scope: DateScope): string {
  switch (scope.preset) {
    case 'today':
      return 'Today'
    case '3days':
      return 'Next 3 Days'
    case '7days':
      return 'Next 7 Days'
    case 'week':
      return 'This Week'
    case 'month':
      return 'This Month'
    case 'custom': {
      // 自定义范围：显示"M/D-M/D"格式
      const startMonth = scope.start.getMonth() + 1
      const startDay = scope.start.getDate()
      const endMonth = scope.end.getMonth() + 1
      const endDay = scope.end.getDate()
      
      // 如果是同一天
      if (isSameDay(scope.start, scope.end)) {
        return `${startMonth}/${startDay}`
      }
      
      return `${startMonth}/${startDay}-${endMonth}/${endDay}`
    }
    default:
      return 'Custom Range'
  }
}

/**
 * 获取默认的日期范围（今天 + 包含逾期）
 * @returns 默认DateScope对象
 */
export function getDefaultDateScope(): DateScope {
  const today = getStartOfDay(new Date())
  return {
    start: today,
    end: getEndOfDay(today),
    includeOverdue: false,  // ⭐ 默认不包含逾期任务
    preset: 'today'
  }
}

// ============================================
// sessionStorage 序列化/反序列化
// ============================================

/**
 * 序列化 DateScope 为 JSON 字符串（用于 sessionStorage）
 * @param scope 日期范围对象
 * @returns JSON字符串
 */
export function serializeDateScope(scope: DateScope): string {
  return JSON.stringify({
    start: scope.start.toISOString(),
    end: scope.end.toISOString(),
    includeOverdue: scope.includeOverdue,
    preset: scope.preset
  })
}

/**
 * 反序列化 JSON 字符串为 DateScope（用于 sessionStorage）
 * @param json JSON字符串
 * @returns DateScope对象，如果解析失败则返回默认值
 */
export function deserializeDateScope(json: string): DateScope {
  try {
    const parsed = JSON.parse(json)
    return {
      start: new Date(parsed.start),
      end: new Date(parsed.end),
      includeOverdue: parsed.includeOverdue,
      preset: parsed.preset
    }
  } catch (error) {
    console.error('Failed to deserialize DateScope:', error)
    return getDefaultDateScope()
  }
}

