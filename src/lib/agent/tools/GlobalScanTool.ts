// ============================================
// GlobalScanTool - 全局任务扫描工具
// ============================================
// 功能：分析当天所有任务，输出结构化的扫描结果
// 用于元认知反思流程的第一步
// ============================================

import type { AgentTool, ParameterSchema, ToolResult } from '../types'
import type { TaskSnapshot, ScanResult } from '@/types/reflection'

interface GlobalScanParams {
  tasks: TaskSnapshot[]
  noteDate?: string
}

/**
 * GlobalScanTool - 全局任务扫描
 * 
 * 分析维度：
 * - 模糊任务（标题过短或缺乏具体性）
 * - 未估时任务
 * - 工作负载（轻/中/重）
 * - 跨天任务
 * - deadline 冲突
 * - 未设优先级任务
 */
export class GlobalScanTool implements AgentTool {
  name = 'global_scan'
  
  description = `分析用户当天的任务列表，识别潜在问题并输出结构化扫描结果。
这是元认知反思流程的第一步，用于了解用户的任务规划情况。

输出包括：
- 模糊任务数量（标题过短或缺乏具体性）
- 未估时任务数量
- 工作负载评估（轻/中/重）
- 跨天任务列表
- deadline 冲突任务
- 未设优先级任务数量`

  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: '任务快照列表',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            priority: { type: 'string' },
            estimatedDuration: { type: 'number' },
            deadline: { type: 'string' },
            isCompleted: { type: 'boolean' }
          }
        }
      },
      noteDate: {
        type: 'string',
        description: '笔记日期 (YYYY-MM-DD 格式)'
      }
    },
    required: ['tasks']
  }

  async execute(params: GlobalScanParams): Promise<ToolResult> {
    try {
      const { tasks, noteDate } = params
      
      if (!tasks || tasks.length === 0) {
        return {
          type: 'success',
          data: {
            scanResult: this.createEmptyScanResult(),
            summary: '📭 今天还没有任务，可以开始规划了！'
          }
        }
      }

      console.log('🔍 GlobalScan: 开始分析', tasks.length, '个任务')

      // 执行扫描
      const scanResult = this.scanTasks(tasks, noteDate)
      
      // 生成视觉化小结
      const summary = this.generateSummary(scanResult, tasks)

      console.log('✅ GlobalScan 完成:', scanResult)

      return {
        type: 'success',
        data: {
          scanResult,
          summary
        }
      }

    } catch (error: any) {
      console.error('❌ GlobalScan 失败:', error)
      return {
        type: 'error',
        message: `任务扫描失败: ${error.message}`
      }
    }
  }

  /**
   * 扫描任务列表
   */
  private scanTasks(tasks: TaskSnapshot[], noteDate?: string): ScanResult {
    const today = noteDate || new Date().toISOString().split('T')[0]
    
    let vagueTaskCount = 0
    let unestimatedTaskCount = 0
    let noPriorityCount = 0
    const crossDayTasks: string[] = []
    const deadlineConflicts: string[] = []
    let totalEstimatedMinutes = 0

    for (const task of tasks) {
      // 跳过已完成的任务
      if (task.isCompleted) continue

      // 1. 检查模糊任务（标题过短或缺乏具体性）
      if (this.isVagueTask(task.title)) {
        vagueTaskCount++
      }

      // 2. 检查未估时任务
      if (!task.estimatedDuration) {
        unestimatedTaskCount++
      } else {
        totalEstimatedMinutes += task.estimatedDuration
      }

      // 3. 检查未设优先级
      if (!task.priority) {
        noPriorityCount++
      }

      // 4. 检查跨天任务（deadline 不是今天）
      if (task.deadline) {
        try {
          // 确保 deadline 是字符串，并且包含有效的日期格式
          const deadlineStr = String(task.deadline)
          // 尝试提取日期部分（支持 ISO 格式和纯日期格式）
          const deadlineDate = deadlineStr.includes('T') 
            ? deadlineStr.split('T')[0] 
            : deadlineStr.substring(0, 10)
          
          if (deadlineDate && deadlineDate.length >= 10) {
            if (deadlineDate !== today) {
              crossDayTasks.push(task.title)
            }
            
            // 5. 检查 deadline 冲突（deadline 已过或今天截止但优先级低）
            if (deadlineDate < today) {
              deadlineConflicts.push(`${task.title}（已过期）`)
            } else if (deadlineDate === today && task.priority === 'low') {
              deadlineConflicts.push(`${task.title}（今天截止但优先级低）`)
            }
          }
        } catch (e) {
          // 如果解析 deadline 失败，跳过这个任务的 deadline 检查
          console.warn(`⚠️ 解析任务 "${task.title}" 的 deadline 失败:`, task.deadline, e)
        }
      }
    }

    // 计算工作负载
    const workloadLevel = this.calculateWorkload(tasks, totalEstimatedMinutes)

    return {
      vagueTaskCount,
      unestimatedTaskCount,
      workloadLevel,
      crossDayTasks,
      deadlineConflicts,
      noPriorityCount,
      totalTaskCount: tasks.filter(t => !t.isCompleted).length
    }
  }

  /**
   * 判断任务是否模糊
   */
  private isVagueTask(title: string): boolean {
    // 标题过短（少于3个字符）
    if (title.length < 3) return true

    // 常见的模糊词汇（更宽松的判断）
    const vaguePatterns = [
      /^(做|写|看|学|弄|搞|处理|准备|完成|整理)$/,  // 只有单个动词
      /^.{1,2}(东西|事情|任务|工作)$/,  // XX东西、XX事情
      /^(一些|某些|其他|各种).{0,2}$/,  // 以模糊词开头且内容很少
    ]

    for (const pattern of vaguePatterns) {
      if (pattern.test(title)) return true
    }

    return false
  }

  /**
   * 计算工作负载
   */
  private calculateWorkload(
    tasks: TaskSnapshot[], 
    totalEstimatedMinutes: number
  ): 'light' | 'medium' | 'heavy' {
    const uncompletedCount = tasks.filter(t => !t.isCompleted).length

    // 基于任务数量
    if (uncompletedCount <= 2) return 'light'
    if (uncompletedCount >= 6) return 'heavy'

    // 基于估计时间（如果有的话）
    if (totalEstimatedMinutes > 0) {
      if (totalEstimatedMinutes <= 60) return 'light'
      if (totalEstimatedMinutes >= 240) return 'heavy'  // 4小时以上
    }

    return 'medium'
  }

  /**
   * 生成视觉化小结（结构化、清晰具体）
   */
  private generateSummary(scanResult: ScanResult, tasks?: TaskSnapshot[]): string {
    const lines: string[] = []
    
    // 获取未完成的任务
    const uncompletedTasks = tasks?.filter(t => !t.isCompleted) || []

    // 第一部分：任务概览
    const loadEmoji = scanResult.workloadLevel === 'light' ? '🌿' 
      : scanResult.workloadLevel === 'heavy' ? '🔥' : '⚡'
    const loadText = scanResult.workloadLevel === 'light' ? '轻松' 
      : scanResult.workloadLevel === 'heavy' ? '较忙' : '适中'
    
    lines.push(`**📋 今天的任务** (${loadEmoji} ${loadText})`)
    
    // 如果任务数量 <= 5，列出具体任务名称
    if (uncompletedTasks.length <= 5 && uncompletedTasks.length > 0) {
      const taskNames = uncompletedTasks.map(task => {
        const timeInfo = task.estimatedDuration 
          ? ` (${task.estimatedDuration}分钟)` 
          : ''
        return `「${task.title}」${timeInfo}`
      })
      lines.push(taskNames.join(' · '))
    } else {
      // 任务较多时，只显示数量
      lines.push(`共 **${scanResult.totalTaskCount}** 个待办任务`)
    }

    // 第二部分：时间规划情况（仅当有未估时任务时显示）
    if (scanResult.unestimatedTaskCount > 0 && scanResult.totalTaskCount > 1) {
      const estimatedCount = scanResult.totalTaskCount - scanResult.unestimatedTaskCount
      lines.push(``)
      lines.push(`**⏱️ 时间规划**`)
      if (estimatedCount > 0) {
        lines.push(`• ${estimatedCount} 个已估时，${scanResult.unestimatedTaskCount} 个待估时`)
      } else {
        lines.push(`• 还没有任务设置时间估计`)
      }
    }

    // 第三部分：需要关注的问题
    const issues: string[] = []
    
    if (scanResult.vagueTaskCount > 0) {
      issues.push(`• ${scanResult.vagueTaskCount} 个任务描述较模糊`)
    }
    if (scanResult.noPriorityCount > 0 && scanResult.totalTaskCount > 2) {
      issues.push(`• ${scanResult.noPriorityCount} 个任务未设优先级`)
    }
    if (scanResult.deadlineConflicts.length > 0) {
      for (const conflict of scanResult.deadlineConflicts.slice(0, 2)) {
        issues.push(`• ⚠️ ${conflict}`)
      }
    }
    if (scanResult.crossDayTasks.length > 0) {
      issues.push(`• 📅 ${scanResult.crossDayTasks.length} 个跨天任务`)
    }

    if (issues.length > 0) {
      lines.push(``)
      lines.push(`**💡 可以关注**`)
      lines.push(...issues)
    }

    return lines.join('\n')
  }

  /**
   * 创建空的扫描结果
   */
  private createEmptyScanResult(): ScanResult {
    return {
      vagueTaskCount: 0,
      unestimatedTaskCount: 0,
      workloadLevel: 'light',
      crossDayTasks: [],
      deadlineConflicts: [],
      noPriorityCount: 0,
      totalTaskCount: 0
    }
  }
}

