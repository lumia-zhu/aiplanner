/**
 * 任务拆解AI服务
 * 用于根据任务内容动态生成拆解引导问题
 */

import type { Task } from '@/types'
import { generateContextQuestions } from './contextQuestions'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

/**
 * 根据任务内容动态生成3个任务拆解引导问题
 * @param task 需要拆解的任务
 * @returns 3个问题的数组
 */
export async function generateDynamicDecompositionQuestions(task: Task): Promise<string[]> {
  try {
    // 构建任务信息描述
    const taskInfo = buildTaskInfoDescription(task)
    
    // 构建AI prompt
    const systemPrompt = `你是一位擅长任务管理和项目规划的助手，使用苏格拉底式提问法帮助用户将复杂任务拆解为可执行的子任务。

核心原则：
1. 仔细分析任务信息，识别**拆解的关键维度**（步骤、资源、依赖、时间）
2. 生成恰好3个简短的苏格拉底式问题，引导用户思考如何拆解任务
3. 问题必须一次性全部输出（3个问题）

问题设计标准：
✅ DO（应该）：
- 开放式提问，引导用户思考执行步骤和顺序
- 聚焦于任务拆解的核心要素：
  * 任务的核心步骤/阶段是什么？
  * 需要哪些前置条件或资源？
  * 哪些部分可以并行？哪些必须串行？
  * 每个步骤大概需要多久？
  * 可能的困难点或风险在哪里？
- 根据任务复杂度调整问题深度
- 简洁友好，每个问题15-30字
- 让用户自然地思考任务的分解方式

❌ DON'T（避免）：
- 封闭式问题（能用"是/否"回答）
- 过于抽象或哲学化的问题
- 直接给出拆解方案（而不是引导思考）
- 使用专业术语或复杂表达

示例（仅供参考风格）：
任务：准备年度总结报告
- 这份报告需要包含哪几个核心部分？每部分的重点是什么？
- 哪些数据或资料需要提前收集？需要找谁协助？
- 你打算如何安排时间？哪部分最耗时？

输出格式（严格遵守）：
- 必须恰好3个问题
- 每个问题独立一行，以"- "开头
- 不要添加任何额外解释、编号、标题或分隔符
- 一次性全部输出，格式如下：
- 第一个问题？
- 第二个问题？
- 第三个问题？`

    const userPrompt = `请根据以下任务信息，生成3个帮助拆解任务的苏格拉底式问题：

${taskInfo}

注意：
1. 问题应该引导用户思考"如何分解"这个任务，而不是询问任务本身的信息
2. 根据任务的复杂度和描述，提出最有价值的拆解引导问题
3. 必须一次性输出全部3个问题

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
        max_tokens: 200, // 3个问题，每个约30字，稍微多一点buffer
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
    console.error('AI拆解问题生成失败，使用降级方案:', error)
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
    const totalMinutes = task.estimated_duration % 10000 // 去除buffer标记
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    let durationStr = ''
    if (hours > 0) durationStr += `${hours}小时`
    if (minutes > 0) durationStr += `${minutes}分钟`
    parts.push(`预估时长：${durationStr || '未知'}`)
  } else {
    parts.push(`预估时长：（未设置）`)
  }
  
  // 5. 标签/复杂度提示
  if (task.tags && task.tags.length > 0) {
    const complexityTags = task.tags.filter(tag => 
      ['difficult', 'easy', 'important', 'urgent'].includes(tag)
    )
    if (complexityTags.length > 0) {
      parts.push(`任务特点：${complexityTags.join('、')}`)
    }
  }
  
  // 6. 已有子任务提示
  if (task.subtasks && task.subtasks.length > 0) {
    parts.push(`备注：用户已创建了${task.subtasks.length}个子任务，可能需要进一步优化`)
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
export function formatDynamicDecompositionMessage(task: Task, questions: string[]): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n\n')

  return `好的！在开始拆解「${task.title}」之前，我想了解一些背景信息：

${questionList}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
}

/**
 * 生成任务拆解问题（带降级方案）
 * 优先使用AI动态生成，失败时回退到规则模板
 * @param task 需要拆解的任务
 * @returns 问题数组和消息文本
 */
export async function generateDecompositionQuestionsWithFallback(task: Task): Promise<{
  questions: string[]
  message: string
  isAIGenerated: boolean
}> {
  try {
    // 尝试使用AI生成
    const aiQuestions = await generateDynamicDecompositionQuestions(task)
    const aiMessage = formatDynamicDecompositionMessage(task, aiQuestions)
    
    return {
      questions: aiQuestions,
      message: aiMessage,
      isAIGenerated: true
    }
  } catch (error) {
    console.warn('AI拆解问题生成失败，使用规则模板降级方案')
    
    // 降级到规则模板
    const ruleBasedQuestions = generateContextQuestions(task)
    const ruleBasedMessage = `好的！在开始拆解「${task.title}」之前，我想了解一些背景信息：

${ruleBasedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
    
    return {
      questions: ruleBasedQuestions,
      message: ruleBasedMessage,
      isAIGenerated: false
    }
  }
}

