/**
 * CompleteTaskTool - 完成/取消完成单个任务工具
 * 
 * 功能：快速标记单个任务为已完成或未完成
 * 优先级：P0（核心功能）
 * 
 * 相比 UpdateTaskTool 的优势：
 * - 语义更清晰（专门用于完成操作）
 * - 参数更简单（只需要位置和完成状态）
 * - Agent 更容易理解何时使用
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'

interface CompleteTaskParams {
  userId: string
  noteDate: string       // YYYY-MM-DD
  taskPosition: number   // 第几个任务（从 0 开始）
  completed: boolean     // true=标记为完成，false=取消完成
}

/**
 * 完成任务工具
 * 
 * 快速标记任务的完成状态
 * 适用场景：
 * - "完成第一个任务"
 * - "完成买菜任务"
 * - "取消完成第二个任务"
 * - "把锻炼标记为完成"
 */
export class CompleteTaskTool implements AgentTool {
  name = 'complete_task'
  description = '标记单个任务为已完成或未完成。这是完成任务的首选工具，比 update_task 更简单直接。需要提供笔记日期和任务位置。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      noteDate: { 
        type: 'string', 
        description: '笔记日期（必需），格式：YYYY-MM-DD。例如：2025-11-18' 
      },
      taskPosition: { 
        type: 'number', 
        description: '任务位置（必需），从 0 开始。例如：0 表示第一个任务，1 表示第二个任务' 
      },
      completed: {
        type: 'boolean',
        description: '完成状态（必需）。true=标记为已完成 ✅，false=标记为未完成 ⬜'
      }
    },
    required: ['userId', 'noteDate', 'taskPosition', 'completed']
  }

  async execute(params: CompleteTaskParams): Promise<ToolResult> {
    try {
      console.log('✅ CompleteTaskTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        noteDate: params.noteDate,
        taskPosition: params.taskPosition,
        completed: params.completed
      })

      // 1. 验证参数
      if (params.taskPosition < 0) {
        console.error('❌ 任务位置不能为负数')
        return {
          type: 'error',
          message: `任务位置不能为负数：${params.taskPosition}`
        }
      }

      if (params.completed !== true && params.completed !== false) {
        console.error('❌ completed 参数必须是 true 或 false')
        return {
          type: 'error',
          message: `completed 参数错误：${params.completed}。必须是 true（完成）或 false（未完成）`
        }
      }

      // 2. 解析日期（确保是 Date 对象）
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
      console.log(`📋 找到任务: "${originalTask.title}" (当前状态: ${originalTask.checked ? '✅' : '⬜'})`)

      // 6. 幂等性检查（避免重复操作）
      if (originalTask.checked === params.completed) {
        const statusText = params.completed ? '已完成' : '未完成'
        console.log(`ℹ️ 任务已经是${statusText}状态，无需更新数据库`)
        return {
          type: 'success',
          data: {
            noteDate: params.noteDate,
            taskPosition: params.taskPosition,
            taskTitle: originalTask.title,
            completed: params.completed,
            message: `任务「${originalTask.title}」已经是${statusText}状态`
          },
          // ✅ 即使是幂等操作也刷新，确保 UI 和数据库同步
          shouldRefreshNote: true,
          affectedDates: [params.noteDate]
        }
      }

      // 7. 更新任务完成状态
      try {
        const newContent = updateTaskInNote(
          note.content,
          params.taskPosition,
          { checked: params.completed }
        )

        // 8. 保存笔记（⚠️ 关键：noteDate 必须是 Date 对象）
        await saveNote(params.userId, noteDate, newContent)

        // 9. 构建成功消息
        const statusEmoji = params.completed ? '✅' : '⬜'
        const statusText = params.completed ? '已完成' : '未完成'
        const actionText = params.completed ? '完成' : '取消完成'
        const successMessage = `${statusEmoji} ${actionText}任务：${originalTask.title}`

        console.log(`✅ CompleteTaskTool 成功: ${successMessage}`)

        return {
          type: 'success',
          data: {
            noteDate: params.noteDate,
            taskPosition: params.taskPosition,
            taskTitle: originalTask.title,
            completed: params.completed,
            message: successMessage
          },
          // 🆕 UI 刷新标记
          shouldRefreshNote: true,
          affectedDates: [params.noteDate]
        }
      } catch (error) {
        console.error('❌ 更新任务失败:', error)
        return {
          type: 'error',
          message: `更新任务失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }
    } catch (error) {
      console.error('❌ CompleteTaskTool 执行失败:', error)
      
      let errorMessage = '完成任务失败'
      if (error instanceof Error) {
        if (error.message.includes('RLS')) {
          errorMessage = '权限错误：无法访问笔记'
        } else {
          errorMessage = `完成任务失败: ${error.message}`
        }
      }

      return {
        type: 'error',
        message: errorMessage
      }
    }
  }
}


