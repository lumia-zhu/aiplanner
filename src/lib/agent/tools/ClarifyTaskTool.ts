/**
 * ClarifyTaskTool - 任务澄清工具
 * 
 * 功能：生成苏格拉底式问题，帮助用户澄清任务定义（支持交互式流程）
 * 优先级：P1（重要功能）
 * 
 * Phase 2 Step 5
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import type { Task } from '@/types'

interface ClarifyTaskParams {
  task: Task
  userContext?: string // 用户在上一轮提供的回答
}

/**
 * 任务澄清工具
 * 
 * 支持交互式流程：
 * 1. 第一轮：生成澄清问题，返回 need_input
 * 2. 第二轮：接收用户回答，保存澄清结果
 * 
 * 复用现有的 clarificationAI 服务
 */
export class ClarifyTaskTool implements AgentTool {
  name = 'clarify_task'
  description = '生成苏格拉底式问题，帮助用户澄清任务定义。支持交互式流程：先生成问题，用户回答后保存澄清结果'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要澄清的任务对象'
      },
      userContext: {
        type: 'string',
        description: '用户提供的回答（第二轮调用时使用）'
      }
    },
    required: ['task']
  }

  async execute(params: ClarifyTaskParams): Promise<ToolResult> {
    try {
      // 第一轮：生成澄清问题
      if (!params.userContext) {
        console.log(`❓ 为任务「${params.task.title}」生成澄清问题...`)
        
        // 动态导入（避免循环依赖）
        const { generateDynamicClarificationQuestions } = await import('@/lib/clarificationAI')
        
        const questions = await generateDynamicClarificationQuestions(params.task)
        
        if (!questions || questions.length === 0) {
          return {
            type: 'error',
            message: '生成澄清问题失败'
          }
        }
        
        console.log(`✅ 生成了 ${questions.length} 个澄清问题`)
        
        // 返回 need_input，暂停 Agent 循环，等待用户回答
        return {
          type: 'need_input',
          prompt: `为了更好地澄清任务「${params.task.title}」，我想了解一下：\n\n${questions.join('\n')}`,
          context: {
            taskId: params.task.id,
            taskTitle: params.task.title,
            step: 'clarification',
            questions
          }
        }
      }

      // 第二轮：用户已回答，保存澄清结果
      console.log(`✅ 任务「${params.task.title}」已澄清`)
      console.log(`用户回答: ${params.userContext.substring(0, 100)}...`)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          taskTitle: params.task.title,
          clarification: params.userContext,
          message: '澄清完成！现在对这个任务有更清晰的理解了',
          suggestions: [
            '可以基于澄清结果更新任务描述',
            '如果任务仍然复杂，可以考虑拆解',
            '可以为任务添加时间估算'
          ]
        }
      }

    } catch (error: any) {
      console.error('❌ 澄清任务失败:', error)
      return {
        type: 'error',
        message: `澄清任务失败: ${error.message}`
      }
    }
  }
}



