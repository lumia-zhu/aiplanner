/**
 * CreateTaskTool - 创建任务工具
 * 
 * 功能：在笔记中创建新任务
 * 优先级：P0（核心功能）
 * 
 * Phase 5 - Step 3（基础版）
 * Step 10 将添加 NLP 智能解析功能
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'

interface CreateTaskParams {
  userId: string
  taskTitle: string
  targetDate?: string  // YYYY-MM-DD，默认今天
}

/**
 * 创建任务工具
 * 
 * 调用 appendTaskToNote 在笔记中添加任务
 * 支持标签解析（#标签）
 */
export class CreateTaskTool implements AgentTool {
  name = 'create_task'
  description = '在笔记中创建新任务。可以在标题中使用 # 添加标签（如"完成报告 #工作"）。默认创建在今天的笔记中。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      taskTitle: { 
        type: 'string', 
        description: '任务标题（必需）。只包含任务内容本身，不要包含时间词（如"下周一"、"明天"）。时间信息通过 targetDate 参数指定。可以包含标签，格式：#标签名' 
      },
      targetDate: { 
        type: 'string', 
        description: '任务所属日期（必须是计算后的具体日期），格式：YYYY-MM-DD。如用户说"下周一"，需根据今天日期计算出具体几月几号再传入。默认为今天。' 
      }
    },
    required: ['userId', 'taskTitle']
  }

  async execute(params: CreateTaskParams): Promise<ToolResult> {
    try {
      console.log('➕ CreateTaskTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        taskTitle: params.taskTitle,
        targetDate: params.targetDate || '今天'
      })

      // 1. 验证参数
      if (!params.taskTitle || params.taskTitle.trim().length === 0) {
        console.error('❌ 任务标题为空')
        return {
          type: 'error',
          message: '任务标题不能为空'
        }
      }

      // 2. 解析日期
      let targetDate: Date
      if (params.targetDate) {
        try {
          targetDate = new Date(params.targetDate)
          // 验证日期是否有效
          if (isNaN(targetDate.getTime())) {
            throw new Error('无效日期')
          }
        } catch (error) {
          console.error('❌ 日期解析失败:', params.targetDate)
          return {
            type: 'error',
            message: `日期格式错误：${params.targetDate}。请使用 YYYY-MM-DD 格式`
          }
        }
      } else {
        // 默认今天
        targetDate = new Date()
      }

      console.log(`📅 目标日期: ${targetDate.toLocaleDateString('zh-CN')}`)

      // 3. 动态导入（避免循环依赖）
      const { appendTaskToNote, formatNoteDate } = await import('@/lib/notes')
      
      // 4. 调用底层函数创建任务
      const note = await appendTaskToNote(
        params.userId,
        targetDate,
        params.taskTitle.trim()
      )

      // 5. 构建成功消息
      const dateStr = formatNoteDate(targetDate)
      const todayStr = formatNoteDate(new Date())
      const dateDisplay = dateStr === todayStr ? '今天' : dateStr

      const successMessage = `✅ 已创建任务：${params.taskTitle}\n📅 日期：${dateDisplay}`

      console.log('✅ CreateTaskTool 成功')

      return {
        type: 'success',
        data: {
          noteId: note.id,
          noteDate: dateStr,
          taskTitle: params.taskTitle,
          message: successMessage
        },
        // 🆕 UI 刷新标记
        shouldRefreshNote: true,
        affectedDates: [dateStr]
      }
    } catch (error) {
      console.error('❌ CreateTaskTool 执行失败:', error)
      
      // 友好的错误提示
      let errorMessage = '创建任务失败'
      if (error instanceof Error) {
        if (error.message.includes('RLS')) {
          errorMessage = '权限错误：无法访问笔记'
        } else if (error.message.includes('network')) {
          errorMessage = '网络错误：请检查网络连接'
        } else {
          errorMessage = `创建任务失败: ${error.message}`
        }
      }

      return {
        type: 'error',
        message: errorMessage
      }
    }
  }
}





