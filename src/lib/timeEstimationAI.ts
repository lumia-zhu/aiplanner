/**
 * 时间估计AI服务
 * 用于生成个性化的时间估计反思问题
 */

import type { Task } from '@/types'
import { formatMinutes } from '@/utils/timeEstimation'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

// ⭐ 扩展的用户画像（用于时间估算）
// 注意：这里使用自己的接口，因为全局UserProfile不包含这些字段
interface EstimationUserProfile {
  taskHistory?: {
    totalCompleted: number        // 历史完成任务数
    averageEstimateAccuracy: number // 平均估计准确度（实际耗时/估计耗时）
    overestimateRate: number       // 高估比例（估计>实际）
    underestimateRate: number      // 低估比例（估计<实际）
  }
  preferences?: {
    worksWellUnderPressure: boolean  // 是否在压力下工作更好
    prefersBufferTime: boolean       // 是否偏好缓冲时间
  }
}

// 任务特征接口
interface TaskFeatures {
  hasDeadline: boolean
  isUrgent: boolean
  isDifficult: boolean
  isImportant: boolean
  hasDescription: boolean
  descriptionLength: number
  estimatedComplexity: 'low' | 'medium' | 'high'
}

/**
 * 提取任务特征
 */
function extractTaskFeatures(task: Task): TaskFeatures {
  const hasDeadline = !!task.deadline_datetime
  const isUrgent = task.tags?.includes('urgent') || false
  const isDifficult = task.tags?.includes('difficult') || false
  const isImportant = task.tags?.includes('important') || false
  const hasDescription = !!task.description && task.description.trim().length > 0
  const descriptionLength = task.description?.length || 0
  
  // 估算复杂度（基于标签和描述长度）
  let estimatedComplexity: 'low' | 'medium' | 'high' = 'medium'
  if (isDifficult || descriptionLength > 200) {
    estimatedComplexity = 'high'
  } else if (task.tags?.includes('easy') || descriptionLength < 50) {
    estimatedComplexity = 'low'
  }
  
  return {
    hasDeadline,
    isUrgent,
    isDifficult,
    isImportant,
    hasDescription,
    descriptionLength,
    estimatedComplexity
  }
}

/**
 * 构建用户上下文描述
 */
function buildUserContextDescription(userProfile: EstimationUserProfile): string {
  const parts: string[] = []
  
  if (userProfile.taskHistory) {
    const { averageEstimateAccuracy, overestimateRate, underestimateRate } = userProfile.taskHistory
    
    if (averageEstimateAccuracy > 1.2) {
      parts.push('用户倾向于高估任务时间（通常提前完成）')
    } else if (averageEstimateAccuracy < 0.8) {
      parts.push('用户倾向于低估任务时间（经常超时）')
    }
    
    if (underestimateRate > 0.6) {
      parts.push('经常低估任务复杂度')
    }
  }
  
  if (userProfile.preferences) {
    if (userProfile.preferences.worksWellUnderPressure) {
      parts.push('在适度压力下工作效率更高')
    }
    if (userProfile.preferences.prefersBufferTime) {
      parts.push('偏好留有缓冲时间')
    }
  }
  
  return parts.length > 0 ? parts.join('；') : '新用户，暂无历史数据'
}

/**
 * 生成个性化反思问题（AI驱动）
 * @param params 参数对象
 * @returns 反思问题文本
 */
