// src/lib/agent/tools/DecomposeTaskTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { generateDynamicDecompositionQuestions } from '@/lib/decompositionAI'
import { parseDecompositionResponse } from '@/utils/taskDecomposition'
import { doubaoService } from '@/lib/doubaoService'
import type { Task } from '@/types'

interface DecomposeTaskParams {
  task: Task
  userContext?: string // 用户提供的上下文（第二轮）
}

/**
 * DecomposeTaskTool - 任务拆解工具
 * 
 * 功能：将复杂任务拆解为多个可执行的子任务
 * 流程：
 *   1. 第一轮：生成拆解问题，询问用户上下文
 *   2. 第二轮：根据用户回答，执行任务拆解
 * 
 * Phase 2 Step 6
 */
export class DecomposeTaskTool implements AgentTool {
  name = 'decompose_task'
  description = '将复杂任务拆解为多个子任务，帮助用户更好地规划和执行（支持交互式流程）'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要拆解的任务对象',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string' },
          // ... 其他任务属性
        },
        required: ['id', 'title'],
      },
      userContext: {
        type: 'string',
        description: '用户提供的上下文信息（第二轮，可选）',
      },
    },
    required: ['task'],
  }

  async execute(params: DecomposeTaskParams): Promise<ToolResult> {
    try {
      // ========== 第一轮：生成拆解问题 ==========
      if (!params.userContext) {
        console.log(`🔄 DecomposeTaskTool: 为任务 "${params.task.title}" 生成拆解问题...`)
        
        const questions = await generateDynamicDecompositionQuestions(params.task)
        
        if (!questions || questions.length === 0) {
          return {
            type: 'error',
            message: '生成拆解问题失败，请稍后再试。'
          }
        }
        
        const prompt = `为了更好地拆解「${params.task.title}」，我想了解一下：\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n你的回答：`
        
        console.log(`✅ 生成了 ${questions.length} 个拆解问题`)
        
        return {
          type: 'need_input',
          prompt: prompt,
          context: {
            taskId: params.task.id,
            step: 'decomposition_questions',
            originalTask: params.task, // 保存原始任务，供第二轮使用
          }
        }
      }

      // ========== 第二轮：执行任务拆解 ==========
      console.log(`🔄 DecomposeTaskTool: 处理用户对任务 "${params.task.title}" 的拆解回答...`)
      console.log(`📝 用户提供的上下文: ${params.userContext}`)
      
      // 调用豆包服务执行拆解
      const decomposeResult = await doubaoService.decomposeTask(
        params.task.title,
        params.task.description,
        params.userContext
      )
      
      if (!decomposeResult.success || !decomposeResult.message) {
        return {
          type: 'error',
          message: decomposeResult.error || '无法生成子任务，请尝试提供更详细的信息或稍后再试。'
        }
      }
      
      // 解析AI返回的JSON
      const subtasks = parseDecompositionResponse(decomposeResult.message)
      
      if (!subtasks || subtasks.length === 0) {
        return {
          type: 'error',
          message: '无法生成子任务，请尝试提供更详细的信息或稍后再试。'
        }
      }
      
      console.log(`✅ 任务「${params.task.title}」已拆解为 ${subtasks.length} 个子任务`)
      
      // 计算总预计时间（从 estimated_duration 字符串转换为分钟数）
      const totalMinutes = subtasks.reduce((sum, st) => {
        if (st.estimated_duration) {
          // estimated_duration 是字符串格式，如 "30分钟" 或 "1小时"
          const match = st.estimated_duration.match(/(\d+)/)
          const num = match ? parseInt(match[1]) : 30
          return sum + num
        }
        return sum + 30 // 默认30分钟
      }, 0)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          originalTask: params.task.title,
          subtasks: subtasks.map(st => ({
            title: st.title,
            estimatedMinutes: st.estimated_duration ? 
              (st.estimated_duration.match(/(\d+)/)?.[1] ? parseInt(st.estimated_duration.match(/(\d+)/)?.[1] || '30') : 30) : 30,
            description: st.description || ''
          })),
          totalEstimatedMinutes: totalMinutes,
          message: `已为你拆解出 ${subtasks.length} 个子任务，预计总共需要 ${totalMinutes} 分钟。`,
          suggestions: [
            '你可以将这些子任务添加到今天的任务列表中',
            '如果某个子任务仍然复杂，可以继续拆解',
            '为每个子任务设置优先级，有助于更好地规划执行顺序'
          ]
        }
      }

    } catch (error: any) {
      console.error('❌ DecomposeTaskTool 执行失败:', error)
      return {
        type: 'error',
        message: `拆解任务失败: ${error.message}`
      }
    }
  }
}

