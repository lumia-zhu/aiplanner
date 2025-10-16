/**
 * AI工作流分析服务
 * 负责分析任务列表并给出工作流推荐
 */

import type { Task, UserProfile, AIRecommendation } from '@/types'

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
  userProfile: UserProfile | null
): Promise<AIRecommendation> {
  // 情况1: 没有任务
  if (tasks.length === 0) {
    return {
      mode: 'single-task',
      reason: '你还没有添加任何任务,可以先创建一些任务,然后我再帮你完善。',
      confidence: 'low'
    }
  }

  // 情况2: 任务很少(<=2个)
  if (tasks.length <= 2) {
    return {
      mode: 'single-task',
      reason: `你目前有 ${tasks.length} 个任务,数量较少。我建议逐个完善这些任务,明确细节和执行步骤,这样执行起来会更高效。`,
      confidence: 'high'
    }
  }

  // 分析任务描述情况
  const tasksWithSimpleDesc = tasks.filter(task => {
    const descLength = (task.description || '').trim().length
    return descLength < 20 // 描述少于20字符视为简单描述
  })

  const simpleDescRatio = tasksWithSimpleDesc.length / tasks.length

  // 情况3: 有很多描述简单的任务(超过50%)
  if (simpleDescRatio > 0.5) {
    return {
      mode: 'single-task',
      reason: `你有 ${tasks.length} 个任务,其中 ${tasksWithSimpleDesc.length} 个任务的描述比较简单。我建议先逐个完善这些任务,补充必要的细节、拆解复杂任务、估计时间,这样后续执行会更清晰。完善后我们再一起排列优先级。`,
      confidence: 'medium'
    }
  }

  // 情况4: 任务较多(>5个)且大部分描述完整
  if (tasks.length > 5 && simpleDescRatio < 0.3) {
    return {
      mode: 'priority-sort',
      reason: `你有 ${tasks.length} 个任务,而且大部分任务的信息都比较完整了。我建议直接使用优先级排序功能,帮你理清"先做什么、后做什么",让计划更有条理。`,
      confidence: 'high'
    }
  }

  // 情况5: 任务数量中等(3-5个)
  if (tasks.length >= 3 && tasks.length <= 5) {
    // 检查是否有标签信息
    const tasksWithTags = tasks.filter(task => (task.tags?.length ?? 0) > 0)
    const hasGoodTagging = tasksWithTags.length / tasks.length > 0.5

    if (hasGoodTagging) {
      return {
        mode: 'priority-sort',
        reason: `你有 ${tasks.length} 个任务,而且已经添加了不少标签信息。看起来你对任务的情况比较清楚,我建议直接排列优先级,制定执行计划。`,
        confidence: 'medium'
      }
    }
  }

  // 默认情况: 推荐单个任务完善
  return {
    mode: 'single-task',
    reason: `你有 ${tasks.length} 个任务。我建议先逐个完善任务,明确每个任务的具体内容和执行步骤,然后再排列优先级。这样你会对整体计划更有把握。`,
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
    return '你还没有添加任何任务。'
  }

  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = tasks.length - completedCount
  
  const withDeadline = tasks.filter(t => t.deadline_datetime).length
  const withTags = tasks.filter(t => (t.tags?.length ?? 0) > 0).length
  const withDescription = tasks.filter(t => (t.description?.trim().length ?? 0) > 10).length

  let summary = `你目前有 ${tasks.length} 个任务`
  
  if (completedCount > 0) {
    summary += `,已完成 ${completedCount} 个`
  }
  
  if (pendingCount > 0) {
    summary += `,待完成 ${pendingCount} 个`
  }

  summary += '。'

  // 添加任务信息完整度描述
  const infoDetails = []
  if (withDeadline > 0) {
    infoDetails.push(`${withDeadline} 个有截止时间`)
  }
  if (withTags > 0) {
    infoDetails.push(`${withTags} 个有标签`)
  }
  if (withDescription > 0) {
    infoDetails.push(`${withDescription} 个有详细描述`)
  }

  if (infoDetails.length > 0) {
    summary += '其中 ' + infoDetails.join('、') + '。'
  }

  return summary
}