export async function generateReflectionQuestion(params: {
  task: Task
  userProfile: EstimationUserProfile
  initialEstimate: number
}): Promise<string> {
  const { task, userProfile, initialEstimate } = params
  const features = extractTaskFeatures(task)
  const userContext = buildUserContextDescription(userProfile)
  
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
  if (!apiKey) {
    console.warn('⚠️ Doubao API Key未配置，使用规则反思')
    return getRuleBasedReflection(task, features, initialEstimate)
  }
  
  // 构建AI Prompt
  const systemPrompt = `你是一位专业的时间管理教练，擅长帮助用户更准确地估算任务时间。

你的任务是：
1. 基于用户的历史行为模式和当前任务特征
2. 生成一个简短（1-2句话）的反思性问题
3. 帮助用户重新审视自己的时间估计

**反思问题的原则：**
- 使用苏格拉底式提问，引导而不是说教
- 结合用户的历史估算偏差（如果有）
- 关注任务的隐藏复杂度（如依赖、不确定性）
- 语气友好、鼓励性
- 1-2句话，不超过50字

**输出格式：**
只返回反思问题文本，不要加任何额外说明。`

  const userMessage = `**任务信息：**
- 标题：${task.title}
- 描述：${task.description || '无'}
- 标签：${task.tags?.join('、') || '无'}
- 截止时间：${task.deadline_datetime ? new Date(task.deadline_datetime).toLocaleString('zh-CN') : '无'}

**任务特征：**
- 复杂度：${features.estimatedComplexity}
- 是否困难：${features.isDifficult ? '是' : '否'}
- 是否紧急：${features.isUrgent ? '是' : '否'}

**用户画像：**
${userContext}

**用户的初始时间估计：**
${formatMinutes(initialEstimate)}

请生成一个反思性问题，帮助用户重新审视这个估计。`

  try {
    const response = await fetch(DOUBAO_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DOUBAO_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 150,
        enable_thinking: false, // 禁用深度思考，加快响应
      }),
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }

    const data = await response.json()
    
    // 提取文本内容
    let text = ''
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      text = content
    } else if (Array.isArray(content)) {
      const textContent = content.find((c: any) => c.type === 'text')
      text = textContent?.text || ''
    }
    
    if (text && text.trim().length > 0) {
      return text.trim()
    } else {
      throw new Error('AI返回内容为空')
    }
  } catch (error) {
    console.error('❌ AI反思问题生成失败:', error)
    // 降级到规则反思
    return getRuleBasedReflection(task, features, initialEstimate)
  }
}

/**
 * 规则基础的反思问题生成（降级方案）
 */
function getRuleBasedReflection(
  task: Task,
  features: TaskFeatures,
  initialEstimate: number
): string {
  // 根据任务特征和估计时间，选择合适的反思问题
  
  // 1. 如果任务标记为困难，但估计时间很短
  if (features.isDifficult && initialEstimate < 60) {
    return '这个任务被标记为"困难"，你确定半小时左右就能完成吗？有没有什么隐藏的复杂环节？'
  }
  
  // 2. 如果任务很紧急，且时间较短
  if (features.isUrgent && initialEstimate < 45) {
    return '紧急任务往往会有意外情况，你的估计是否考虑了可能的打断和切换成本？'
  }
  
  // 3. 如果任务没有描述，且估计时间较长
  if (!features.hasDescription && initialEstimate > 90) {
    return '这个任务没有详细描述，你是否已经充分了解了需要做什么？会不会低估了前期准备时间？'
  }
  
  // 4. 如果任务复杂度高
  if (features.estimatedComplexity === 'high') {
    return '对于复杂任务，通常会有一些意想不到的细节。你的估计是否考虑了调试、测试或返工的时间？'
  }
  
  // 5. 如果估计时间很长（超过3小时）
  if (initialEstimate > 180) {
    return '这个任务比较长，你是否考虑过中途可能需要休息、查资料，或者遇到卡点？'
  }
  
  // 6. 如果估计时间很短（小于30分钟）
  if (initialEstimate < 30) {
    return '快速任务也可能因为准备工作或上下文切换花费更多时间，你确定这个估计吗？'
  }
  
  // 7. 默认通用反思
  return '再想一想，这个任务是否有一些隐藏的步骤或依赖？实际执行时可能会遇到什么意外？'
}

/**
 * 构建一个简单的用户画像（从历史任务中提取）
 * 这个函数可以后续扩展，从实际的任务历史数据中计算
 */
export function buildUserProfile(tasks: Task[]): EstimationUserProfile {
  // TODO: 后续可以根据实际的任务完成数据来计算
  // 目前返回一个默认的用户画像
  return {
    taskHistory: {
      totalCompleted: tasks.filter(t => t.is_completed).length,
      averageEstimateAccuracy: 1.0,
      overestimateRate: 0.5,
      underestimateRate: 0.5,
    },
    preferences: {
      worksWellUnderPressure: false,
      prefersBufferTime: true,
    }
  }
}

