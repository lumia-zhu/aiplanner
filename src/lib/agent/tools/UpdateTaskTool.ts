/**
 * UpdateTaskTool - 更新任务工具
 * 
 * 功能：修改笔记中的任务（完成状态或标题）
 * 优先级：P0（核心功能）
 * 
 * Phase 5 - Step 4（基础版）
 * Step 12 将添加智能任务查找功能
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'

interface UpdateTaskParams {
  userId: string
  noteDate: string      // YYYY-MM-DD
  taskPosition: number  // 第几个任务（从 0 开始）
  updates: {
    checked?: boolean
    title?: string
  }
}

/**
 * 更新任务工具
 * 
 * 使用任务位置精确定位笔记中的任务并更新
 * 支持更新完成状态和标题
 */
export class UpdateTaskTool implements AgentTool {
  name = 'update_task'
  description = '更新笔记中的任务。可以修改任务的完成状态或标题。需要提供笔记日期和任务位置（第几个任务）。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      noteDate: { 
        type: 'string', 
        description: '笔记日期（必需），格式：YYYY-MM-DD。例如：2025-11-08' 
      },
      taskPosition: { 
        type: 'number', 
        description: '任务位置（必需），从 0 开始。例如：0 表示第一个任务，1 表示第二个任务' 
      },
      updates: {
        type: 'object',
        description: '要更新的内容（必需）',
        properties: {
          checked: {
            type: 'boolean',
            description: '是否完成（可选）。true 表示已完成，false 表示未完成'
          },
          title: {
            type: 'string',
            description: '新的任务标题（可选）。可以包含标签，格式：#标签名'
          }
        }
      }
    },
    required: ['userId', 'noteDate', 'taskPosition', 'updates']
  }

  async execute(params: UpdateTaskParams): Promise<ToolResult> {
    try {
      console.log('✏️ UpdateTaskTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        noteDate: params.noteDate,
        taskPosition: params.taskPosition,
        updates: params.updates
      })

      // 1. 验证参数
      if (params.updates.checked === undefined && !params.updates.title) {
        console.error('❌ 没有指定要更新的字段')
        return {
          type: 'error',
          message: '请指定要更新的内容：checked（完成状态）或 title（标题）'
        }
      }

      if (params.taskPosition < 0) {
        console.error('❌ 任务位置不能为负数')
        return {
          type: 'error',
          message: `任务位置不能为负数：${params.taskPosition}`
        }
      }

      // 2. 解析日期
      let noteDate: Date
      try {
        noteDate = new Date(params.noteDate)
        if (isNaN(noteDate.getTime())) {
          throw new Error('无效日期')
        }
      } catch (error) {
        console.error('❌ 日期解析失败:', params.noteDate)
        return {
          type: 'error',
          message: `日期格式错误：${params.noteDate}。请使用 YYYY-MM-DD 格式`
        }
      }

      // 3. 动态导入
      const { getNoteByDate, saveNote } = await import('@/lib/notes')
      const { updateTaskInNote, findAllTasks } = await import('@/lib/noteTaskOperations')

      // 4. 获取笔记
      const note = await getNoteByDate(params.userId, noteDate)
      
      if (!note) {
        console.error('❌ 笔记不存在:', params.noteDate)
        return {
          type: 'error',
          message: `${params.noteDate} 的笔记不存在。请先创建任务或检查日期是否正确。`
        }
      }

      // 5. 检查任务是否存在
      const tasks = findAllTasks(note.content)
      
      if (params.taskPosition >= tasks.length) {
        console.error('❌ 任务位置超出范围:', params.taskPosition, '/', tasks.length)
        return {
          type: 'error',
          message: `任务位置 ${params.taskPosition} 不存在。该笔记共有 ${tasks.length} 个任务（位置范围：0-${tasks.length - 1}）`
        }
      }

      const originalTask = tasks[params.taskPosition]
      console.log(`📋 找到任务: "${originalTask.title}"`)

      // 6. 更新任务
      try {
        const newContent = updateTaskInNote(
          note.content,
          params.taskPosition,
          params.updates
        )

        // 7. 保存笔记
        await saveNote(params.userId, note.id, newContent)

        // 8. 构建成功消息
        const updatedFields: string[] = []
        if (params.updates.checked !== undefined) {
          const statusText = params.updates.checked ? '✅ 已完成' : '⬜ 未完成'
          updatedFields.push(statusText)
        }
        if (params.updates.title) {
          updatedFields.push(`新标题："${params.updates.title}"`)
        }

        const successMessage = `✅ 任务已更新：${originalTask.title}\n${updatedFields.join('\n')}`

        console.log('✅ UpdateTaskTool 成功')

        return {
          type: 'success',
          data: {
            noteDate: params.noteDate,
            taskPosition: params.taskPosition,
            originalTitle: originalTask.title,
            updates: params.updates,
            message: successMessage
          }
        }
      } catch (error) {
        console.error('❌ 更新任务失败:', error)
        return {
          type: 'error',
          message: `更新任务失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }
    } catch (error) {
      console.error('❌ UpdateTaskTool 执行失败:', error)
      
      let errorMessage = '更新任务失败'
      if (error instanceof Error) {
        if (error.message.includes('RLS')) {
          errorMessage = '权限错误：无法访问笔记'
        } else {
          errorMessage = `更新任务失败: ${error.message}`
        }
      }

      return {
        type: 'error',
        message: errorMessage
      }
    }
  }
}





