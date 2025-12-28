/**
 * DateCalculatorTool - 日期计算工具
 * 
 * 功能：将自然语言日期表达式转换为具体的日期
 * 优先级：P0（核心功能）
 * 
 * 支持的日期表达式：
 * - 相对日期：明天、后天、大后天
 * - 下周：下周一、下周二、...、下周日
 * - 下下周：下下周一、下下周二、...
 * - X天后：3天后、7天后、14天后
 * - 具体日期：1月15日、2025年1月15日
 * - 本周/下周：本周五、下周三
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, addWeeks, startOfWeek, format, parse } from 'date-fns'

interface DateCalculatorParams {
  dateExpression: string  // 日期表达式，如"下周三"、"明天"、"3天后"
  referenceDate?: string  // 参考日期（YYYY-MM-DD），默认为今天
}

/**
 * 日期计算工具
 * 
 * 将自然语言日期表达式转换为 YYYY-MM-DD 格式的具体日期
 */
export class DateCalculatorTool implements AgentTool {
  name = 'calculate_date'
  description = '计算相对日期的具体日期（YYYY-MM-DD）。当用户说"下周三"、"明天"、"3天后"等相对日期时使用此工具。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      dateExpression: {
        type: 'string',
        description: '日期表达式。支持：明天、后天、下周一~下周日、下下周一~下下周日、X天后、本周一~本周日等'
      },
      referenceDate: {
        type: 'string',
        description: '参考日期（YYYY-MM-DD），默认为今天'
      }
    },
    required: ['dateExpression']
  }

  async execute(params: DateCalculatorParams): Promise<ToolResult> {
    try {
      console.log('📅 DateCalculatorTool 执行:', {
        dateExpression: params.dateExpression,
        referenceDate: params.referenceDate || '今天'
      })

      // 1. 确定参考日期
      const referenceDate = params.referenceDate 
        ? new Date(params.referenceDate) 
        : new Date()
      
      // 验证参考日期是否有效
      if (isNaN(referenceDate.getTime())) {
        return {
          type: 'error',
          message: `参考日期格式错误：${params.referenceDate}`
        }
      }

      // 2. 解析日期表达式
      const expression = params.dateExpression.trim()
      const calculatedDate = this.parseDateExpression(expression, referenceDate)

      if (!calculatedDate) {
        return {
          type: 'error',
          message: `无法识别的日期表达式：${expression}`
        }
      }

      // 3. 返回计算结果
      const resultDate = format(calculatedDate, 'yyyy-MM-dd')
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      const weekDay = weekDays[calculatedDate.getDay()]

      console.log(`✅ 日期计算成功: ${expression} = ${resultDate} (星期${weekDay})`)

      return {
        type: 'success',
        data: {
          originalExpression: expression,
          calculatedDate: resultDate,
          weekDay: `星期${weekDay}`,
          message: `"${expression}" = ${resultDate}（星期${weekDay}）`
        }
      }
    } catch (error) {
      console.error('❌ DateCalculatorTool 执行失败:', error)
      return {
        type: 'error',
        message: `日期计算失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  /**
   * 解析日期表达式
   * @param expression 日期表达式
   * @param referenceDate 参考日期
   * @returns 计算后的日期，如果无法识别则返回 null
   */
  private parseDateExpression(expression: string, referenceDate: Date): Date | null {
    const expr = expression.toLowerCase().trim()

    // 1. 明天、后天、大后天
    if (expr === '明天') {
      return addDays(referenceDate, 1)
    }
    if (expr === '后天') {
      return addDays(referenceDate, 2)
    }
    if (expr === '大后天') {
      return addDays(referenceDate, 3)
    }

    // 2. 昨天、前天
    if (expr === '昨天') {
      return addDays(referenceDate, -1)
    }
    if (expr === '前天') {
      return addDays(referenceDate, -2)
    }

    // 3. X天后/X天前
    const daysAfterMatch = expr.match(/^(\d+)天后$/)
    if (daysAfterMatch) {
      const days = parseInt(daysAfterMatch[1])
      return addDays(referenceDate, days)
    }
    const daysBeforeMatch = expr.match(/^(\d+)天前$/)
    if (daysBeforeMatch) {
      const days = parseInt(daysBeforeMatch[1])
      return addDays(referenceDate, -days)
    }

    // 4. 本周X（本周一、本周二...）
    const thisWeekMatch = expr.match(/^本周([一二三四五六日])$/)
    if (thisWeekMatch) {
      const weekDayMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0
      }
      const targetWeekDay = weekDayMap[thisWeekMatch[1]]
      return this.getDateOfWeek(referenceDate, targetWeekDay, 0)
    }

    // 5. 下周X（下周一、下周二...）
    const nextWeekMatch = expr.match(/^下周([一二三四五六日])$/)
    if (nextWeekMatch) {
      const weekDayMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0
      }
      const targetWeekDay = weekDayMap[nextWeekMatch[1]]
      return this.getDateOfWeek(referenceDate, targetWeekDay, 1)
    }

    // 6. 下下周X
    const nextNextWeekMatch = expr.match(/^下下周([一二三四五六日])$/)
    if (nextNextWeekMatch) {
      const weekDayMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0
      }
      const targetWeekDay = weekDayMap[nextNextWeekMatch[1]]
      return this.getDateOfWeek(referenceDate, targetWeekDay, 2)
    }

    // 7. X周后
    const weeksAfterMatch = expr.match(/^(\d+)周后$/)
    if (weeksAfterMatch) {
      const weeks = parseInt(weeksAfterMatch[1])
      return addWeeks(referenceDate, weeks)
    }

    // 8. 下个月X号、下月X号
    const nextMonthMatch = expr.match(/^下个?月(\d+)号?$/)
    if (nextMonthMatch) {
      const day = parseInt(nextMonthMatch[1])
      const result = new Date(referenceDate)
      result.setMonth(result.getMonth() + 1)
      result.setDate(day)
      return result
    }

    // 9. X月Y号（默认当年）
    const monthDayMatch = expr.match(/^(\d+)月(\d+)号?$/)
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1])
      const day = parseInt(monthDayMatch[2])
      const result = new Date(referenceDate.getFullYear(), month - 1, day)
      return result
    }

    // 10. YYYY年M月D号
    const fullDateMatch = expr.match(/^(\d{4})年(\d+)月(\d+)号?$/)
    if (fullDateMatch) {
      const year = parseInt(fullDateMatch[1])
      const month = parseInt(fullDateMatch[2])
      const day = parseInt(fullDateMatch[3])
      return new Date(year, month - 1, day)
    }

    // 11. YYYY-MM-DD 格式（直接返回）
    const isoDateMatch = expr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoDateMatch) {
      const date = new Date(expr)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    // 无法识别
    return null
  }

  /**
   * 获取指定周的指定星期几的日期
   * @param referenceDate 参考日期
   * @param targetWeekDay 目标星期几（0=周日, 1=周一, ..., 6=周六）
   * @param weekOffset 周偏移量（0=本周, 1=下周, 2=下下周, -1=上周）
   * @returns 计算后的日期
   */
  private getDateOfWeek(referenceDate: Date, targetWeekDay: number, weekOffset: number): Date {
    // 获取本周的周一（中国习惯：周一为一周开始）
    const currentWeekMonday = startOfWeek(referenceDate, { weekStartsOn: 1 })
    
    // 计算目标周的周一
    const targetWeekMonday = addWeeks(currentWeekMonday, weekOffset)
    
    // 计算目标星期几
    // targetWeekDay: 0=周日, 1=周一, ..., 6=周六
    // 需要从周一开始计算偏移
    const daysOffset = targetWeekDay === 0 ? 6 : targetWeekDay - 1
    return addDays(targetWeekMonday, daysOffset)
  }
}

