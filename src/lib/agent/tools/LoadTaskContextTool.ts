/**
 * LoadTaskContextTool - 加载任务上下文工具
 * 
 * 功能：填充 Agent 的 Long-term Memory（近3个月任务信息）
 * 优先级：P0（核心功能）
 * 
 * Phase 2 Step 2
 */

import { AgentTool, ParameterSchema, ToolResult, TaskContext } from '../AgentTypes'
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'
import type { Task } from '@/types'

interface LoadTaskContextParams {
  userId: string
  referenceDate?: Date // 参考日期（通常是今天）
}

/**
 * 加载任务上下文工具
 * 
 * 填充 Agent 的 Long-term Memory（近3个月任务信息）
 * - todayTasks: 今天的任务详情
 * - recentTasksSummary: 近3个月统计信息
 * - recentTasks: 近3个月任务列表（简化版）
 */
export class LoadTaskContextTool implements AgentTool {
  name = 'load_task_context'
  description = '加载用户的任务上下文（近3个月任务统计和今天的任务详情），填充 Agent 长期记忆'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: '用户 ID'
      },
      referenceDate: {
        type: 'string',
        description: '参考日期（ISO 格式，如 2024-11-04），默认为今天'
      }
    },
    required: ['userId']
  }

  async execute(params: LoadTaskContextParams): Promise<ToolResult> {
    try {
      const referenceDate = params.referenceDate || new Date()
      const userId = params.userId

      // 计算日期范围：前1个月 + 当前月 + 后1个月
      const previousMonth = subMonths(referenceDate, 1)
      const nextMonth = addMonths(referenceDate, 1)
      
      const startDate = startOfMonth(previousMonth)
      const endDate = endOfMonth(nextMonth)

      console.log(`📊 加载任务上下文: ${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`)

      // 查询近3个月的所有任务（从笔记中提取）
      const allTasks = await this.loadTasksFromNotes(userId, startDate, endDate)

      // 过滤今天的任务
      const today = format(referenceDate, 'yyyy-MM-dd')
      const todayTasks = allTasks.filter(t => {
        if (!t.noteDate) return false
        return format(new Date(t.noteDate), 'yyyy-MM-dd') === today
      })

      // 构建任务上下文
      const taskContext: TaskContext = {
        todayTasks,
        recentTasksSummary: this.buildSummary(allTasks, referenceDate),
        recentTasks: this.simplifyTasks(allTasks)
      }

      console.log(`✅ 任务上下文加载完成: 总任务 ${allTasks.length}, 今天 ${todayTasks.length}`)

      return {
        type: 'success',
        data: taskContext
      }

    } catch (error: any) {
      console.error('❌ 加载任务上下文失败:', error)
      return {
        type: 'error',
        message: `加载任务上下文失败: ${error.message}`
      }
    }
  }

  /**
   * 从笔记中加载指定日期范围内的任务
   * 
   * 注意：这个方法需要查询笔记，然后解析任务
   * 由于当前没有直接的 API 支持日期范围查询，我们采用简化方案：
   * 1. 查询每个月的笔记
   * 2. 从笔记中提取任务
   */
  private async loadTasksFromNotes(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
    try {
      // 动态导入避免循环依赖
      const { getNotesByDateRange } = await import('@/lib/notes')
      
      // 查询日期范围内的笔记（传递 Date 对象）
      const notes = await getNotesByDateRange(
        userId,
        startDate,
        endDate
      )

      console.log(`📝 查询到 ${notes.length} 条笔记`)

      // 从笔记中提取任务
      const allTasks: Task[] = []
      
      for (const note of notes) {
        const tasks = this.extractTasksFromNote(note)
        allTasks.push(...tasks)
      }

      return allTasks

    } catch (error: any) {
      console.error('❌ 从笔记加载任务失败:', error?.message || error)
      return []
    }
  }

  /**
   * 从单个笔记中提取任务
   * 
   * 遍历 Tiptap JSONContent，找到所有 taskItem 节点
   */
  private extractTasksFromNote(note: any): Task[] {
    const tasks: Task[] = []
    let taskIndex = 0

    const traverse = (node: any) => {
      if (node.type === 'taskItem') {
        const task: Task = {
          id: `${note.id}-task-${taskIndex}`,
          user_id: note.user_id,
          note_id: note.id,
          noteDate: note.note_date,
          title: this.extractTextFromNode(node),
          is_completed: node.attrs?.checked || false,
          priority: 'low', // 默认优先级（可以从文本中解析）
          created_at: note.created_at,
          updated_at: note.updated_at
        }
        tasks.push(task)
        taskIndex++
      }

      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse)
      }
    }

    if (note.content) {
      traverse(note.content)
    }

    return tasks
  }

  /**
   * 从节点中提取纯文本
   */
  private extractTextFromNode(node: any): string {
    if (node.type === 'text') {
      return node.text || ''
    }

    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractTextFromNode(child)).join('')
    }

    return ''
  }

  /**
   * 构建任务统计信息
   */
  private buildSummary(tasks: Task[], referenceDate: Date) {
    const previousMonth = subMonths(referenceDate, 1)
    const nextMonth = addMonths(referenceDate, 1)

    const isInMonth = (task: Task, targetMonth: Date) => {
      if (!task.noteDate) return false
      const taskDate = new Date(task.noteDate)
      return (
        taskDate >= startOfMonth(targetMonth) &&
        taskDate <= endOfMonth(targetMonth)
      )
    }

    const previousMonthTasks = tasks.filter(t => isInMonth(t, previousMonth))
    const currentMonthTasks = tasks.filter(t => isInMonth(t, referenceDate))
    const nextMonthTasks = tasks.filter(t => isInMonth(t, nextMonth))

    return {
      totalCount: tasks.length,
      urgentCount: tasks.filter(t => t.priority === 'high' && !t.is_completed).length,
      missingEstimationCount: tasks.filter(t => !t.estimated_duration && !t.is_completed).length,
      byMonth: {
        previousMonth: {
          total: previousMonthTasks.length,
          completed: previousMonthTasks.filter(t => t.is_completed).length,
          date: format(previousMonth, 'yyyy-MM')
        },
        currentMonth: {
          total: currentMonthTasks.length,
          completed: currentMonthTasks.filter(t => t.is_completed).length,
          date: format(referenceDate, 'yyyy-MM')
        },
        nextMonth: {
          total: nextMonthTasks.length,
          completed: nextMonthTasks.filter(t => t.is_completed).length,
          date: format(nextMonth, 'yyyy-MM')
        }
      }
    }
  }

  /**
   * 简化任务列表（只保留关键信息，遵循"足够用"原则）
   */
  private simplifyTasks(tasks: Task[]) {
    return tasks.slice(0, 200).map(t => ({ // 限制最多 200 个任务
      id: t.id,
      title: t.title,
      priority: t.priority || 'low',
      deadline: t.deadline_datetime ? format(new Date(t.deadline_datetime), 'yyyy-MM-dd') : undefined,
      estimatedDuration: t.estimated_duration || undefined,
      isCompleted: t.is_completed || false,
      isToday: t.noteDate ? format(new Date(t.noteDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') : false
    }))
  }
}

