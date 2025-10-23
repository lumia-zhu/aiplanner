/**
 * 任务澄清AI服务
 * 用于根据任务内容动态生成苏格拉底式问题
 */

import type { Task } from '@/types'
import { generateClarificationQuestions } from './clarificationQuestions'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

/**
 * 根据任务内容动态生成3个苏格拉底式问题
 * @param task 需要澄清的任务
 * @returns 3个问题的数组
 */
export async function generateDynamicClarificationQuestions(task: Task): Promise<string[]> {
  try {
    // 构建任务信息描述
    const taskInfo = buildTaskInfoDescription(task)
    
    // 构建AI prompt
    const systemPrompt = `你是一位擅长引导思考的助手，使用苏格拉底式提问法帮助用户澄清和完善任务。

核心原则：
1. 仔细分析任务信息，识别**最关键的缺失或不明确部分**
2. 生成恰好3个简短的问题，帮助用户形成清晰的执行计划

问题设计标准：
✅ DO（应该）：
- 聚焦任务规划和执行：目标产出、关键步骤、资源依赖、时间估算、潜在风险
- 开放式提问，引导用户反思和补充具体信息
- 根据已有信息**避免重复提问**（例如已有截止时间就不问时间）
- 简洁实用，每个问题15-25字
- 帮助用户明确"做什么"、"怎么做"、"需要什么"

❌ DON'T（避免）：
- 封闭式问题（能用"是/否"回答）
- 询问主观感受或情绪（如"你紧张吗"）
- 过于宽泛或抽象的问题
- 询问已经提供的信息

示例（仅供参考风格）：
任务：准备项目汇报PPT
- 这个PPT完成后，你期待呈现哪些核心内容？
- 你打算分几个部分来制作？每部分大概需要多久？
- 制作过程中需要哪些数据或资料支持？

输出格式（严格遵守）：
- 必须恰好3个问题
- 每个问题独立一行，以"- "开头
- 不要添加任何额外解释、编号、标题或分隔符
- 直接输出问题，格式如下：
- 第一个问题？
- 第二个问题？
- 第三个问题？`

    const userPrompt = `请根据以下任务信息，生成3个最有价值的苏格拉底式问题：

${taskInfo}

注意：请优先针对"（未填写）"、"（未设置）"、"（无）"等缺失信息提问。

请生成3个问题：`

    // 调用豆包API
    const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_DOUBAO_API_KEY not configured')
    }

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7, // 稍高的温度，增加创造性
        max_tokens: 150, // 3个问题，每个约25字
        thinking: { type: 'disabled' } // 关闭深度思考，提升响应速度
      }),
    })

    if (!response.ok) {
      throw new Error(`Doubao API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析AI返回的问题
    const questions = parseQuestionsFromResponse(content)
    
    // 如果解析失败或问题数量不对，抛出错误触发降级
    if (questions.length !== 3) {
      throw new Error(`Expected 3 questions, got ${questions.length}`)
    }
    
    return questions
    
  } catch (error) {
    console.error('AI问题生成失败，使用降级方案:', error)
    // 抛出错误，由调用方决定是否使用降级方案
    throw error
  }
}

/**
 * 构建任务信息描述（传递给AI）
 */
function buildTaskInfoDescription(task: Task): string {
  const parts: string[] = []
  
  // 1. 任务标题
  parts.push(`任务标题：${task.title}`)
  
  // 2. 任务描述
  if (task.description && task.description.trim().length > 0) {
    parts.push(`任务描述：${task.description}`)
  } else {
    parts.push(`任务描述：（未填写）`)
  }
  
  // 3. 截止时间
  if (task.deadline_datetime) {
    const deadline = new Date(task.deadline_datetime)
    const deadlineStr = deadline.toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    })
    parts.push(`截止时间：${deadlineStr}`)
  } else {
    parts.push(`截止时间：（未设置）`)
  }
  
  // 4. 预估时长
  if (task.estimated_duration) {
    // estimated_duration 现在是数字（分钟）
    const hours = Math.floor(task.estimated_duration / 60)
    const minutes = task.estimated_duration % 60
    let durationStr = ''
    if (hours > 0) durationStr += `${hours}小时`
    if (minutes > 0) durationStr += `${minutes}分钟`
    parts.push(`预估时长：${durationStr || '未知'}`)
  } else {
    parts.push(`预估时长：（未设置）`)
  }
  
  // 5. 标签/优先级
  if (task.tags && task.tags.length > 0) {
    parts.push(`标签：${task.tags.join('、')}`)
  } else {
    parts.push(`标签：（无）`)
  }
  
  // 6. 子任务数量
  if (task.subtasks && task.subtasks.length > 0) {
    parts.push(`已有${task.subtasks.length}个子任务`)
  }
  
  return parts.join('\n')
}

/**
 * 从AI响应中解析问题列表
 */
function parseQuestionsFromResponse(content: string): string[] {
  const questions: string[] = []
  
  // 按行分割
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  for (const line of lines) {
    // 匹配以 "- " 开头的行
    if (line.startsWith('- ')) {
      const question = line.substring(2).trim()
      if (question.length > 0) {
        questions.push(question)
      }
    }
    // 也兼容其他可能的格式：数字编号
    else if (/^\d+[\.)、]/.test(line)) {
      const question = line.replace(/^\d+[\.)、]\s*/, '').trim()
      if (question.length > 0) {
        questions.push(question)
      }
    }
  }
  
  return questions
}

/**
 * 格式化AI生成的问题为消息文本
 * @param task 任务
 * @param questions 问题数组
 * @returns 格式化后的消息文本
 */
export function formatDynamicQuestionsMessage(task: Task, questions: string[]): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n\n')

  return `好的！在开始澄清「${task.title}」之前，我想了解一些背景信息：

${questionList}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
}

/**
 * 生成任务澄清问题（带降级方案）
 * 优先使用AI动态生成，失败时回退到规则模板
 * @param task 需要澄清的任务
 * @returns 问题数组和消息文本
 */
export async function generateClarificationQuestionsWithFallback(task: Task): Promise<{
  questions: string[]
  message: string
  isAIGenerated: boolean
}> {
  try {
    // 尝试使用AI生成
    const aiQuestions = await generateDynamicClarificationQuestions(task)
    const aiMessage = formatDynamicQuestionsMessage(task, aiQuestions)
    
    return {
      questions: aiQuestions,
      message: aiMessage,
      isAIGenerated: true
    }
  } catch (error) {
    console.warn('AI问题生成失败，使用规则模板降级方案')
    
    // 降级到规则模板
    const ruleBasedQuestions = generateClarificationQuestions(task)
    const ruleBasedMessage = `好的！在开始澄清「${task.title}」之前，我想了解一些背景信息：

${ruleBasedQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n\n')}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
    
    return {
      questions: ruleBasedQuestions.map(q => q.question),
      message: ruleBasedMessage,
      isAIGenerated: false
    }
  }
}

