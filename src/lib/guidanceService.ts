/**
 * 智能引导服务
 * 为用户提供基于上下文的引导建议（Phase 1: 规则引导）
 */

import type { Task, DateScope } from '@/types'
import { filterTasksByScope, getScopeDescription } from '@/utils/dateUtils'

// ============================================
// 类型定义
// ============================================

/**
 * 引导场景类型
 */
export type GuidanceScenario = 
  | 'action-cancelled-clarify'    // 取消任务澄清
  | 'action-cancelled-decompose'  // 取消任务拆解
  | 'action-cancelled-estimate'   // 取消时间估算
  | 'action-completed-clarify'    // 完成任务澄清
  | 'action-completed-decompose'  // 完成任务拆解
  | 'action-completed-estimate'   // 完成时间估算
  | 'task-selected'               // 选择任务后
  | 'return-to-action-select'     // 返回到操作选择

/**
 * 引导上下文
 */
export interface GuidanceContext {
  // 当前任务
  currentTask?: Task
  
  // 所有任务
  allTasks: Task[]
  
  // ⭐ 日期范围（用于筛选任务）
  dateScope?: DateScope
  
  // 最近操作历史（可选，Phase 2使用）
  recentActions?: string[]
}

/**
 * 任务状态分析结果
 */
interface TaskAnalysis {
  missingFields: string[]      // 缺失的字段
  hasSubtasks: boolean          // 是否有子任务
  isUrgent: boolean            // 是否紧急
  complexity: 'simple' | 'medium' | 'complex'  // 复杂度
}

// ============================================
// 任务分析工具
// ============================================

/**
 * 分析任务状态，识别缺失信息
 */
function analyzeTask(task: Task): TaskAnalysis {
  const missingFields: string[] = []
  
  // 检查缺失字段
  if (!task.description || task.description.trim().length === 0) {
    missingFields.push('详细描述')
  }
  if (!task.deadline_datetime) {
    missingFields.push('截止时间')
  }
  if (!task.estimated_duration) {
    missingFields.push('时间估算')
  }
  
  // 判断是否有子任务
  const hasSubtasks = (task.subtasks && task.subtasks.length > 0) || false
  
  // 判断是否紧急
  let isUrgent = false
  if (task.deadline_datetime) {
    const deadline = new Date(task.deadline_datetime)
    const now = new Date()
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    isUrgent = hoursUntilDeadline < 24 && hoursUntilDeadline > 0
  }
  
  // 判断复杂度
  let complexity: 'simple' | 'medium' | 'complex' = 'medium'
  if (task.tags?.includes('easy')) {
    complexity = 'simple'
  } else if (task.tags?.includes('difficult') || hasSubtasks) {
    complexity = 'complex'
  }
  
  return {
    missingFields,
    hasSubtasks,
    isUrgent,
    complexity
  }
}

/**
 * 分析范围内任务概况（替换原来的analyzeTodayTasks）
 * @param tasks 所有任务列表
 * @param scope 日期范围（可选，默认使用今天）
 */
function analyzeScopedTasks(tasks: Task[], scope?: DateScope): {
  total: number
  completed: number
  urgent: number
} {
  // 如果有scope，使用scope筛选；否则使用今天
  let scopedTasks: Task[]
  if (scope) {
    scopedTasks = filterTasksByScope(tasks, scope)
  } else {
    // 降级：使用今天
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    
    scopedTasks = tasks.filter(task => {
      if (!task.deadline_datetime) return false
      const deadline = new Date(task.deadline_datetime)
      return deadline >= todayStart && deadline < todayEnd
    })
  }
  
  const now = new Date()
  const completed = scopedTasks.filter(t => t.completed).length
  const urgent = scopedTasks.filter(t => {
    if (t.completed) return false
    if (!t.deadline_datetime) return false
    const deadline = new Date(t.deadline_datetime)
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilDeadline < 6 && hoursUntilDeadline > 0
  }).length
  
  return {
    total: scopedTasks.length,
    completed,
    urgent
  }
}

// ============================================
// 规则引导消息生成
// ============================================

/**
 * 生成基于规则的引导消息
 * @param scenario 引导场景
 * @param context 引导上下文
 * @returns 引导消息文本
 */
