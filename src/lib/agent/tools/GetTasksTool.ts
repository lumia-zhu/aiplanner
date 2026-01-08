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
  description = '查询用户的任务列表，支持按日期范围、优先级筛选。如果不传 dateRange，默认查询最近30天内的所有任务（包括今天和之前遗留的未完成任务）'
  
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
        // 默认查询所有未完成任务（从30天前到今天）
        // 当用户问"我有什么任务"时，应该包括今天和之前遗留的任务
        const today = new Date()
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30) // 30天前
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) // 今天结束
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
        noteId: t.noteId,
        // 🆕 保留层级信息
        depth: t.depth || 0,
        parentId: t.parentId || null
      }))

      // 🆕 构建父子任务树结构
      const taskTree = this.buildTaskTree(simplifiedTasks)

      // 🎯 应用智能优先级排序（只对顶层任务排序）
      const sortedTasks = sortTasksByPriority(taskTree)

      // 🆕 检测是否有层级结构（任何任务有 children）
      const hasHierarchy = sortedTasks.some(t => t.children && t.children.length > 0)
      
      console.log(`✅ 查询完成: ${sortedTasks.length} 个任务（已排序），层级结构: ${hasHierarchy}`)

      return {
        type: 'success',
        data: {
          count: sortedTasks.length,
          tasks: sortedTasks,
          // 🆕 明确标识是否有层级结构
          hasHierarchy: hasHierarchy,
          filters: {
            dateRange: params.dateRange || {
              start: format(startDate, 'yyyy-MM-dd'),
              end: format(endDate, 'yyyy-MM-dd')
            },
            priority: params.priority,
            includeCompleted: params.includeCompleted || false
          },
          shouldPaginate: sortedTasks.length > 5
        },
        // 🆕 如果有层级结构，添加明确的提示消息
        message: hasHierarchy 
          ? `⚠️ 注意：这些任务包含父子层级关系（有 children 字段）。如果要迁移/复制这些任务到其他日期，请使用 create_recurring_tasks 的 tasks 参数（而不是 taskTitles），这样可以保留层级结构。示例：{"tasks": ${JSON.stringify(sortedTasks.map(t => ({ title: t.title, children: t.children?.map((c: any) => ({ title: c.title, children: c.children?.map((gc: any) => ({ title: gc.title })) })) })))}, "dateRange": "today"}`
          : undefined
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
   * 🆕 构建父子任务树结构（递归支持多层级，最多4级）
   * 将扁平的任务列表转换为树形结构，子任务嵌套在父任务的 children 字段中
   */
  private buildTaskTree(tasks: any[]): any[] {
    // 按 depth=0 筛选出顶层任务
    const topLevelTasks = tasks.filter(t => (t.depth || 0) === 0)
    
    // 递归为每个任务查找其子任务
    const attachChildren = (parent: any, allTasks: any[]) => {
      const parentDepth = parent.depth || 0
      const targetDepth = parentDepth + 1
      
      // 只查找深度 <= 3 的子任务（最多4级）
      if (targetDepth > 3) return
      
      // 查找该父任务的直接子任务
      const children = allTasks.filter(child => {
        const childDepth = child.depth || 0
        // 子任务的深度必须是父任务深度 + 1
        if (childDepth !== targetDepth) return false
        
        // 如果有明确的 parentId，使用它
        if (child.parentId && child.parentId === parent.id) {
          return true
        }
        // 如果没有 parentId，使用位置推断
        return child.noteId === parent.noteId && 
               this.isChildOfParent(allTasks, parent, child, targetDepth)
      })
      
      if (children.length > 0) {
        // 递归处理每个子任务的子任务
        children.forEach(child => attachChildren(child, allTasks))
        parent.children = children
        parent.childCount = children.length
      }
    }
    
    // 为每个顶层任务递归构建子树
    topLevelTasks.forEach(parent => attachChildren(parent, tasks))
    
    return topLevelTasks
  }
  
  /**
   * 判断 child 是否是 parent 的直接子任务（基于位置和深度）
   */
  private isChildOfParent(allTasks: any[], parent: any, child: any, expectedChildDepth: number): boolean {
    const parentIndex = allTasks.findIndex(t => t.id === parent.id)
    const childIndex = allTasks.findIndex(t => t.id === child.id)
    const parentDepth = parent.depth || 0
    
    // 子任务应该在父任务之后
    if (childIndex <= parentIndex) return false
    
    // 检查从父任务到子任务之间是否有中断
    for (let i = parentIndex + 1; i < childIndex; i++) {
      const middleTaskDepth = allTasks[i].depth || 0
      // 如果中间任务的深度 <= 父任务深度，说明已经跳出父任务范围
      if (middleTaskDepth <= parentDepth) {
        return false
      }
    }
    
    return true
  }

  /**
   * 从单个笔记中提取任务
   */
  private extractTasksFromNote(note: any): any[] {
    const tasks: any[] = []
    let taskIndex = 0
    let currentParentId: string | null = null

    const traverse = (node: any, depth: number = 0, parentId: string | null = null) => {
      if (node.type === 'taskItem') {
        // 提取任务标题
        const title = this.extractTextFromNode(node)
        
        // 解析优先级和截止日期（从标题中）
        const metadata = this.parseTaskMetadata(title)
        
        const taskId = `${note.id}-task-${taskIndex}`
        
        const task = {
          id: taskId,
          noteId: note.id,
          noteDate: note.note_date,
          title: metadata.cleanTitle,
          isCompleted: node.attrs?.checked || false,
          priority: metadata.priority || 'low',
          deadline: metadata.deadline,
          estimatedMinutes: metadata.estimatedMinutes,
          description: metadata.description,
          // 🆕 层级信息
          depth: depth,
          parentId: parentId
        }
        
        tasks.push(task)
        taskIndex++
        
        // 🆕 检查是否有嵌套的 taskList（子任务）
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.type === 'taskList') {
              // 递归处理子任务列表，层级+1，父任务ID为当前任务
              traverse(child, depth + 1, taskId)
            }
          }
        }
        
        return // 已处理完当前 taskItem 及其子任务
      }

      // 处理 taskList 节点
      if (node.type === 'taskList') {
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            traverse(child, depth, parentId)
          }
        }
        return
      }

      // 处理其他节点
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((child: any) => traverse(child, 0, null))
      }
    }

    if (note.content) {
      traverse(note.content)
    }

    return tasks
  }

  /**
   * 从节点中提取纯文本（只提取任务标题，不包含子任务和上下文）
   */
  private extractTextFromNode(node: any): string {
    if (node.type === 'text') {
      return node.text || ''
    }

    // 🛑 跳过这些节点类型，不进入其内容
    const skipTypes = [
      'taskList',     // 子任务列表（不提取子任务的标题）
      'contextInfo',  // 上下文信息
      'bulletList',   // 无序列表
      'orderedList',  // 有序列表
    ]
    
    if (skipTypes.includes(node.type)) {
      return '' // 不提取这些节点的内容
    }

    // 递归处理子节点（taskItem、paragraph 等）
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



