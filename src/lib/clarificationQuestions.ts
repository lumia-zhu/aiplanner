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
      '你准备这个任务的主要目的是什么？是展示进展、提新想法，还是汇报数据？',
      '这个任务的最终目标是什么？你希望达到什么样的结果？',
      '完成这个任务后，你期望的产出形式是什么？',
    ],
    purpose: '区分目标与产出形式'
  },
  {
    dimension: 'structure',
    questions: [
      '这项任务包含哪些部分？比如收集内容、设计版面、排练？',
      '你认为完成这个任务需要哪些步骤？',
      '这个任务可以分成几个小块来做？',
    ],
    purpose: '引导拆解任务'
  },
  {
    dimension: 'timeline',
    questions: [
      '这个任务什么时候需要完成？',
      '你希望提前多久完成这个任务？',
      '有明确的截止时间吗？还是可以灵活安排？',
    ],
    purpose: '补充时间上下文'
  },
  {
    dimension: 'dependency',
    questions: [
      '有没有需要别人提供的信息或文件？',
      '完成这个任务需要依赖哪些外部资源？',
      '需要等待其他人或事情完成吗？',
    ],
    purpose: '识别外部依赖'
  },
  {
    dimension: 'obstacle',
    questions: [
      '过去做类似任务时，最让你卡住的部分是什么？',
      '你预计在完成这个任务时会遇到什么困难？',
      '这个任务中哪部分让你感觉最不确定？',
    ],
    purpose: '识别潜在障碍'
  },
  {
    dimension: 'priority',
    questions: [
      '相比其他任务，这个任务的重要程度如何？',
      '为什么现在要做这个任务？',
      '如果这个任务延后会有什么影响？',
    ],
    purpose: '准备优先级判断'
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

  return `好的！在开始澄清「${task.title}」之前，我想了解一些背景信息：

${questionList}

💡 请在下方输入框中回答这些问题（可以自由描述，不需要严格按问题序号）`
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

    // 检查1：没有描述
    if (!task.description || task.description.trim().length === 0) {
      reasons.push('缺少描述')
    }

    // 检查2：标题很长（可能不够清晰）
    if (task.title.length > 20) {
      reasons.push('标题较长，可能需要澄清')
    }

    // 检查3：标记为困难
    if (task.tags?.includes('difficult')) {
      reasons.push('标记为困难任务')
    }

    // 检查4：描述很短但标记为重要
    if (task.tags?.includes('important') && (task.description?.length || 0) < 30) {
      reasons.push('重要任务但描述较简略')
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
 * 格式化推荐澄清任务列表为消息文本
 * @param recommendations 推荐列表
 * @returns 格式化后的消息文本
 */
export function formatRecommendationsMessage(
  recommendations: Array<{ task: Task; reason: string }>
): string {
  if (recommendations.length === 0) {
    return '你的任务都比较清晰，暂时没有特别需要澄清的。\n\n不过如果你想对某个任务有更深入的理解，也可以选择下方的任务进行澄清。'
  }

  const topRecommendations = recommendations.slice(0, 3)
  const suggestionList = topRecommendations
    .map((rec, i) => `${i + 1}. **${rec.task.title}** - ${rec.reason}`)
    .join('\n')

  return `根据你的任务情况，我建议优先澄清以下任务：

${suggestionList}

选择一个任务，我会问你几个问题来帮你更好地理解它。`
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
      reasons.push('缺少时间预估')
    }

    // 检查2：标记为困难（通常需要更准确的时间估计）
    if (task.tags?.includes('difficult')) {
      reasons.push('困难任务需要准确估时')
    }

    // 检查3：有多个子任务的父任务
    if (task.subtasks && task.subtasks.length > 0) {
      reasons.push(`包含${task.subtasks.length}个子任务`)
    }

    // 检查4：标题很长或描述复杂（可能任务复杂）
    if (task.title.length > 20 || (task.description?.length || 0) > 100) {
      reasons.push('任务较复杂')
    }

    // 检查5：有明确截止时间但没有时间估计（需要规划）
    if (task.deadline_datetime && !task.estimated_duration) {
      reasons.push('有截止时间需要规划')
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
    return '你的任务都已经有时间预估了！👍\n\n不过如果你想重新评估某个任务的时间，也可以在下方选择。'
  }

  const topRecommendations = recommendations.slice(0, 3)
  const suggestionList = topRecommendations
    .map((rec, i) => `${i + 1}. **${rec.task.title}** - ${rec.reason}`)
    .join('\n')

  return `根据你的任务情况，我建议优先估算以下任务的时间：

${suggestionList}

选择一个任务，我会帮你评估它需要多长时间。`
}

