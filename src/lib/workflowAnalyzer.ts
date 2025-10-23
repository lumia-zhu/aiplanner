/**
 * AI工作流分析服务
 * 负责分析任务列表并给出工作流推荐
 */

import type { Task, UserProfile, AIRecommendation, DateScope } from '@/types'
import { filterTasksByScope, getScopeDescription } from '@/utils/dateUtils'

/**
 * 获取今天的任务(截止时间在今天)
 * @param tasks 任务列表
 * @returns 今天的任务列表
 */
export function getTodayTasks(tasks: Task[]): Task[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return tasks.filter(task => {
    if (!task.deadline_datetime) return false // 没有截止时间的不算今天的任务
    const deadline = new Date(task.deadline_datetime)
    return deadline >= today && deadline < tomorrow
  })
}

/**
 * 获取范围内的任务（优先使用DateScope）
 */
export function getScopedTasks(tasks: Task[], scope?: DateScope): Task[] {
  if (!scope) return getTodayTasks(tasks)
  return filterTasksByScope(tasks, scope)
}

/**
 * 分析任务列表,给出工作流推荐 (简单规则版本)
 * 
 * 推荐逻辑:
 * 1. 如果任务数量为0 -> 无法推荐
 * 2. 如果任务数量 <= 2 -> 推荐单个任务完善 (高置信度)
 * 3. 如果任务数量 > 2 且有很多描述简单的任务 -> 推荐单个任务完善 (中置信度)
 * 4. 如果任务数量 > 5 且大部分任务描述完整 -> 推荐优先级排序 (高置信度)
 * 5. 默认 -> 推荐单个任务完善 (中置信度)
 * 
 * @param tasks 任务列表
 * @param userProfile 用户个人信息(可选,未来用于优化推荐)
 * @returns AI推荐结果
 */
export async function analyzeTasksForWorkflow(
  tasks: Task[],
  userProfile: UserProfile | null,
  scope?: DateScope
): Promise<AIRecommendation> {
  // ⭐ 使用范围内的任务进行分析
  const scopedTasks = getScopedTasks(tasks, scope)
  const scopeText = scope ? getScopeDescription(scope) : 'Today'
  
  // 情况1: 范围内没有任务
  if (scopedTasks.length === 0) {
    return {
      mode: 'single-task',
      reason: `You have no tasks scheduled for ${scopeText}. You can add some tasks for ${scopeText} first, and then I'll help you refine your plan.`,
      confidence: 'low'
    }
  }

  // 情况2: 任务很少(<=2个)
  if (scopedTasks.length <= 2) {
    return {
      mode: 'single-task',
      reason: `You have ${scopedTasks.length} tasks for ${scopeText}, which is relatively few. I suggest refining these tasks one by one, clarifying details and execution steps for more efficient execution.`,
      confidence: 'high'
    }
  }

  // 分析任务描述情况
  const tasksWithSimpleDesc = scopedTasks.filter(task => {
    const descLength = (task.description || '').trim().length
    return descLength < 20 // 描述少于20字符视为简单描述
  })

  const simpleDescRatio = tasksWithSimpleDesc.length / scopedTasks.length

  // 情况3: 有很多描述简单的任务(超过50%)
  if (simpleDescRatio > 0.5) {
    return {
      mode: 'single-task',
      reason: `You have ${scopedTasks.length} tasks for ${scopeText}, of which ${tasksWithSimpleDesc.length} have relatively simple descriptions. I suggest refining these tasks one by one first, adding necessary details, breaking down complex tasks, and estimating time. This will make subsequent execution clearer. After refinement, we can arrange priorities together.`,
      confidence: 'medium'
    }
  }

  // 情况4: 任务较多(>5个)且大部分描述完整
  if (scopedTasks.length > 5 && simpleDescRatio < 0.3) {
    return {
      mode: 'priority-sort',
      reason: `You have ${scopedTasks.length} tasks for ${scopeText}, and most of the task information is quite complete. I suggest using the priority sorting feature directly to help you clarify "what to do first, what to do later" and make your plan more organized.`,
      confidence: 'high'
    }
  }

  // 情况5: 任务数量中等(3-5个)
  if (scopedTasks.length >= 3 && scopedTasks.length <= 5) {
    // 检查是否有标签信息
    const tasksWithTags = scopedTasks.filter(task => (task.tags?.length ?? 0) > 0)
    const hasGoodTagging = tasksWithTags.length / scopedTasks.length > 0.5

    if (hasGoodTagging) {
      return {
        mode: 'priority-sort',
        reason: `You have ${scopedTasks.length} tasks for ${scopeText}, and you've added quite a bit of tag information. It seems you have a good understanding of the task situation. I suggest arranging priorities directly and making an execution plan.`,
        confidence: 'medium'
      }
    }
  }

  // 默认情况: 推荐单个任务完善
  return {
    mode: 'single-task',
    reason: `You have ${scopedTasks.length} tasks for ${scopeText}. I suggest refining tasks one by one first, clarifying the specific content and execution steps of each task, and then arranging priorities. This way you'll have a better grasp of the overall plan.`,
    confidence: 'medium'
  }
}

/**
 * 生成任务摘要文本
 * @param tasks 任务列表
 * @returns 任务摘要
 */
export function generateTaskSummary(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'You haven\'t added any tasks yet.'
  }

  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = tasks.length - completedCount
  
  const withDeadline = tasks.filter(t => t.deadline_datetime).length
  const withTags = tasks.filter(t => (t.tags?.length ?? 0) > 0).length
  const withDescription = tasks.filter(t => (t.description?.trim().length ?? 0) > 10).length

  let summary = `You currently have ${tasks.length} tasks`
  
  if (completedCount > 0) {
    summary += `, ${completedCount} completed`
  }
  
  if (pendingCount > 0) {
    summary += `, ${pendingCount} pending`
  }

  summary += '.'

  // Add task information completeness description
  const infoDetails = []
  if (withDeadline > 0) {
    infoDetails.push(`${withDeadline} with deadlines`)
  }
  if (withTags > 0) {
    infoDetails.push(`${withTags} with tags`)
  }
  if (withDescription > 0) {
    infoDetails.push(`${withDescription} with detailed descriptions`)
  }

  if (infoDetails.length > 0) {
    summary += ' Among them, ' + infoDetails.join(', ') + '.'
  }

  return summary
}

/**
 * 生成详细的任务摘要(包含任务列表)
 * @param tasks 任务列表
 * @returns 详细的任务摘要,包含任务列表
 */
export function generateDetailedTaskSummary(tasks: Task[], scope?: DateScope): string {
  const scopeText = scope ? getScopeDescription(scope) : 'Today'
  if (tasks.length === 0) {
    return `You have no tasks scheduled for ${scopeText}.`
  }

  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = tasks.length - completedCount
  
  // Concise statistics
  let summary = `You have ${tasks.length} tasks for ${scopeText}`
  
  if (completedCount > 0) {
    summary += `, ${completedCount} completed`
  }
  
  if (pendingCount > 0) {
    summary += `, ${pendingCount} pending`
  }
  
  summary += '.'
  
  // Add task list
  summary += `\n\nTasks for ${scopeText}:`
  tasks.forEach((task, index) => {
    const status = task.completed ? '✅' : '⏳'
    const tags = task.tags && task.tags.length > 0 
      ? ` [${task.tags.join(', ')}]` 
      : ''
    summary += `\n${index + 1}. ${status} ${task.title}${tags}`
  })
  
  return summary
}

