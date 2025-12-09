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
2. 生成恰好3个简短的反思性问题（必须是3个独立的问题）
3. 帮助用户从不同角度重新审视自己的时间估计

**反思问题的原则：**
- 使用苏格拉底式提问，引导而不是说教
- 必须是3个独立的问题，从不同维度切入：
  维度1：隐藏步骤和前置工作
  维度2：意外情况和阻塞风险
  维度3：依赖资源和后续工作
- 每个问题简短（不超过25字）
- 语气友好、鼓励性

**严格的输出格式要求：**
必须输出恰好3行，每行一个问题，以"• "开头。
不要有任何其他文字、解释或说明。

例如：
• 这个任务包含准备和收尾工作的时间吗？
• 如果遇到技术问题需要查资料，会多花多久？
• 有没有需要等待他人回复的环节？`

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
        stream: false,
        temperature: 0.7,
        max_tokens: 100,  // 减少token数量，3个问题足够了
        thinking: {
          type: "disabled"  // 关闭深度思考以提高响应速度
        }
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
 * 返回3个反思问题
 */
function getRuleBasedReflection(
  task: Task,
  features: TaskFeatures,
  initialEstimate: number
): string {
  const questions: string[] = []
  
  // 第1个问题：基于任务特征
  if (features.isDifficult && initialEstimate < 60) {
    questions.push('这个任务被标记为"困难"，半小时够吗？')
  } else if (features.isUrgent && initialEstimate < 45) {
    questions.push('紧急任务常有意外，考虑打断和切换成本了吗？')
  } else if (!features.hasDescription && initialEstimate > 90) {
    questions.push('任务描述不详细，是否充分了解要做什么？')
  } else if (features.estimatedComplexity === 'high') {
    questions.push('复杂任务常有意外细节，考虑调试和返工时间了吗？')
  } else if (initialEstimate > 180) {
    questions.push('任务较长，考虑中途休息和查资料的时间了吗？')
  } else if (initialEstimate < 30) {
    questions.push('快速任务也需要准备和切换，确定这个估计吗？')
  } else {
    questions.push('这个任务有没有隐藏的步骤或前置工作？')
  }
  
  // 第2个问题：关于意外和阻塞
  if (features.hasDeadline && features.isUrgent) {
    questions.push('如果遇到技术难点或需要请教他人，会多花多久？')
  } else if (features.isDifficult) {
    questions.push('遇到卡点时，调试和解决问题需要多少时间？')
  } else {
    questions.push('如果需要查资料或学习新知识，会额外花多久？')
  }
  
  // 第3个问题：关于依赖和资源
  if (features.hasDescription && task.description!.length > 50) {
    questions.push('有没有需要等待他人反馈或审批的环节？')
  } else if (features.isImportant) {
    questions.push('需要准备哪些资料或工具？这部分时间考虑了吗？')
  } else {
    questions.push('任务完成后的检查和收尾工作需要多久？')
  }
  
  // 用项目符号格式化，让3个问题更清晰
  return questions.map(q => `• ${q}`).join('\n')
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

