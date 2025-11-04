/**
 * AnalyzeTasksTool - 分析任务状态工具
 * 
 * 功能：分析任务状态，识别紧急任务、缺少估算的任务、可拆解的任务等
 * 优先级：P0（核心功能）
 * 
 * Phase 2 Step 4
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import type { Task } from '@/types'
import { isAfter, isBefore, addDays, parseISO } from 'date-fns'

interface AnalyzeTasksParams {
  tasks: Task[] // 可以从 TaskContext 或 GetTasksTool 获取
}

/**
 * 分析任务状态工具
 * 
 * 识别需要处理的问题：
 * - 紧急任务（deadline 在 3 天内）
 * - 缺少时间估算
 * - 缺少描述/上下文（可能需要澄清）
 * - 可能可以拆解（标题较长或包含连接词）
 * - 优先级分布
 */
export class AnalyzeTasksTool implements AgentTool {
  name = 'analyze_tasks'
  description = '分析任务状态，识别紧急任务、缺少估算的任务、需要澄清的任务、可拆解的任务等，返回统计信息和建议'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: '任务列表（可从 TaskContext 或 GetTasksTool 获取）',
        items: { type: 'object' }
      }
    },
    required: ['tasks']
  }

  async execute(params: AnalyzeTasksParams): Promise<ToolResult> {
    try {
      const tasks = params.tasks || []
      const now = new Date()

      console.log(`📊 开始分析 ${tasks.length} 个任务...`)

      // 分析维度
      const analysis = {
        total: tasks.length,
        completed: tasks.filter(t => t.is_completed).length,
        
        // 紧急任务：deadline 在 3 天内
        urgent: this.findUrgentTasks(tasks, now),
        
        // 缺少时间估算
        needsEstimation: this.findTasksNeedingEstimation(tasks),
        
        // 缺少描述/上下文（可能需要澄清）
        needsClarification: this.findTasksNeedingClarification(tasks),
        
        // 可能可以拆解（标题较长或包含连接词）
        canDecompose: this.findDecomposableTasks(tasks),
        
        // 优先级分布
        byPriority: this.getPriorityDistribution(tasks),
        
        // 建议
        suggestions: [] as string[]
      }

      // 生成建议
      analysis.suggestions = this.generateSuggestions(analysis)

      console.log(`✅ 分析完成:`)
      console.log(`  - 总任务: ${analysis.total}`)
      console.log(`  - 已完成: ${analysis.completed}`)
      console.log(`  - 紧急: ${analysis.urgent.length}`)
      console.log(`  - 需估算: ${analysis.needsEstimation.length}`)
      console.log(`  - 需澄清: ${analysis.needsClarification.length}`)
      console.log(`  - 可拆解: ${analysis.canDecompose.length}`)

      return {
        type: 'success',
        data: analysis
      }

    } catch (error: any) {
      console.error('❌ 任务分析失败:', error)
      return {
        type: 'error',
        message: `任务分析失败: ${error.message}`
      }
    }
  }

  /**
   * 查找紧急任务（deadline 在 3 天内）
   */
  private findUrgentTasks(tasks: Task[], now: Date) {
    return tasks
      .filter(t => {
        if (t.is_completed || !t.deadline_datetime) return false
        
        try {
          const deadline = parseISO(t.deadline_datetime)
          return isBefore(deadline, addDays(now, 3))
        } catch {
          return false
        }
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        deadline: t.deadline_datetime,
        priority: t.priority || 'low'
      }))
  }

  /**
   * 查找缺少时间估算的任务
   */
  private findTasksNeedingEstimation(tasks: Task[]) {
    return tasks
      .filter(t => !t.is_completed && !t.estimated_duration)
      .map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority || 'low'
      }))
  }

  /**
   * 查找缺少描述/上下文的任务（可能需要澄清）
   */
  private findTasksNeedingClarification(tasks: Task[]) {
    return tasks
      .filter(t => {
        if (t.is_completed) return false
        
        // 标题过短（<5个字符）或没有描述
        const titleTooShort = t.title.length < 5
        const noDescription = !t.description || t.description.length < 10
        
        return titleTooShort || noDescription
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        reason: t.title.length < 5 ? '标题过短' : '缺少描述'
      }))
  }

  /**
   * 查找可能可以拆解的任务
   * 
   * 识别规则：
   * 1. 标题较长（>30个字符）
   * 2. 包含连接词（和、与、及、、，等）
   * 3. 包含多个动词或步骤
   */
  private findDecomposableTasks(tasks: Task[]) {
    return tasks
      .filter(t => {
        if (t.is_completed) return false
        
        const title = t.title
        
        // 规则1: 标题较长
        const isTooLong = title.length > 30
        
        // 规则2: 包含连接词
        const hasConjunctions = /[和与及、，,]/.test(title)
        
        // 规则3: 包含多个步骤（数字编号、分号等）
        const hasMultipleSteps = /[1-9]\.|\d+、|；|;/.test(title)
        
        return isTooLong || hasConjunctions || hasMultipleSteps
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        reason: this.getDecompositionReason(t.title)
      }))
  }

  /**
   * 获取任务可拆解的原因
   */
  private getDecompositionReason(title: string): string {
    const reasons: string[] = []
    
    if (title.length > 30) {
      reasons.push('标题较长')
    }
    
    if (/[和与及、，,]/.test(title)) {
      reasons.push('包含连接词')
    }
    
    if (/[1-9]\.|\d+、|；|;/.test(title)) {
      reasons.push('包含多个步骤')
    }
    
    return reasons.join(', ')
  }

  /**
   * 获取优先级分布
   */
  private getPriorityDistribution(tasks: Task[]) {
    const uncompletedTasks = tasks.filter(t => !t.is_completed)
    
    return {
      high: uncompletedTasks.filter(t => t.priority === 'high').length,
      medium: uncompletedTasks.filter(t => t.priority === 'medium').length,
      low: uncompletedTasks.filter(t => t.priority === 'low' || !t.priority).length
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(analysis: any): string[] {
    const suggestions: string[] = []

    // 紧急任务建议
    if (analysis.urgent.length > 0) {
      suggestions.push(`⚠️ 有 ${analysis.urgent.length} 个紧急任务（3天内到期），建议优先处理`)
    }

    // 时间估算建议
    if (analysis.needsEstimation.length > 0) {
      suggestions.push(`⏱️ 有 ${analysis.needsEstimation.length} 个任务缺少时间估算，建议补充以便更好地规划时间`)
    }

    // 任务澄清建议
    if (analysis.needsClarification.length > 0) {
      suggestions.push(`❓ 有 ${analysis.needsClarification.length} 个任务需要澄清（标题过短或缺少描述），建议补充详细信息`)
    }

    // 任务拆解建议
    if (analysis.canDecompose.length > 0) {
      suggestions.push(`🔨 有 ${analysis.canDecompose.length} 个任务可能需要拆解（标题较长或包含多个步骤），拆解后更易执行`)
    }

    // 优先级建议
    const { high, medium, low } = analysis.byPriority
    const total = high + medium + low
    
    if (total > 0) {
      if (high > total * 0.5) {
        suggestions.push(`🔥 高优先级任务占比较高（${Math.round(high / total * 100)}%），建议集中精力处理`)
      }
      
      if (low > total * 0.7) {
        suggestions.push(`💡 低优先级任务占比较高（${Math.round(low / total * 100)}%），可以考虑提升部分任务优先级`)
      }
    }

    // 完成度建议
    const completionRate = analysis.total > 0 ? analysis.completed / analysis.total : 0
    if (completionRate > 0 && completionRate < 0.3) {
      suggestions.push(`📈 完成率较低（${Math.round(completionRate * 100)}%），建议先完成一些小任务建立节奏`)
    }

    // 任务量建议
    if (analysis.total - analysis.completed > 20) {
      suggestions.push(`📚 待办任务较多（${analysis.total - analysis.completed}个），建议分批处理，避免overwhelm`)
    }

    if (suggestions.length === 0) {
      suggestions.push('✨ 任务状态良好，继续保持！')
    }

    return suggestions
  }
}

