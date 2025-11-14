/**
 * GetTasksTool - 查询任务列表工具
 * 
 * 功能：查询用户的任务列表，支持按日期范围、优先级筛选
 * 优先级：P0（核心功能）
 * 
 * Phase 2 Step 3
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { format } from 'date-fns'
import { sortTasksByPriority } from '@/utils/taskPriority'

interface GetTasksParams {
  userId: string
  dateRange?: {
    start: string // YYYY-MM-DD
    end: string   // YYYY-MM-DD
  }
  priority?: 'high' | 'medium' | 'low'
  includeCompleted?: boolean
}

/**
 * 查询任务列表工具
 * 
 * 支持按日期范围、优先级筛选
 * 遵循"足够用"原则：只返回关键信息，不返回完整对象
 */
export class GetTasksTool implements AgentTool {
  name = 'get_tasks'
  description = '查询用户的任务列表，支持按日期范围、优先级筛选。返回简化的任务信息（只包含决策所需的关键字段）'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID' 
      },
      dateRange: {
        type: 'object',
        description: '日期范围（可选），格式：{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }',
      },
      priority: {
        type: 'string',
        description: '优先级筛选（可选）：high（高）、medium（中）、low（低）',
        enum: ['high', 'medium', 'low']
      },
      includeCompleted: {
        type: 'boolean',
        description: '是否包含已完成任务（默认 false）'
      }
    },
    required: ['userId']
  }

  async execute(params: GetTasksParams): Promise<ToolResult> {
    try {
      console.log('🔍 查询任务:', {
        userId: params.userId.substring(0, 8) + '...',
        dateRange: params.dateRange,
        priority: params.priority,
        includeCompleted: params.includeCompleted
      })

      // 动态导入（避免循环依赖）
      const { getNotesByDateRange } = await import('@/lib/notes')
      
      let startDate: Date
      let endDate: Date
      
      if (params.dateRange) {
        startDate = new Date(params.dateRange.start)
        endDate = new Date(params.dateRange.end)
      } else {
        // 默认查询今天
        const today = new Date()
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      }

      // 查询日期范围内的笔记
      const notes = await getNotesByDateRange(params.userId, startDate, endDate)
      
      console.log(`📝 查询到 ${notes.length} 条笔记`)

      // 从笔记中提取任务
      let allTasks: any[] = []
      
      for (const note of notes) {
        const tasks = this.extractTasksFromNote(note)
        allTasks.push(...tasks)
      }

      console.log(`📋 提取到 ${allTasks.length} 个任务`)

      // 筛选：优先级
      if (params.priority) {
        allTasks = allTasks.filter(t => t.priority === params.priority)
        console.log(`🔎 优先级筛选后: ${allTasks.length} 个任务`)
      }

      // 筛选：是否包含已完成
      if (!params.includeCompleted) {
        allTasks = allTasks.filter(t => !t.isCompleted)
        console.log(`🔎 排除已完成后: ${allTasks.length} 个任务`)
      }

      // 简化任务信息（遵循"足够用"原则）
      const simplifiedTasks = allTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority || 'low',
        hasDeadline: !!t.deadline,
        deadline: t.deadline,
        hasEstimation: !!t.estimatedMinutes,
        estimatedMinutes: t.estimatedMinutes,
        needsClarification: !t.description || (t.description && t.description.length < 10),
        isCompleted: t.isCompleted || false,
        noteDate: t.noteDate,
        noteId: t.noteId
      }))

      // 🎯 应用智能优先级排序
      const sortedTasks = sortTasksByPriority(simplifiedTasks)

      console.log(`✅ 查询完成: ${sortedTasks.length} 个任务（已排序）`)

      return {
        type: 'success',
        data: {
          count: sortedTasks.length,
          tasks: sortedTasks,
          filters: {
            dateRange: params.dateRange || {
              start: format(startDate, 'yyyy-MM-dd'),
              end: format(endDate, 'yyyy-MM-dd')
            },
            priority: params.priority,
            includeCompleted: params.includeCompleted || false
          },
          // 🆕 标识是否需要分页展示（超过5个任务）
          shouldPaginate: sortedTasks.length > 5
        }
      }

    } catch (error: any) {
      console.error('❌ 查询任务失败:', error)
      return {
        type: 'error',
        message: `查询任务失败: ${error.message}`
      }
    }
  }

  /**
   * 从单个笔记中提取任务
   */
  private extractTasksFromNote(note: any): any[] {
    const tasks: any[] = []
    let taskIndex = 0

    const traverse = (node: any) => {
      if (node.type === 'taskItem') {
        // 提取任务标题
        const title = this.extractTextFromNode(node)
        
        // 解析优先级和截止日期（从标题中）
        const metadata = this.parseTaskMetadata(title)
        
        const task = {
          id: `${note.id}-task-${taskIndex}`,
          noteId: note.id,
          noteDate: note.note_date,
          title: metadata.cleanTitle,
          isCompleted: node.attrs?.checked || false,
          priority: metadata.priority || 'low',
          deadline: metadata.deadline,
          estimatedMinutes: metadata.estimatedMinutes,
          description: metadata.description
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
   * 解析任务元数据（优先级、截止日期、时间估算）
   * 
   * 示例：
   * - "完成报告 @high 📅2024-11-05 ⏱️60min" 
   * - "学习新技术 #编程"
   */
  private parseTaskMetadata(title: string): {
    cleanTitle: string
    priority?: 'high' | 'medium' | 'low'
    deadline?: string
    estimatedMinutes?: number
    description?: string
  } {
    let cleanTitle = title
    let priority: 'high' | 'medium' | 'low' | undefined
    let deadline: string | undefined
    let estimatedMinutes: number | undefined

    // 解析优先级：@high, @medium, @low
    const priorityMatch = title.match(/@(high|medium|low)/i)
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as 'high' | 'medium' | 'low'
      cleanTitle = cleanTitle.replace(priorityMatch[0], '').trim()
    }

    // 解析截止日期：📅2024-11-05 或 deadline:2024-11-05
    const deadlineMatch = title.match(/(?:📅|deadline:)\s*(\d{4}-\d{2}-\d{2})/i)
    if (deadlineMatch) {
      deadline = deadlineMatch[1]
      cleanTitle = cleanTitle.replace(deadlineMatch[0], '').trim()
    }

    // 解析时间估算：⏱️60min 或 est:60min
    const estimationMatch = title.match(/(?:⏱️|est:)\s*(\d+)\s*min/i)
    if (estimationMatch) {
      estimatedMinutes = parseInt(estimationMatch[1])
      cleanTitle = cleanTitle.replace(estimationMatch[0], '').trim()
    }

    return {
      cleanTitle,
      priority,
      deadline,
      estimatedMinutes,
      description: cleanTitle.length > 10 ? cleanTitle : undefined
    }
  }
}



