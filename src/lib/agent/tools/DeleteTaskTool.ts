/**
 * DeleteTaskTool - 删除任务工具
 * 
 * 功能：删除笔记中的任务（含交互式确认机制）
 * 优先级：P0（核心功能）
 * 
 * Phase 5 - Step 5（含确认机制）
 * Step 12 将添加智能任务查找功能
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'

interface DeleteTaskParams {
  userId: string
  noteDate: string
  taskPosition: number
  confirmed?: boolean  // 第二轮调用时使用
}

/**
 * 删除任务工具
 * 
 * 交互式流程：
 * 1. 第一轮：显示任务详情，请求用户确认
 * 2. 第二轮：接收确认后执行删除
 */
export class DeleteTaskTool implements AgentTool {
  name = 'delete_task'
  description = '删除笔记中的任务。为安全起见，删除前会显示任务详情并请求确认。需要提供笔记日期和任务位置。'
  
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
      confirmed: { 
        type: 'boolean', 
        description: '是否已确认删除（第二轮调用时使用）。不要在第一轮调用时提供此参数' 
      }
    },
    required: ['userId', 'noteDate', 'taskPosition']
  }

  async execute(params: DeleteTaskParams, context: any): Promise<ToolResult> {
    try {
      console.log('🗑️ DeleteTaskTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        noteDate: params.noteDate,
        taskPosition: params.taskPosition,
        confirmed: params.confirmed || false
      })

      // 1. 验证参数
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
      const { deleteTaskFromNote, findAllTasks } = await import('@/lib/noteTaskOperations')

      // 4. 获取笔记
      const note = await getNoteByDate(params.userId, noteDate)
      
      if (!note) {
        console.error('❌ 笔记不存在:', params.noteDate)
        return {
          type: 'error',
          message: `${params.noteDate} 的笔记不存在。请检查日期是否正确。`
        }
      }

      // 5. 查找任务
      const tasks = findAllTasks(note.content)
      
      if (params.taskPosition >= tasks.length) {
        console.error('❌ 任务位置超出范围:', params.taskPosition, '/', tasks.length)
        return {
          type: 'error',
          message: `任务位置 ${params.taskPosition} 不存在。该笔记共有 ${tasks.length} 个任务（位置范围：0-${tasks.length - 1}）`
        }
      }

      const task = tasks[params.taskPosition]
      console.log(`📋 找到任务: "${task.title}"`)

      // 第一轮：请求确认
      if (!params.confirmed) {
        const statusIcon = task.checked ? '✅' : '⬜'
        const statusText = task.checked ? '已完成' : '未完成'

        console.log('⚠️ 请求用户确认删除')

        return {
          type: 'need_input',
          prompt: `确定要删除任务吗？\n\n📋 任务：${task.title}\n${statusIcon} 状态：${statusText}\n📅 日期：${params.noteDate}\n\n请回复 "确认" 或 "取消"`,
          context: {
            userId: params.userId,
            noteDate: params.noteDate,
            taskPosition: params.taskPosition,
            taskTitle: task.title
          }
        }
      }

      // 第二轮：执行删除
      console.log('✅ 用户已确认，执行删除')

      try {
        const newContent = deleteTaskFromNote(note.content, params.taskPosition)

        // 保存笔记
        await saveNote(params.userId, note.id, newContent)

        const successMessage = `✅ 任务已删除：${task.title}\n📅 日期：${params.noteDate}`

        console.log('✅ DeleteTaskTool 成功')

        return {
          type: 'success',
          data: {
            noteDate: params.noteDate,
            taskPosition: params.taskPosition,
            deletedTitle: task.title,
            message: successMessage
          }
        }
      } catch (error) {
        console.error('❌ 删除任务失败:', error)
        return {
          type: 'error',
          message: `删除任务失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }
    } catch (error) {
      console.error('❌ DeleteTaskTool 执行失败:', error)
      
      let errorMessage = '删除任务失败'
      if (error instanceof Error) {
        if (error.message.includes('RLS')) {
          errorMessage = '权限错误：无法访问笔记'
        } else {
          errorMessage = `删除任务失败: ${error.message}`
        }
      }

      return {
        type: 'error',
        message: errorMessage
      }
    }
  }
}

