/**
 * 任务澄清问题生成器
 * 根据任务特征智能生成2-3个苏格拉底式问题，帮助用户更好地理解任务
 */

import type { Task, ClarificationQuestion, ClarificationDimension } from '@/types'

// ============================================
// 问题模板库（6个维度）
// ============================================

interface QuestionTemplate {
  dimension: ClarificationDimension
  questions: string[]
  purpose: string
}

const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    dimension: 'intent',
    questions: [
      '这个任务完成后，你期待得到什么具体成果？',
      '完成这个任务的核心目标是什么？',
      '你希望通过这个任务达成什么效果？',
    ],
    purpose: '明确目标产出'
  },
  {
    dimension: 'structure',
    questions: [
      '要完成这个任务，你打算分几个主要步骤？',
      '这个任务可以拆分成哪些具体的执行环节？',
      '你准备按什么顺序来推进这个任务？',
    ],
    purpose: '识别关键步骤'
  },
  {
    dimension: 'timeline',
    questions: [
      '你预计完成这个任务大概需要多长时间？',
      '这个任务什么时候必须完成？',
      '每个主要步骤大概需要多久？',
    ],
    purpose: '合理估算时间'
  },
  {
    dimension: 'dependency',
    questions: [
      '完成这个任务需要哪些人、信息或工具的支持？',
      '有没有需要提前准备或申请的资源？',
      '这个任务依赖其他任务或事项吗？',
    ],
    purpose: '识别资源依赖'
  },
  {
    dimension: 'obstacle',
    questions: [
      '在执行过程中，你觉得可能会遇到什么困难？',
      '这个任务中哪个部分最有挑战性？',
      '有什么因素可能会影响任务的顺利完成？',
    ],
    purpose: '识别潜在风险'
  },
  {
    dimension: 'priority',
    questions: [
      '为什么这个任务对你来说很重要？',
      '如果这个任务延后，会产生什么影响？',
      '这个任务的紧急程度如何？',
    ],
    purpose: '评估任务优先级'
  },
]

// ============================================
// 核心函数：生成澄清问题
// ============================================

/**
 * 根据任务特征智能生成2-3个澄清问题
 * @param task 需要澄清的任务
 * @returns 2-3个澄清问题数组
 */
export function generateClarificationQuestions(task: Task): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = []
  const selectedDimensions: ClarificationDimension[] = []

  // 策略1：基础问题 - 所有任务都问意图
  selectedDimensions.push('intent')

  // 策略2：根据任务标签选择问题维度
  const tags = task.tags || []
  
  if (tags.includes('difficult')) {
    // 困难任务 → 询问障碍和结构
    if (!selectedDimensions.includes('obstacle')) {
      selectedDimensions.push('obstacle')
    }
  } else if (tags.includes('important')) {
    // 重要任务 → 询问优先级和依赖
    if (!selectedDimensions.includes('priority')) {
      selectedDimensions.push('priority')
    }
  } else if (tags.includes('easy')) {
    // 简单任务 → 询问结构（为什么要拆解）
    if (!selectedDimensions.includes('structure')) {
      selectedDimensions.push('structure')
    }
  }

  // 策略3：根据截止日期判断是否询问时间
  if (task.deadline_datetime && !selectedDimensions.includes('timeline')) {
    selectedDimensions.push('timeline')
  }

  // 策略4：根据描述长度判断是否需要澄清依赖
  const descriptionLength = task.description?.length || 0
  if (descriptionLength < 20 && !selectedDimensions.includes('dependency')) {
    // 描述很短，可能缺少依赖信息
    selectedDimensions.push('dependency')
  }

  // 策略5：如果维度不足3个，补充结构维度（通用）
  if (selectedDimensions.length < 3 && !selectedDimensions.includes('structure')) {
    selectedDimensions.push('structure')
  }

  // 策略6：如果还不足3个，补充优先级维度
  if (selectedDimensions.length < 3 && !selectedDimensions.includes('priority')) {
    selectedDimensions.push('priority')
  }

  // 限制最多3个维度
  const finalDimensions = selectedDimensions.slice(0, 3)

  // 从每个维度中随机选择一个问题
  finalDimensions.forEach(dimension => {
    const template = QUESTION_TEMPLATES.find(t => t.dimension === dimension)
    if (template) {
      const randomIndex = Math.floor(Math.random() * template.questions.length)
      questions.push({
        dimension: template.dimension,
        question: template.questions[randomIndex],
        purpose: template.purpose
      })
    }
  })

  return questions
}

// ============================================
// 格式化函数：将问题转换为消息文本
// ============================================

/**
 * 格式化澄清问题列表为友好的消息文本
 * @param task 需要澄清的任务
 * @param questions 澄清问题数组
 * @returns 格式化后的消息文本
 */
export function formatClarificationQuestionsMessage(
  task: Task,
  questions: ClarificationQuestion[]
): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join('\n\n')

  return `Great! Before we start clarifying "${task.title}", I'd like to understand some background information:

${questionList}

💡 Please answer these questions in the input box below. You can also provide any other information you know (feel free to describe, no need to strictly follow question numbers)`
}

// ============================================
// 辅助函数：获取推荐澄清任务
// ============================================

/**
 * 从任务列表中推荐需要澄清的任务
 * @param tasks 所有任务
 * @returns 推荐的任务和理由
 */
