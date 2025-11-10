/**
 * CreateRecurringTasksTool - 批量创建重复任务工具
 * 
 * 功能：在多个日期创建相同的任务
 * 用途：处理"每天"、"这周"、"下周"等批量创建场景
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

interface CreateRecurringTasksParams {
  userId: string
  taskTitles: string | string[]  // 支持单个或多个任务标题
  dateRange: 'today' | 'this_week' | 'next_week' | 'this_month' | 'custom'
  startDate?: string  // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  endDate?: string    // YYYY-MM-DD，仅当 dateRange='custom' 时使用
}

/**
 * 批量创建重复任务工具
 * 
 * 支持场景：
 * - "这周每天创建任务"
 * - "下周每天创建任务"
 * - "本月每天创建任务"
 * - "从X到Y每天创建任务"
 */
export class CreateRecurringTasksTool implements AgentTool {
  name = 'create_recurring_tasks'
  description = '在多个日期批量创建一个或多个任务。适用于"每天"、"这周"、"下周"、"本月"等场景。支持同时创建多个任务。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      taskTitles: { 
        type: ['string', 'array'], 
        description: '任务标题（必需）。可以是单个字符串（创建一个任务），或字符串数组（创建多个任务）。例如："吃饭" 或 ["吃饭", "睡觉", "锻炼"]' 
      },
      dateRange: {
        type: 'string',
        enum: ['today', 'this_week', 'next_week', 'this_month', 'custom'],
        description: '日期范围（必需）。this_week=本周每天（周一到周日），next_week=下周每天，this_month=本月每天，custom=自定义范围'
      },
      startDate: {
        type: 'string',
        description: '开始日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      },
      endDate: {
        type: 'string',
        description: '结束日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      }
    },
    required: ['userId', 'taskTitles', 'dateRange']
  }

  async execute(params: CreateRecurringTasksParams): Promise<ToolResult> {
    try {
      // 1. 标准化任务标题为数组
      const taskTitlesArray = Array.isArray(params.taskTitles) 
        ? params.taskTitles 
        : [params.taskTitles]
      
      console.log('📅 CreateRecurringTasksTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        taskTitles: taskTitlesArray,
        taskCount: taskTitlesArray.length,
        dateRange: params.dateRange
      })

      // 2. 验证参数
      if (taskTitlesArray.length === 0 || taskTitlesArray.some(t => !t || t.trim().length === 0)) {
        return {
          type: 'error',
          message: '任务标题不能为空'
        }
      }

      // 2. 计算日期范围
      let startDate: Date
      let endDate: Date
      const today = new Date()

      switch (params.dateRange) {
        case 'today':
          startDate = today
          endDate = today
          break

        case 'this_week':
          // 从今天到本周日
          startDate = today
          endDate = endOfWeek(today, { weekStartsOn: 1 }) // 周一为一周的开始
          break

        case 'next_week':
          const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7)
          startDate = nextWeekStart
          endDate = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
          break

        case 'this_month':
          startDate = today
          endDate = endOfMonth(today)
          break

        case 'custom':
          if (!params.startDate || !params.endDate) {
            return {
              type: 'error',
              message: '自定义范围需要提供 startDate 和 endDate'
            }
          }
          try {
            startDate = new Date(params.startDate)
            endDate = new Date(params.endDate)
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              throw new Error('无效日期')
            }
          } catch (error) {
            return {
              type: 'error',
              message: '日期格式错误，请使用 YYYY-MM-DD 格式'
            }
          }
          break

        default:
          return {
            type: 'error',
            message: `不支持的日期范围: ${params.dateRange}`
          }
      }

      // 3. 生成日期列表
      const dates = eachDayOfInterval({ start: startDate, end: endDate })
      console.log(`📅 将在 ${dates.length} 天内创建 ${taskTitlesArray.length} 个任务`)
      console.log(`📊 总共需要创建: ${dates.length * taskTitlesArray.length} 个任务项`)

      // 4. 批量创建任务（双重循环：日期 × 任务）
      const { appendTaskToNote, formatNoteDate } = await import('@/lib/notes')
      
      const results = []
      for (const date of dates) {
        for (const taskTitle of taskTitlesArray) {
          try {
            const note = await appendTaskToNote(
              params.userId,
              date,
              taskTitle.trim()
            )
            results.push({
              date: formatNoteDate(date),
              taskTitle: taskTitle.trim(),
              noteId: note.id,
              success: true
            })
          } catch (error) {
            console.error(`❌ 创建任务失败 (${formatNoteDate(date)}, ${taskTitle}):`, error)
            results.push({
              date: formatNoteDate(date),
              taskTitle: taskTitle.trim(),
              success: false,
              error: error instanceof Error ? error.message : '未知错误'
            })
          }
        }
      }

      // 5. 统计结果
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      console.log(`✅ 批量创建完成: ${successCount} 成功, ${failCount} 失败`)

      // 6. 构建返回消息
      const taskListStr = taskTitlesArray.length === 1 
        ? taskTitlesArray[0]
        : taskTitlesArray.map((t, i) => `${i + 1}. ${t}`).join('、')
      
      let message = `✅ 已为您创建任务：\n`
      if (taskTitlesArray.length === 1) {
        message += taskTitlesArray[0] + '\n'
      } else {
        message += taskTitlesArray.map((t, i) => `  ${i + 1}. ${t}`).join('\n') + '\n'
      }
      message += `📅 日期范围：${formatNoteDate(startDate)} 至 ${formatNoteDate(endDate)}\n`
      message += `📊 成功创建：${successCount} 个任务项`
      
      if (failCount > 0) {
        message += `\n⚠️ 失败：${failCount} 个任务项`
      }

      return {
        type: 'success',
        message,
        data: {
          taskTitles: taskTitlesArray,
          dateRange: params.dateRange,
          startDate: formatNoteDate(startDate),
          endDate: formatNoteDate(endDate),
          totalDays: dates.length,
          totalTasks: taskTitlesArray.length,
          totalItems: dates.length * taskTitlesArray.length,
          successCount,
          failCount,
          results
        }
      }
    } catch (error) {
      console.error('❌ CreateRecurringTasksTool 执行失败:', error)
      
      return {
        type: 'error',
        message: error instanceof Error ? `创建任务失败: ${error.message}` : '创建任务失败'
      }
    }
  }
}

