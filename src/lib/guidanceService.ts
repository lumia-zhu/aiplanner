/**
 * 智能引导服务
 * 为用户提供基于上下文的引导建议（Phase 1: 规则引导）
 */

import type { Task } from '@/types'

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
 * 分析今日任务概况
 */
function analyzeTodayTasks(tasks: Task[]): {
  total: number
  completed: number
  urgent: number
} {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  
  const todayTasks = tasks.filter(task => {
    if (!task.deadline_datetime) return false
    const deadline = new Date(task.deadline_datetime)
    return deadline >= todayStart && deadline < todayEnd
  })
  
  const completed = todayTasks.filter(t => t.completed).length
  const urgent = todayTasks.filter(t => {
    if (t.completed) return false
    const deadline = new Date(t.deadline_datetime!)
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilDeadline < 6 && hoursUntilDeadline > 0
  }).length
  
  return {
    total: todayTasks.length,
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
  const { currentTask, allTasks } = context
  
  switch (scenario) {
    case 'action-cancelled-clarify': {
      // 取消任务澄清
      if (!currentTask) {
        return '没关系！你可以选择其他任务，或者尝试其他操作。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      // 按工作流顺序建议：拆解 → 时间估计 → 优先级
      if (analysis.missingFields.length > 0) {
        return `没关系！「${taskTitle}」还缺少${analysis.missingFields.join('、')}。你可以：\n` +
               `• 拆解这个任务看看包含哪些步骤\n` +
               `• 估算一下大概需要多久\n` +
               `• 或者选择其他任务`
      } else {
        return `没关系！「${taskTitle}」的信息已经比较完整了。你可以：\n` +
               `• 拆解这个任务为更小的子任务\n` +
               `• 估算所需时间\n` +
               `• 或者排列任务优先级`
      }
    }
    
    case 'action-cancelled-decompose': {
      // 取消任务拆解
      if (!currentTask) {
        return '没关系！你可以选择其他任务，或者尝试其他操作。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      if (analysis.missingFields.includes('时间估算')) {
        return `没关系！「${taskTitle}」可以先估算一下时间，这样更好规划。\n` +
               `也可以选择其他任务或操作。`
      } else {
        return `没关系！「${taskTitle}」看起来还不需要拆解。\n` +
               `你可以选择其他任务或操作。`
      }
    }
    
    case 'action-cancelled-estimate': {
      // 取消时间估算
      if (!currentTask) {
        return '没关系！你可以选择其他任务，或者尝试其他操作。'
      }
      
      const taskTitle = currentTask.title
      return `没关系！「${taskTitle}」可以之后再估算时间。\n` +
             `你可以先拆解任务或选择其他操作。`
    }
    
    case 'action-completed-clarify': {
      // 完成任务澄清 → 建议顺序：拆解 → 时间估计
      if (!currentTask) {
        return '太好了！任务信息已经更新。接下来你可以继续完善其他任务。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      let message = `很好！「${taskTitle}」的信息更完整了。`
      
      // 按工作流顺序建议下一步
      // 优先级1：如果任务复杂且没有子任务 → 建议拆解
      if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        message += `\n\n💡 建议：这个任务看起来比较复杂，可以拆解成小步骤更好执行。`
      }
      // 优先级2：如果已经拆解或不需要拆解 → 建议估时
      else if (analysis.missingFields.includes('时间估算')) {
        message += `\n\n⏱️ 建议：可以估算一下需要多久，方便安排时间。`
      }
      
      return message
    }
    
    case 'action-completed-decompose': {
      // 完成任务拆解 → 建议：时间估计
      if (!currentTask) {
        return '太好了！任务已经拆解完成。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      const subtaskCount = currentTask.subtasks?.length || 0
      
      let message = `很好！「${taskTitle}」已经拆分为${subtaskCount}个子任务了。`
      
      // 按工作流顺序：拆解完成后 → 建议估时
      if (analysis.missingFields.includes('时间估算')) {
        message += `\n\n💡 建议：给每个子任务估算时间，整体规划会更清晰。`
      }
      
      // ⭐ 统计今天的未完成任务（而不是所有任务）
      const todayStats = analyzeTodayTasks(allTasks)
      const todayIncompleteTasks = todayStats.total - todayStats.completed
      if (todayIncompleteTasks > 1) {
        message += `\n\n你今天还有${todayIncompleteTasks - 1}个任务待处理，要继续完善吗？`
      }
      
      return message
    }
    
    case 'action-completed-estimate': {
      // 完成时间估算 → 建议：排列优先级（都差不多了）
      if (!currentTask) {
        return '太好了！时间估算已完成。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      let message = `很好！「${taskTitle}」的时间规划更清晰了。`
      
      // 按工作流顺序：估时完成后 → 检查是否还需要拆解（反向检查）
      if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        message += `\n\n💡 建议：这个任务比较复杂，拆解成小步骤会更好执行。`
      }
      // 如果都差不多完善了，提示可以排列优先级或继续其他任务
      else {
        // ⭐ 统计今天的未完成任务（而不是所有任务）
        const todayStats = analyzeTodayTasks(allTasks)
        const todayIncompleteTasks = todayStats.total - todayStats.completed
        if (todayIncompleteTasks > 1) {
          message += `\n\n👍 任务规划得不错！你今天还有${todayIncompleteTasks - 1}个任务，可以排列一下优先级。`
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
        return '请选择你想进行的操作。'
      }
      
      const analysis = analyzeTask(currentTask)
      const taskTitle = currentTask.title
      
      if (analysis.missingFields.length >= 2) {
        return `「${taskTitle}」还有一些信息可以完善。你可以选择澄清、拆解或估时。`
      } else if (analysis.complexity === 'complex' && !analysis.hasSubtasks) {
        return `「${taskTitle}」看起来比较复杂，建议拆解成小步骤。你也可以选择其他操作。`
      } else {
        return `「${taskTitle}」已经比较完善了。你可以选择继续优化或处理其他任务。`
      }
    }
    
    default:
      return '请选择下一步操作。'
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

