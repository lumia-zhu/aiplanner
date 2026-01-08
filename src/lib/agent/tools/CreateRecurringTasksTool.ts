/**
 * CreateRecurringTasksTool - 批量创建重复任务工具
 * 
 * 功能：在多个日期创建相同的任务
 * 用途：处理"每天"、"这周"、"下周"等批量创建场景
 * 
 * 🆕 支持带层级的任务树结构（保留父子任务关系）
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

/**
 * 任务树节点（用于保留层级关系）
 */
interface TaskTreeInput {
  title: string
  children?: TaskTreeInput[]
}

interface CreateRecurringTasksParams {
  userId: string
  taskTitles?: string | string[]  // 简单任务标题（扁平）
  tasks?: TaskTreeInput[]         // 🆕 带层级的任务树（保留父子关系）
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
 * - 🆕 "把昨天的任务移到今天"（保留父子任务层级）
 */
export class CreateRecurringTasksTool implements AgentTool {
  name = 'create_recurring_tasks'
  description = '在多个日期批量创建一个或多个任务。适用于"每天"、"这周"、"下周"、"本月"等场景。🆕 支持带层级的任务树（保留父子任务关系），使用 tasks 参数传入层级结构。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      taskTitles: { 
        type: ['string', 'array'], 
        description: '⚠️ 简单模式（会丢失层级！）。仅用于没有子任务的扁平任务列表。例如：["吃饭", "睡觉"]' 
      },
      tasks: {
        type: 'array',
        description: '⭐ 推荐！带层级的任务树（保留父子关系）。当 get_tasks 返回的任务有 children 字段时，必须使用此参数！格式：[{ "title": "父任务", "children": [{ "title": "子任务1" }, { "title": "子任务2" }] }]。直接复制 get_tasks 返回的 tasks 数组即可。'
      },
      dateRange: {
        type: 'string',
        enum: ['today', 'this_week', 'next_week', 'this_month', 'custom'],
        description: '日期范围（必需）。today=仅今天，this_week=本周每天，next_week=下周每天，this_month=本月每天，custom=自定义范围'
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
    required: ['userId', 'dateRange']
  }

