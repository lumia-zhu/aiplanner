// src/lib/agent/tools/EstimateTimeTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { doubaoService } from '@/lib/doubaoService'
import type { Task } from '@/types'

interface EstimateTimeParams {
  task: Task
  userContext?: string // 用户提供的补充信息（可选）
}

/**
 * EstimateTimeTool - 任务时间估算工具
 * 
 * 功能：帮助用户估算任务所需时间
 * 特点：
 *   - 基于任务信息和用户补充上下文
 *   - 调用 AI 服务生成合理的时间估算
 *   - 提供估算理由和建议
 * 
 * Phase 2 Step 7
 */
export class EstimateTimeTool implements AgentTool {
  name = 'estimate_time'
  description = '帮助用户估算任务所需时间，基于任务复杂度、用户经验等因素提供合理的时间估算'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要估算时间的任务对象',
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
        description: '用户提供的补充信息，如任务的特殊情况、难点、以往经验等（可选）',
      },
    },
    required: ['task'],
  }

  async execute(params: EstimateTimeParams): Promise<ToolResult> {
    try {
      console.log(`🔄 EstimateTimeTool: 为任务 "${params.task.title}" 估算时间...`)
      
      if (params.userContext) {
        console.log(`📝 用户补充信息: ${params.userContext}`)
      }
      
      // 构建任务信息描述
      const taskInfo = this.buildTaskDescription(params.task, params.userContext)
      
      // 调用 AI 服务生成时间估算
      const prompt = `请为以下任务估算所需时间：

${taskInfo}

请分析任务的复杂度、所需步骤，并给出：
1. 预计时间（以分钟为单位）
2. 时间估算的理由
3. 时间分配建议（如果任务较复杂）

请以JSON格式返回：
{
  "estimated_minutes": 数字,
  "reasoning": "估算理由",
  "breakdown": "时间分配建议（可选）"
}`

      const response = await doubaoService.sendMessage(prompt)
      
      if (!response.success || !response.message) {
        return {
          type: 'error',
          message: response.error || '时间估算失败，请稍后再试'
        }
      }
      
      // 解析 AI 返回的 JSON
      const estimation = this.parseEstimationResponse(response.message)
      
      console.log(`✅ 任务「${params.task.title}」时间估算完成: ${estimation.estimated_minutes} 分钟`)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          taskTitle: params.task.title,
          estimatedMinutes: estimation.estimated_minutes,
          estimatedHours: Math.round(estimation.estimated_minutes / 60 * 10) / 10, // 保留1位小数
          reasoning: estimation.reasoning,
          breakdown: estimation.breakdown,
          message: `预计需要 ${this.formatDuration(estimation.estimated_minutes)}`,
          suggestions: [
            '建议为任务设置截止时间，帮助更好地规划',
            '如果任务较复杂，可以考虑进一步拆解',
            '留出 20% 的缓冲时间应对意外情况'
          ]
        }
      }

    } catch (error: any) {
      console.error('❌ EstimateTimeTool 执行失败:', error)
      return {
        type: 'error',
        message: `时间估算失败: ${error.message}`
      }
    }
  }

  /**
   * 构建任务描述（传递给 AI）
   */
  private buildTaskDescription(task: Task, userContext?: string): string {
    const parts: string[] = []
    
    parts.push(`任务标题：${task.title}`)
    
    if (task.description && task.description.trim().length > 0) {
      parts.push(`任务描述：${task.description}`)
    }
    
    if (task.priority) {
      const priorityMap = { high: '高', medium: '中', low: '低' }
      parts.push(`优先级：${priorityMap[task.priority as keyof typeof priorityMap] || task.priority}`)
    }
    
    if (task.deadline_datetime) {
      const deadline = new Date(task.deadline_datetime)
      parts.push(`截止时间：${deadline.toLocaleString('zh-CN')}`)
    }
    
    if (task.tags && task.tags.length > 0) {
      parts.push(`标签：${task.tags.join(', ')}`)
    }
    
    if (userContext) {
      parts.push(`\n用户补充信息：${userContext}`)
    }
    
    return parts.join('\n')
  }

  /**
   * 解析 AI 返回的时间估算结果
   */
  private parseEstimationResponse(response: string): {
    estimated_minutes: number
    reasoning: string
    breakdown?: string
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          estimated_minutes: parsed.estimated_minutes || 60, // 默认60分钟
          reasoning: parsed.reasoning || '基于任务复杂度估算',
          breakdown: parsed.breakdown
        }
      }
    } catch (error) {
      console.warn('JSON 解析失败，尝试从文本中提取:', error)
    }
    
    // 降级处理：从文本中提取时间数字
    const timeMatch = response.match(/(\d+)\s*分钟|(\d+)\s*小时/)
    let minutes = 60
    
    if (timeMatch) {
      if (timeMatch[1]) {
        minutes = parseInt(timeMatch[1])
      } else if (timeMatch[2]) {
        minutes = parseInt(timeMatch[2]) * 60
      }
    }
    
    return {
      estimated_minutes: minutes,
      reasoning: '基于任务信息和AI分析进行估算',
      breakdown: undefined
    }
  }

  /**
   * 格式化时长显示
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} 分钟`
    }
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (remainingMinutes === 0) {
      return `${hours} 小时`
    }
    
    return `${hours} 小时 ${remainingMinutes} 分钟`
  }
}

