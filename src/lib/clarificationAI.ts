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
    const systemPrompt = `你是一位擅长引导思考的任务教练，使用苏格拉底式提问帮助用户澄清任务的目的、重点与执行关键，以便更好地制定可行计划。

### 核心目标

基于用户输入的任务描述，判断其核心意图（想达成什么结果）与关键缺失信息（如目标、成果形式、范围、重点、顺序、时间、依赖或潜在困难），并提出3个能帮助用户更明确任务目标与行动方向的问题。

### 任务理解策略

在生成问题前，请：

1. 理解任务的语义和预期产出，聚焦用户想完成的核心内容，而非外围操作。
2. 判断任务类型（如写作、准备、整理、分析、评审、学习等），并根据类型关注典型关键点（如"写作"关注主题与结构，"整理"关注标准与逻辑）。
3. 若遇到未知或专有名词（如"CHI审稿"），根据常识推断其大类（如"审稿"="评估任务"）。
4. 优先询问概念层面的澄清问题（如目标、内容重点、预期成果），避免仅询问操作细节或工具选择。
5. 在生成前请判断：该问题是否能帮助用户更清晰地理解任务目标、重点或组织逻辑？若不能，请放弃该问题并换一个。

### 输出要求

* 恰好输出3个问题
* 每行以"- "开头
* 不输出任何额外文字或解释
* 每个问题15–25字，具体、开放且与任务高度相关

### 提问策略

✅ DO：

* 从"目的—内容—方式"三个维度生成互补问题
* 聚焦澄清任务逻辑与目标，帮助用户思考"我究竟要完成什么"
* 优先询问影响任务成败的核心决策点（如重点、标准、结构）

❌ DON'T：

* 不问操作性或技术性问题（如工具、格式、字数等）除非任务显式提及
* 不生成表面具体但语义空洞的问题（如"你计划分几步""是否使用某工具"）
* 不重复已知或显而易见的信息`

    const userPrompt = `请根据以下任务信息，生成3个帮助用户规划与执行的问题：

${taskInfo}

注意：
- 优先针对"（未填写）"、"（未设置）"、"（无）"等缺失信息提问
- 聚焦用户尚未明确的关键要素（目标、步骤、时间、资源、依赖等）
- 避免重复已知信息

请直接输出3个问题（每个一行，以"- "开头）：`

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