export function generateRuleBasedGuidance(
  scenario: GuidanceScenario,
  context: GuidanceContext
): string {
  const { currentTask, allTasks, dateScope } = context
  
  // ⭐ 辅助函数：给消息添加范围标签
  const withScopePrefix = (message: string): string => {
    if (dateScope) {
      return `📅 [Current scope: ${getScopeDescription(dateScope)}]\n\n${message}`
    }
    return message
  }
  
  switch (scenario) {
    case 'action-cancelled-clarify': {
      // 取消任务澄清
      if (!currentTask) {
        return 'No problem! You can choose another task or try other actions.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      // 按工作流顺序建议：拆解 → 时间估计 → 优先级
      if (analysis.missingFields.length > 0) {
        return `No problem! "` + taskTitle + `" is missing ${analysis.missingFields.join('、')}. You can:\n` +
               `• Decompose this task to see what steps it includes\n` +
               `• Estimate how long it will take\n` +
               `• Or choose another task`
      } else {
        return `No problem! "` + taskTitle + `" information is already quite complete. You can:\n` +
               `• Decompose this task into smaller subtasks\n` +
               `• Estimate the required time\n` +
               `• Or arrange task priorities`
      }
    }
    
    case 'action-cancelled-decompose': {
      // 取消任务拆解
      if (!currentTask) {
        return 'No problem! You can choose another task or try other actions.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      if (analysis.missingFields.includes('时间估算')) {
        return `No problem! "` + taskTitle + `" you can first estimate the time, which is better for planning. \n` +
               `You can also choose another task or operation.`
      } else {
        return `No problem! "` + taskTitle + `" doesn't seem to need decomposition. \n` +
               `You can choose another task or operation.`
      }
    }
    
    case 'action-cancelled-estimate': {
      // 取消时间估算
      if (!currentTask) {
        return 'No problem! You can choose another task or try other actions.'
      }
      
      const taskTitle = currentTask.title
      return `No problem! "` + taskTitle + `" you can estimate the time later. \n` +
             `You can first decompose the task or choose another operation.`
    }
    
    case 'action-completed-clarify': {
      // 完成任务澄清 → 建议顺序：拆解 → 时间估计
      if (!currentTask) {
        return 'Great! Task information has been updated. You can continue to improve other tasks.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      let message = `Great! "` + taskTitle + `" information is more complete. `
      
      // 按工作流顺序建议下一步
      // 优先级1：如果任务复杂且没有子任务 → 建议拆解
      if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        message += `\n\n💡 Suggestion: This task looks relatively complex, you can decompose it into smaller steps for better execution. `
      }
      // 优先级2：如果已经拆解或不需要拆解 → 建议估时
      else if (analysis.missingFields.includes('时间估算')) {
        message += `\n\n⏱️ Suggestion: You can estimate how long it will take, which is convenient for arranging time. `
      }
      
      return message
    }
    
    case 'action-completed-decompose': {
      // 完成任务拆解 → 建议：时间估计
      if (!currentTask) {
        return 'Great! Task decomposition is complete.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      const subtaskCount = currentTask.subtasks?.length || 0
      
      let message = `Great! "` + taskTitle + `" has been decomposed into ${subtaskCount} subtasks. `
      
      // 按工作流顺序：拆解完成后 → 建议估时
      if (analysis.missingFields.includes('时间估算')) {
        message += `\n\n💡 Suggestion: Estimate time for each subtask, the overall plan will be clearer. `
      }
      
      // ⭐ 统计范围内的未完成任务（而不是所有任务）
      const scopedStats = analyzeScopedTasks(allTasks, dateScope)
      const scopedIncompleteTasks = scopedStats.total - scopedStats.completed
      if (scopedIncompleteTasks > 1) {
        message += `\n\nYou still have ${scopedIncompleteTasks - 1} tasks to complete, do you want to continue improving? `
      }
      
      return message
    }
    
    case 'action-completed-estimate': {
      // 完成时间估算 → 建议：排列优先级（都差不多了）
      if (!currentTask) {
        return 'Great! Time estimation is complete.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      let message = `Great! "` + taskTitle + `" time planning is clearer. `
      
      // 按工作流顺序：估时完成后 → 检查是否还需要拆解（反向检查）
      if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        message += `\n\n💡 Suggestion: This task is relatively complex, decomposing it into smaller steps will be better to execute. `
      }
      // 如果都差不多完善了，提示可以排列优先级或继续其他任务
      else {
        // ⭐ 统计范围内的未完成任务（而不是所有任务）
        const scopedStats = analyzeScopedTasks(allTasks, dateScope)
        const scopedIncompleteTasks = scopedStats.total - scopedStats.completed
        if (scopedIncompleteTasks > 1) {
          message += `\n\n👍 Task planning is good! You still have ${scopedIncompleteTasks - 1} tasks, you can arrange the priorities. `
        }
      }
      
      return message
    }
    
    case 'task-selected': {
      // 选择任务后（暂时不用，因为会立即进入操作选择）
      return ''
    }
    
    case 'return-to-action-select': {
      // 返回到操作选择（通用场景）
      if (!currentTask) {
        return 'Please choose the operation you want to perform.'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      if (analysis.missingFields.length >= 2) {
        return `"` + taskTitle + `" still has some information to improve. You can choose to clarify, decompose, or estimate time. `
      } else if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        return `"` + taskTitle + `" looks relatively complex, it is recommended to decompose it into smaller steps. You can also choose other operations. `
      } else {
        return `"` + taskTitle + `" is already relatively complete. You can choose to continue optimizing or processing other tasks. `
      }
    }
    
    default:
      return 'Please choose the next operation.'
  }
}

// ============================================
// 主入口函数（Phase 1: 仅规则引导）
// ============================================

/**
 * 获取智能引导消息
 * Phase 1: 仅使用规则引导
 * Phase 2+: 可扩展为混合模式（简单场景用规则，复杂场景用AI）
 */
export function getGuidanceMessage(
  scenario: GuidanceScenario,
  context: GuidanceContext
): string {
  // Phase 1: 仅使用规则引导
  return generateRuleBasedGuidance(scenario, context)
}