  async execute(params: CreateRecurringTasksParams): Promise<ToolResult> {
    try {
      // 🆕 检测使用哪种模式：层级模式 or 简单模式
      const useTreeMode = params.tasks && Array.isArray(params.tasks) && params.tasks.length > 0
      
      let taskTitlesArray: string[] = []
      let taskTreeArray: TaskTreeInput[] = []
      let skippedCount = 0
      
      if (useTreeMode) {
        // 🆕 层级模式：使用 tasks 参数
        taskTreeArray = params.tasks!.filter(t => t && t.title && t.title.trim().length > 0)
        skippedCount = params.tasks!.length - taskTreeArray.length
        
        console.log('📅 CreateRecurringTasksTool 执行（层级模式）:', {
          userId: params.userId.substring(0, 8) + '...',
          taskCount: taskTreeArray.length,
          hasChildren: taskTreeArray.some(t => t.children && t.children.length > 0),
          skippedEmptyTasks: skippedCount,
          dateRange: params.dateRange
        })
        
        if (taskTreeArray.length === 0) {
          return {
            type: 'error',
            message: '没有找到有效的任务（所有任务都是空的）'
          }
        }
      } else {
        // 简单模式：使用 taskTitles 参数
        const rawTaskTitles = Array.isArray(params.taskTitles) 
          ? params.taskTitles 
          : params.taskTitles ? [params.taskTitles] : []
        
        taskTitlesArray = rawTaskTitles
          .filter(t => t && t.trim().length > 0)
          .map(t => t.trim())
        
        skippedCount = rawTaskTitles.length - taskTitlesArray.length
        if (skippedCount > 0) {
          console.log(`⚠️ 跳过了 ${skippedCount} 个空任务标题`)
        }
        
        console.log('📅 CreateRecurringTasksTool 执行（简单模式）:', {
          userId: params.userId.substring(0, 8) + '...',
          taskTitles: taskTitlesArray,
          taskCount: taskTitlesArray.length,
          skippedEmptyTitles: skippedCount,
          dateRange: params.dateRange
        })

        if (taskTitlesArray.length === 0) {
          return {
            type: 'error',
            message: '没有找到有效的任务标题（所有任务标题都是空的）'
          }
        }
      }

      // 4. 计算日期范围
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

      // 5. 生成日期列表
      const dates = eachDayOfInterval({ start: startDate, end: endDate })
      const taskCount = useTreeMode ? taskTreeArray.length : taskTitlesArray.length
      console.log(`📅 将在 ${dates.length} 天内创建 ${taskCount} 个任务`)

      // 6. 批量创建任务
      const { appendTaskToNote, appendTaskTreeToNote, formatNoteDate } = await import('@/lib/notes')
      
      const results = []
      
      if (useTreeMode) {
        // 🆕 层级模式：使用 appendTaskTreeToNote 保留父子关系
        for (const date of dates) {
          try {
            const note = await appendTaskTreeToNote(
              params.userId,
              date,
              taskTreeArray
            )
            // 统计总任务数（包括子任务）
            const countTasks = (tasks: TaskTreeInput[]): number => {
              return tasks.reduce((sum, t) => {
                return sum + 1 + (t.children ? countTasks(t.children) : 0)
              }, 0)
            }
            const totalTaskCount = countTasks(taskTreeArray)
            
            results.push({
              date: formatNoteDate(date),
              taskCount: totalTaskCount,
              noteId: note.id,
              success: true
            })
          } catch (error) {
            console.error(`❌ 创建任务树失败 (${formatNoteDate(date)}):`, error)
            results.push({
              date: formatNoteDate(date),
              success: false,
              error: error instanceof Error ? error.message : '未知错误'
            })
          }
        }
      } else {
        // 简单模式：使用 appendTaskToNote（扁平任务列表）
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
      }

      // 7. 统计结果
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      console.log(`✅ 批量创建完成: ${successCount} 成功, ${failCount} 失败`)

      // 8. 构建返回消息
      let message = `✅ 已为您创建任务：\n`
      
      if (useTreeMode) {
        // 🆕 层级模式：显示任务树结构
        const formatTaskTree = (tasks: TaskTreeInput[], indent: string = ''): string => {
          return tasks.map(t => {
            let line = `${indent}• ${t.title}`
            if (t.children && t.children.length > 0) {
              line += '\n' + formatTaskTree(t.children, indent + '  ')
            }
            return line
          }).join('\n')
        }
        message += formatTaskTree(taskTreeArray) + '\n'
      } else {
        if (taskTitlesArray.length === 1) {
          message += taskTitlesArray[0] + '\n'
        } else {
          message += taskTitlesArray.map((t, i) => `  ${i + 1}. ${t}`).join('\n') + '\n'
        }
      }
      
      message += `📅 日期范围：${formatNoteDate(startDate)} 至 ${formatNoteDate(endDate)}\n`
      message += `📊 成功创建：${successCount} ${useTreeMode ? '批' : '个'}任务`
      
      if (failCount > 0) {
        message += `\n⚠️ 失败：${failCount} ${useTreeMode ? '批' : '个'}任务`
      }
      
      if (skippedCount > 0) {
        message += `\n💡 跳过了 ${skippedCount} 个空任务`
      }

      return {
        type: 'success',
        message,
        data: {
          mode: useTreeMode ? 'tree' : 'flat',
          taskTitles: useTreeMode ? undefined : taskTitlesArray,
          tasks: useTreeMode ? taskTreeArray : undefined,
          dateRange: params.dateRange,
          startDate: formatNoteDate(startDate),
          endDate: formatNoteDate(endDate),
          totalDays: dates.length,
          totalTasks: taskCount,
          successCount,
          failCount,
          results
        },
        // 🆕 UI 刷新标记
        shouldRefreshNote: true,
        affectedDates: dates.map(d => formatNoteDate(d))
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