export function recommendTasksForClarification(tasks: Task[]): Array<{
  task: Task
  reason: string
}> {
  const recommendations: Array<{ task: Task; reason: string }> = []

  tasks.forEach(task => {
    // 跳过已完成的任务
    if (task.completed) return

    // 跳过子任务（只推荐顶级任务）
    if (task.parent_id) return

    const reasons: string[] = []

    // ⭐ 检查1：没有描述
    if (!task.description || task.description.trim().length === 0) {
      reasons.push('Missing description')
    }

    // ⭐ 检查2：描述很短（少于20字）
    if (task.description && task.description.trim().length > 0 && task.description.trim().length < 20) {
      reasons.push('Brief description')
    }

    // ⭐ 检查3：没有截止时间
    if (!task.deadline_datetime) {
      reasons.push('No deadline set')
    }

    // ⭐ 检查4：没有预估时长
    if (!task.estimated_duration) {
      reasons.push('No time estimate')
    }

    // ⭐ 检查5：没有优先级标签（important/urgent/normal等）
    const hasPriorityTag = task.tags?.some(tag => 
      ['important', 'urgent', 'normal', 'low'].includes(tag)
    )
    if (!hasPriorityTag) {
      reasons.push('No priority marked')
    }

    // ⭐ 检查6：标题很长（可能不够清晰）
    if (task.title.length > 20) {
      reasons.push('Long title')
    }

    // ⭐ 检查7：标记为困难任务
    if (task.tags?.includes('difficult')) {
      reasons.push('Difficult task needs detailed planning')
    }

    // ⭐ 检查8：标记为重要但信息不完整
    if (task.tags?.includes('important')) {
      if (!task.deadline_datetime || !task.estimated_duration) {
        reasons.push('Important task with incomplete info')
      }
    }

    // ⭐ 改进：几乎所有任务都会有理由，但按"缺失信息数量"排序优先级
    // 至少有1个理由就推荐
    if (reasons.length > 0) {
      recommendations.push({
        task,
        reason: reasons.join('、')
      })
    }
  })

  // 按理由数量排序（理由越多 = 缺失信息越多 = 越需要澄清）
  recommendations.sort((a, b) => {
    const aReasonCount = a.reason.split('、').length
    const bReasonCount = b.reason.split('、').length
    return bReasonCount - aReasonCount
  })

  return recommendations
}

/**
 * 格式化推荐澄清任务列表为消息文本
 * @param recommendations 推荐列表
 * @returns 格式化后的消息文本
 */
export function formatRecommendationsMessage(
  recommendations: Array<{ task: Task; reason: string }>
): string {
  if (recommendations.length === 0) {
    return 'Select a task, and I will ask you a few questions to help you better understand it.'
  }

  const topRecommendations = recommendations.slice(0, 3)
  const suggestionList = topRecommendations
    .map((rec, i) => `${i + 1}. **${rec.task.title}** - ${rec.reason}`)
    .join('\n')

  return `Based on your task situation, I suggest prioritizing clarification of the following tasks:

${suggestionList}

Select a task, and I will ask you a few questions to help you better understand it.`
}

// ============================================
// 辅助函数：获取推荐时间估计任务
// ============================================

/**
 * 从任务列表中推荐需要时间估计的任务
 * @param tasks 所有任务
 * @returns 推荐的任务和理由
 */
export function recommendTasksForTimeEstimation(tasks: Task[]): Array<{
  task: Task
  reason: string
}> {
  const recommendations: Array<{ task: Task; reason: string }> = []

  tasks.forEach(task => {
    // 跳过已完成的任务
    if (task.completed) return

    // 跳过子任务（只推荐顶级任务）
    if (task.parent_id) return

    const reasons: string[] = []

    // 检查1：没有预估时长
    if (!task.estimated_duration) {
      reasons.push('Missing time estimate')
    }

    // 检查2：标记为困难（通常需要更准确的时间估计）
    if (task.tags?.includes('difficult')) {
      reasons.push('Difficult task needs accurate estimation')
    }

    // 检查3：有多个子任务的父任务
    if (task.subtasks && task.subtasks.length > 0) {
      reasons.push(`Contains ${task.subtasks.length} subtasks`)
    }

    // 检查4：标题很长或描述复杂（可能任务复杂）
    if (task.title.length > 20 || (task.description?.length || 0) > 100) {
      reasons.push('Complex task')
    }

    // 检查5：有明确截止时间但没有时间估计（需要规划）
    if (task.deadline_datetime && !task.estimated_duration) {
      reasons.push('Has deadline, needs planning')
    }

    // 如果有任何理由，添加到推荐列表
    if (reasons.length > 0) {
      recommendations.push({
        task,
        reason: reasons.join('、')
      })
    }
  })

  // 按理由数量排序（理由越多越推荐）
  recommendations.sort((a, b) => {
    const aReasonCount = a.reason.split('、').length
    const bReasonCount = b.reason.split('、').length
    return bReasonCount - aReasonCount
  })

  return recommendations
}

/**
 * 格式化推荐时间估计任务列表为消息文本
 * @param recommendations 推荐列表
 * @returns 格式化后的消息文本
 */
export function formatTimeEstimationRecommendationsMessage(
  recommendations: Array<{ task: Task; reason: string }>
): string {
  if (recommendations.length === 0) {
    return 'Select a task, and I will help you estimate how long it will take.'
  }

  const topRecommendations = recommendations.slice(0, 3)
  const suggestionList = topRecommendations
    .map((rec, i) => `${i + 1}. **${rec.task.title}** - ${rec.reason}`)
    .join('\n')

  return `Based on your task situation, I suggest prioritizing time estimation for the following tasks:

${suggestionList}

Select a task, and I will help you estimate how long it will take.`
}

