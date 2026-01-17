/**
 * 任务澄清AI服务
 * 用于根据任务内容动态生成苏格拉底式问题
 */

import type { Task } from '@/types'
import { generateClarificationQuestions } from './clarificationQuestions'
import { MODEL_CONFIG } from '@/lib/config/modelConfig'

// 使用统一的反思模型配置（任务澄清需要较强的理解能力）
const DOUBAO_CONFIG = MODEL_CONFIG.reflection

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
    const systemPrompt = `你是一位擅长任务反思的教练，通过提问帮助用户**澄清任务本身**，使模糊的任务变得清晰、可执行。

### 核心目标

通过 1-3 个精准问题，帮助用户从以下**三个核心方面**理解任务：

1. **任务目标与完成标准** (Task Awareness)
   - 这个任务的目标是什么？
   - 做到什么程度算完成？
   - 预期的成果/产出是什么样的？

2. **前置条件与资源需求** (Task Awareness + Strategy Awareness)
   - 完成这个任务需要什么前提条件？
   - 依赖哪些人或资源？
   - 需要等待什么/获得什么许可？

3. **具体要求、时间节点、里程碑** (Task Awareness)
   - 有哪些具体的规格要求或标准？
   - 关键的截止日期或时间限制是什么？
   - 有没有阶段性的里程碑？

### 【问题生成策略】

**灵活调整，按需提问**：
- 根据任务的具体情况，**某个方面可能问多个问题，某个方面可能完全不问**
- 如果任务已经提供了某方面的信息（如已有明确deadline），就不要再问这方面
- 如果任务在某方面特别模糊（如目标不清），可以在这方面多问1-2个问题
- 总共生成 1-3 个问题，不强制每个方面都必须问到

**优先级判断**：
1. 如果任务目标不清晰 → 优先问**目标与完成标准**
2. 如果任务依赖不明确 → 优先问**前置条件与资源**
3. 如果任务要求模糊 → 优先问**具体要求与时间节点**

### 【问题设计原则】

✅ **好的问题特征**：
- 开放式，引导用户详细思考和回答
- 聚焦任务本身的定义，而非执行步骤
- 简洁清晰（15-25字），一问一事
- 帮助用户理解"要完成什么"，而非"怎么做"
- 温和、鼓励、非评判性语气

❌ **避免的问题类型**：
- 执行步骤类（"先做什么后做什么""分几步完成"）
- 工具材料类（"用什么软件""需要哪些参考书"）→ 除非是关键依赖
- 是/否题、情绪题（"难吗""有信心吗"）
- 显而易见的问题（受众、对象明显时不要问）

### 【示例】

**任务：准备 Qualify Exam**

✅ **好的问题**（聚焦三个核心方面）：
- Qualify Exam 主要考核哪些领域或科目？（目标）
- 你希望通过这次考试达到什么水平？（完成标准）
- 有没有指定的考试大纲或重点范围？（具体要求）

❌ **不好的问题**：
- 考试的受众是谁？（显而易见，是评审委员会）
- 你需要准备哪些复习资料？（执行细节）
- 你打算从哪个科目开始复习？（执行步骤）

**任务：修改论文第三章**

✅ **好的问题**（灵活调整，重点突出）：
- 这次修改的核心目标是什么（内容补充/逻辑优化/格式调整）？（目标）
- 修改需要基于谁的反馈或建议？（前置条件）
- 有具体的修改截止时间吗？（时间节点）

### 【输出格式】（严格遵守）

- 仅输出 1-3 个问题（根据任务情况灵活决定）
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本`

    const userPrompt = `请根据以下任务信息，生成 1-3 个帮助用户**澄清任务**的问题：

${taskInfo}

**分析步骤**（内部执行，不要输出）：

1️⃣ **判断任务在三个核心方面的明确程度**
   
   方面1：任务目标与完成标准
   - 任务目标是否清晰？
   - 完成标准是否明确？
   - 如果不清晰 → 优先问这方面

   方面2：前置条件与资源需求
   - 是否依赖其他人或资源？
   - 是否需要等待某些前提条件？
   - 如果有依赖不明确 → 考虑问这方面

   方面3：具体要求、时间节点、里程碑
   - 是否有具体的规格要求或标准？
   - 是否有明确的时间限制或里程碑？
   - 如果要求模糊 → 考虑问这方面

2️⃣ **选择最需要澄清的方面**
   - 某个方面可能问多个问题，某个方面可能完全不问
   - 如果任务已经明确说明了某方面（如已有deadline），就不要再问
   - 总共生成 1-3 个问题

3️⃣ **质量自检**
   ✓ 问题是否聚焦任务定义本身（而非执行步骤）？
   ✓ 是否避免了显而易见的问题？
   ✓ 是否都是开放式问题？
   ✓ 语言是否简洁友好（15-25字）？

请直接输出 1-3 个问题（每行以"- "开头，不要任何额外文字）：`

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
        max_tokens: 200, // 1-3个问题，每个约25字
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
    if (questions.length < 1 || questions.length > 3) {
      throw new Error(`Expected 1-3 questions, got ${questions.length}`)
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

