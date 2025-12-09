/**
 * 任务上下文问题生成模块
 * 用于在任务拆解前收集用户的背景信息
 */

import type { Task } from '@/types'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

/**
 * 根据任务动态生成2-3个背景信息问题（使用AI）
 * 用于任务拆解前收集用户的上下文信息
 */
export async function generateContextQuestions(task: Task): Promise<string[]> {
  try {
    // 构建任务信息
    const taskInfo = `任务标题：${task.title}${task.tags && task.tags.length > 0 ? `\n标签：${task.tags.join(', ')}` : ''}`
    
    const systemPrompt = `你是一位擅长引导用户提供任务背景信息的助手。你的目标是通过2-3个精准问题，帮助用户提供**任务拆解所需的关键背景信息**。

### 核心目标
通过2-3个问题，帮助用户提供能够帮助AI更好地拆解任务的背景信息：
- **任务的具体场景和目标**（这个任务是在什么背景下要做的？要达到什么目的？）
- **任务的关键约束和要求**（有哪些需要注意的限制或要求？）
- **任务的相关资源和依赖**（有哪些可用的资源？依赖什么条件？）

### 问题设计原则

✅ **应该问的**（拆解所需的背景信息）：
- **目标和场景**：这个任务是为了达成什么目标？在什么场景下使用？
- **关键约束**：有哪些时间、质量、资源等方面的限制？
- **相关信息**：有哪些相关的背景、资源、依赖条件？
- **特殊要求**：有没有特别需要注意的点？

❌ **不要问的**（避免过于宽泛或不相关）：
- 过于宽泛的问题（如"你有什么想法"）
- 是非题或封闭式问题
- 与拆解无关的情绪或动机问题

### 输出格式
- 直接输出2-3个问题
- 每行一个问题，不要编号
- 不要任何额外说明或文字
- 问题简洁、具体、开放式（10-25字）`

    const userPrompt = `请根据以下任务生成2-3个问题，帮助用户提供任务拆解所需的背景信息：

${taskInfo}

请直接输出2-3个问题：`

    // 调用豆包API
    const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
    if (!apiKey) {
      console.warn('NEXT_PUBLIC_DOUBAO_API_KEY not configured, using static questions')
      return generateStaticContextQuestions(task)
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
        temperature: 0.7,
        max_tokens: 120,
        thinking: { type: 'disabled' }
      }),
    })

    if (!response.ok) {
      console.error('Doubao API error:', response.status)
      return generateStaticContextQuestions(task)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析问题（每行一个）
    const questions = content
      .split('\n')
      .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((q: string) => q.length > 0 && q.length < 100)
      .slice(0, 3)
    
    if (questions.length === 0) {
      return generateStaticContextQuestions(task)
    }
    
    console.log('✅ 动态生成的问题:', questions)
    return questions
    
  } catch (error) {
    console.error('生成动态问题失败，使用静态问题:', error)
    return generateStaticContextQuestions(task)
  }
}

/**
 * 生成静态的上下文问题（作为 fallback）
 */
function generateStaticContextQuestions(task: Task): string[] {
  const questions: string[] = []
  
  // 基础问题（所有任务都问）
  questions.push('这个任务的最终目标是什么？你希望达到什么样的结果？')
  
  // 根据标签定制第二个问题
  if (task.tags?.includes('difficult')) {
    questions.push('你预计在完成这个任务时会遇到什么困难？')
  } else if (task.tags?.includes('important')) {
    questions.push('这个任务为什么重要？有哪些关键点需要注意？')
  } else if (task.tags?.includes('easy')) {
    questions.push('这个任务需要哪些准备工作？')
  } else {
    questions.push('你在完成这个任务时需要哪些资源或支持？')
  }
  
  // 第三个问题（通用）
  questions.push('有什么特殊的要求或时间限制吗？')
  
  return questions.slice(0, 3)
}

/**
 * 格式化问题列表为消息文本
 * 用于在聊天界面显示
 */
export function formatQuestionsMessage(task: Task, questions: string[]): string {
  return `好的！在开始拆解「${task.title}」之前，我想了解一些背景信息：

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
}



