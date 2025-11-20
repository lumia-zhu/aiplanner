/**
 * CompleteRecurringTasksTool - 批量完成/取消完成任务工具
 * 
 * 功能：在多个日期批量标记符合条件的任务为完成或未完成
 * 用途：处理"完成今天所有任务"、"完成这周所有锻炼任务"等批量完成场景
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

interface CompleteRecurringTasksParams {
  userId: string
  searchKeyword?: string  // 可选，不传则匹配所有任务
  dateRange: 'today' | 'this_week' | 'next_week' | 'this_month' | 'custom'
  startDate?: string      // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  endDate?: string        // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  completed: boolean      // true=标记为完成，false=标记为未完成
}

/**
 * 批量完成任务工具
 * 
 * 支持场景：
 * - "完成今天所有任务"
 * - "完成这周所有锻炼任务"
 * - "取消本月所有已完成的任务"
 * - "完成下周所有任务"
 */
export class CompleteRecurringTasksTool implements AgentTool {
  name = 'complete_recurring_tasks'
  description = '批量标记多个日期的任务为完成或未完成。适用于"完成今天所有任务"、"完成这周所有锻炼任务"等批量操作。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      searchKeyword: {
        type: 'string',
        description: '搜索关键词（可选）。如果提供，只标记任务标题包含此关键词的任务。如果不提供或为空，则匹配所有任务。例如："锻炼"、"吃饭"、"工作"'
      },
      dateRange: {
        type: 'string',
        enum: ['today', 'this_week', 'next_week', 'this_month', 'custom'],
        description: '日期范围（必需）。today=今天，this_week=本周每天，next_week=下周每天，this_month=本月每天，custom=自定义范围'
      },
      startDate: {
        type: 'string',
        description: '开始日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      },
      endDate: {
        type: 'string',
        description: '结束日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      },
      completed: {
        type: 'boolean',
        description: '完成状态（必需）。true=标记为完成 ✅，false=标记为未完成 ⬜'
      }
    },
    required: ['userId', 'dateRange', 'completed']
  }

  async execute(params: CompleteRecurringTasksParams): Promise<ToolResult> {
    try {
      console.log('🔄 CompleteRecurringTasksTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        searchKeyword: params.searchKeyword || '(所有任务)',
        dateRange: params.dateRange,
        completed: params.completed
      })

      // 1. 计算日期范围
      let startDate: Date
      let endDate: Date
      const today = new Date()

      switch (params.dateRange) {
        case 'today':
          startDate = today
          endDate = today
          break

        case 'this_week':
          startDate = startOfWeek(today, { weekStartsOn: 1 }) // 周一开始
          endDate = endOfWeek(today, { weekStartsOn: 1 })     // 周日结束
          break

        case 'next_week':
          const nextWeekStart = addDays(today, 7)
          startDate = startOfWeek(nextWeekStart, { weekStartsOn: 1 })
          endDate = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
          break

        case 'this_month':
          startDate = startOfMonth(today)
          endDate = endOfMonth(today)
          break

        case 'custom':
          if (!params.startDate || !params.endDate) {
            return {
              type: 'error',
              message: 'custom 日期范围需要提供 startDate 和 endDate'
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

      // 2. 生成日期列表
      const dates = eachDayOfInterval({ start: startDate, end: endDate })
      console.log(`📅 日期范围: ${dates.length} 天`)

      // 3. 动态导入
      const { getNoteByDate, saveNote, formatNoteDate } = await import('@/lib/notes')
      const { findAllTasks, updateTaskInNote } = await import('@/lib/noteTaskOperations')

      // 4. 处理每一天
      const searchKeyword = params.searchKeyword?.trim()
      const matchAll = !searchKeyword // 如果没有关键词，匹配所有任务
      
      const results = []
      let totalCompleted = 0

      for (const date of dates) {
        const dateStr = formatNoteDate(date)
        
        try {
          // 加载笔记
          const note = await getNoteByDate(params.userId, date)
          
          if (!note || !note.content) {
            console.log(`📭 ${dateStr}: 没有笔记，跳过`)
            results.push({
              date: dateStr,
              success: true,
              completed: 0,
              message: '没有笔记'
            })
            continue
          }

          // 查找符合条件的任务
          const tasks = findAllTasks(note.content)
          const matchingTaskIndices: number[] = []

          tasks.forEach((task, index) => {
            const titleLower = task.title.toLowerCase()
            const keywordLower = searchKeyword?.toLowerCase() || ''
            
            // 匹配逻辑
            const isMatch = matchAll || titleLower.includes(keywordLower)
            
            if (isMatch) {
              matchingTaskIndices.push(index)
            }
          })

          if (matchingTaskIndices.length === 0) {
            console.log(`📭 ${dateStr}: 没有匹配的任务`)
            results.push({
              date: dateStr,
              success: true,
              completed: 0,
              message: '没有匹配的任务'
            })
            continue
          }

          // 批量更新任务（从后往前更新，避免索引变化）
          let updatedContent = note.content
          let actuallyUpdated = 0

          for (let i = matchingTaskIndices.length - 1; i >= 0; i--) {
            const taskIndex = matchingTaskIndices[i]
            const task = tasks[taskIndex]
            
            // 只更新状态不同的任务（幂等性）
            if (task.checked !== params.completed) {
              updatedContent = updateTaskInNote(
                updatedContent,
                taskIndex,
                { checked: params.completed }
              )
              actuallyUpdated++
            }
          }

          if (actuallyUpdated > 0) {
            // 保存更新后的笔记（⚠️ 关键：date 必须是 Date 对象）
            await saveNote(params.userId, date, updatedContent)
            console.log(`✅ ${dateStr}: 更新了 ${actuallyUpdated} 个任务`)
            totalCompleted += actuallyUpdated
            
            results.push({
              date: dateStr,
              success: true,
              completed: actuallyUpdated,
              message: `更新了 ${actuallyUpdated} 个任务`
            })
          } else {
            console.log(`ℹ️ ${dateStr}: ${matchingTaskIndices.length} 个任务已经是目标状态`)
            results.push({
              date: dateStr,
              success: true,
              completed: 0,
              message: `${matchingTaskIndices.length} 个任务已经是目标状态`
            })
          }
          
        } catch (error) {
          console.error(`❌ ${dateStr}: 更新失败:`, error)
          results.push({
            date: dateStr,
            success: false,
            completed: 0,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      // 5. 构建返回消息
      const successCount = results.filter(r => r.success).length
      const statusEmoji = params.completed ? '✅' : '⬜'
      const statusText = params.completed ? '完成' : '未完成'
      const scopeText = searchKeyword ? `所有「${searchKeyword}」任务` : '所有任务'
      
      let message = `${statusEmoji} 批量标记${statusText}: ${scopeText}\n\n`
      message += `📊 统计:\n`
      message += `- 处理日期: ${dates.length} 天\n`
      message += `- 成功: ${successCount} 天\n`
      message += `- 失败: ${dates.length - successCount} 天\n`
      message += `- 共更新任务: ${totalCompleted} 个\n\n`
      
      if (results.length <= 10) {
        message += `📝 详细结果:\n`
        results.forEach(r => {
          if (r.success) {
            message += `  ${r.date}: ${r.message}\n`
          } else {
            message += `  ${r.date}: ❌ ${r.error}\n`
          }
        })
      } else {
        message += `📝 部分结果 (仅显示前10天):\n`
        results.slice(0, 10).forEach(r => {
          if (r.success) {
            message += `  ${r.date}: ${r.message}\n`
          } else {
            message += `  ${r.date}: ❌ ${r.error}\n`
          }
        })
        message += `  ... 还有 ${results.length - 10} 天的结果未显示\n`
      }

      console.log(`✅ CompleteRecurringTasksTool 完成: 共更新 ${totalCompleted} 个任务`)

      return {
        type: 'success',
        data: {
          dateRange: params.dateRange,
          searchKeyword: searchKeyword || '(所有任务)',
          completed: params.completed,
          totalDays: dates.length,
          successDays: successCount,
          totalTasksUpdated: totalCompleted,
          results: results,
          message: message
        }
      }
    } catch (error) {
      console.error('❌ CompleteRecurringTasksTool 执行失败:', error)
      
      let errorMessage = '批量完成任务失败'
      if (error instanceof Error) {
        if (error.message.includes('RLS')) {
          errorMessage = '权限错误：无法访问笔记'
        } else {
          errorMessage = `批量完成任务失败: ${error.message}`
        }
      }

      return {
        type: 'error',
        message: errorMessage
      }
    }
  }
}




