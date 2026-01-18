/**
 * 每日反思 - 个性化问题生成服务
 * 
 * 功能说明：
 * - 结合用户今日任务列表，生成个性化的反思问题
 * - 参考今天的反思总结（如果有，比如中断恢复场景）
 * - 保持5个问题方向，但表达方式个性化
 * - AI失败时静默降级到通用问题
 */

import { logger } from '@/utils/logger'
import type { DailyTask } from '@/types/daily-task'
import type { DailyReflection } from '@/types/daily-reflection'
import type { ReflectionSession } from '@/types/reflection'
import { DAILY_REFLECTION_QUESTIONS } from '@/types/daily-reflection'
import { MODEL_CONFIG } from '@/lib/config/modelConfig'

// 使用统一的反思模型配置
const DEEPSEEK_CONFIG = MODEL_CONFIG.reflection

/**
 * AI生成超时时间（毫秒）
 * 🔧 优化：设置为15秒，平衡用户等待体验和生成成功率
 */
const AI_TIMEOUT = 15000

/**
 * AI重试次数
 * 🔧 失败后会重试，提高成功率
 */
const MAX_RETRIES = 2

/**
 * 5个问题方向（与原问题池对应）
 */
const QUESTION_DIRECTIONS = [
  { direction: '任务进展', description: '询问任务完成情况和进展' },
  { direction: '偏差分析', description: '询问任务是否按预期进行，有无偏差' },
  { direction: '意外情况', description: '询问是否遇到意外或惊喜' },
  { direction: '有效方法', description: '询问什么工具、方法或帮助最有效' },
  { direction: '状态感知', description: '询问当前精力和情绪状态' }
] as const

/**
 * 获取 API Key
 */
function getApiKey(): string | null {
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
  return apiKey || null
}

/**
 * 构建任务上下文描述
 */
function buildTaskContext(tasks: DailyTask[]): string {
  if (tasks.length === 0) {
    return '用户今天暂无任务记录。'
  }

  const completedTasks = tasks.filter(t => t.completed)
  const pendingTasks = tasks.filter(t => !t.completed)

  let context = `用户今天共有 ${tasks.length} 个任务：\n`

  if (completedTasks.length > 0) {
    context += `\n【已完成的任务】\n`
    completedTasks.forEach((t, i) => {
      context += `${i + 1}. ${t.title}`
      if (t.estimatedDuration) {
        context += `（预估${t.estimatedDuration}分钟）`
      }
      context += '\n'
    })
  }

  if (pendingTasks.length > 0) {
    context += `\n【未完成的任务】\n`
    pendingTasks.forEach((t, i) => {
      context += `${i + 1}. ${t.title}`
      if (t.estimatedDuration) {
        context += `（预估${t.estimatedDuration}分钟）`
      }
      if (t.deadlineDatetime) {
        const deadline = new Date(t.deadlineDatetime)
        context += `（截止：${deadline.getMonth() + 1}月${deadline.getDate()}日 ${deadline.getHours()}:${String(deadline.getMinutes()).padStart(2, '0')}）`
      }
      context += '\n'
    })
  }

  return context
}

/**
 * 构建今日每日反思上下文（如果有的话，比如中断恢复场景）
 */
function buildTodayDailyReflectionContext(todayReflection: DailyReflection | null): string {
  if (!todayReflection) {
    return ''
  }

  // 如果有AI总结，说明今天已经完成过反思
  if (todayReflection.ai_summary) {
    const summary = todayReflection.ai_summary.length > 100 
      ? todayReflection.ai_summary.substring(0, 100) + '...' 
      : todayReflection.ai_summary
    return `【今日每日反思总结】\n${summary}\n`
  }

  // 如果有部分回答（中断场景）
  const answers: string[] = []
  if (todayReflection.answer_1) answers.push(todayReflection.answer_1)
  if (todayReflection.answer_2) answers.push(todayReflection.answer_2)
  if (todayReflection.answer_3) answers.push(todayReflection.answer_3)

  if (answers.length > 0) {
    let context = `【今日每日反思（进行中）】\n用户已回答了${answers.length}个问题：\n`
    answers.forEach((a) => {
      const summary = a.length > 50 ? a.substring(0, 50) + '...' : a
      context += `- ${summary}\n`
    })
    return context
  }

  return ''
}

/**
 * 构建今日任务反思会话上下文（澄清、拆解、时间规划、优先级）
 */
function buildTaskReflectionContext(taskReflection: ReflectionSession | null): string {
  if (!taskReflection) {
    return ''
  }

  const parts: string[] = []

  // 总览摘要
  if (taskReflection.overviewSummary) {
    const summary = taskReflection.overviewSummary.length > 100
      ? taskReflection.overviewSummary.substring(0, 100) + '...'
      : taskReflection.overviewSummary
    parts.push(`总览：${summary}`)
  }

  // 四轮反思记录
  const roundsJson = taskReflection.roundsJson
  if (roundsJson) {
    // 澄清
    if (roundsJson.clarity?.status === 'completed' && roundsJson.clarity.userResponses?.length > 0) {
      const response = roundsJson.clarity.userResponses.join(' ').substring(0, 80)
      parts.push(`任务澄清：${response}${response.length >= 80 ? '...' : ''}`)
    }

    // 拆解
    if (roundsJson.decomposition?.status === 'completed' && roundsJson.decomposition.userResponses?.length > 0) {
      const response = roundsJson.decomposition.userResponses.join(' ').substring(0, 80)
      parts.push(`任务拆解：${response}${response.length >= 80 ? '...' : ''}`)
    }

    // 时间规划
    if (roundsJson.time?.status === 'completed' && roundsJson.time.userResponses?.length > 0) {
      const response = roundsJson.time.userResponses.join(' ').substring(0, 80)
      parts.push(`时间规划：${response}${response.length >= 80 ? '...' : ''}`)
    }

    // 优先级排列
    if (roundsJson.priority?.status === 'completed' && roundsJson.priority.userResponses?.length > 0) {
      const response = roundsJson.priority.userResponses.join(' ').substring(0, 80)
      parts.push(`优先级：${response}${response.length >= 80 ? '...' : ''}`)
    }
  }

  // 最终总结
  if (taskReflection.finalSummary) {
    const summary = taskReflection.finalSummary.length > 100
      ? taskReflection.finalSummary.substring(0, 100) + '...'
      : taskReflection.finalSummary
    parts.push(`最终总结：${summary}`)
  }

  if (parts.length === 0) {
    return ''
  }

  return `【今日任务反思记录】\n${parts.join('\n')}\n`
}

/**
 * 构建AI Prompt
 */
function buildPrompt(
  taskContext: string, 
  dailyReflectionContext: string,
  taskReflectionContext: string
): string {
  // 组合反思上下文
  const reflectionParts = [dailyReflectionContext, taskReflectionContext].filter(Boolean)
  const reflectionContext = reflectionParts.length > 0 
    ? reflectionParts.join('\n') 
    : '用户今天尚未进行任何反思。'

  return `你是一位专业的时间管理教练，正在为用户设计【高度个性化】的每日反思问题。

**⚠️ 核心要求**：
1. 【所有5个问题】都必须包含用户的【具体任务名称】（用「」包裹）
2. 问题必须是【开放式问题】，不能用"是否"、"有没有"、"是不是"这种只能回答Yes/No的问法

**用户今日任务信息**：
${taskContext}

${reflectionContext}

**任务要求**：
生成5个【高度个性化】且【开放式】的反思问题，每个问题都要提到用户的具体任务。

**🔴 关键规则（必须遵守）**：
1. 【所有5个问题】都必须直接引用用户任务的具体名称（用「」包裹）
2. ⚠️【重要】5个问题必须【分散覆盖多个不同任务】，不能只问同一个任务！
   - 如果用户有2个以上任务，至少覆盖2个不同任务
   - 如果用户有3个以上任务，至少覆盖3个不同任务
3. 【禁止】使用封闭式问法，如：
   ❌ "顺利吗？" "完成了吗？" "有没有遇到问题？" "是不是很累？"
4. 【必须】使用开放式问法，引导用户多说，如：
   ✅ "哪个环节最顺利？" "花了多少时间？" "遇到了什么挑战？" "感觉如何？"
5. 用"什么"、"哪个"、"怎么"、"多少"等疑问词开头

**5个方向（每个方向尽量问不同的任务）**：
方向1【任务进展】：选一个任务，问进展细节（哪个环节、做到哪一步、有什么收获）
方向2【时间体验】：选另一个任务，问时间感受（花了多久、哪部分最耗时、节奏如何）
方向3【挑战困难】：选一个任务，问遇到了什么挑战或卡点
方向4【有效方法】：选另一个任务，问什么方法/工具最有帮助
方向5【状态感知】：选一个任务，问做这个任务时的精力和情绪感受

**语气要求**：
- 像朋友聊天一样自然、温暖、好奇
- 每个问题15-35字
- 引导思考和表达，不要说教

**输出格式**：
必须输出恰好5行，每行一个问题。不要有任何序号、标签或额外说明。

**示例**（假设用户有任务"写周报"、"学Python"和"健身"）：
「写周报」做到哪一步了？哪个部分写起来最顺手？
「学Python」花了多长时间？哪个知识点最难理解？
做「健身」时遇到的最大挑战是什么？
「写周报」时什么方法或工具对你帮助最大？
做完「学Python」后精力和心情怎么样？`
}

/**
 * 调用AI生成问题
 */
async function callAI(prompt: string): Promise<string[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('❌ API Key 未配置')
    throw new Error('API Key未配置')
  }

  const startTime = Date.now()
  console.log('📡 [personalizedReflectionAI] 发送请求:', {
    endpoint: DEEPSEEK_CONFIG.endpoint,
    model: DEEPSEEK_CONFIG.model,
    apiKeyPrefix: apiKey.substring(0, 8) + '...',  // 只显示前8位
    promptLength: prompt.length
  })

  const response = await fetch(DEEPSEEK_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,  // 稍高的温度增加多样性
      max_tokens: 500,
      thinking: {
        type: "disabled"  // 🔧 关键修复：关闭深度思考，避免响应时间过长导致超时
      }
    })
  })

  const elapsed = Date.now() - startTime
  console.log(`⏱️ [personalizedReflectionAI] 响应耗时: ${elapsed}ms, 状态: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'N/A')
    console.error('❌ AI 请求失败:', {
      status: response.status,
      statusText: response.statusText,
      errorBody: errorText.substring(0, 200)
    })
    throw new Error(`AI请求失败: ${response.status} - ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  console.log('📥 [personalizedReflectionAI] AI 响应:', {
    contentLength: content.length,
    totalElapsed: Date.now() - startTime + 'ms'
  })

  // 解析输出：按行分割，过滤空行，去除可能的序号前缀
  const questions = content
    .split('\n')
    .map((line: string) => {
      let cleaned = line.trim()
      // 去除常见的序号前缀，如 "1. ", "1、", "1）", "① " 等
      cleaned = cleaned.replace(/^(\d+[\.\、\)\）\s]|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/g, '')
      return cleaned.trim()
    })
    .filter((line: string) => line.length > 5 && line.length <= 100)  // 放宽长度限制

  console.log('📊 解析出的问题数量:', questions.length, '个')

  // 降低最低要求到3个，避免频繁降级
  if (questions.length < 3) {
    throw new Error(`AI返回问题数量不足: ${questions.length}`)
  }

  // 返回最多5个问题
  return questions.slice(0, 5)
}

/**
 * 🎯 生成个性化反思问题（主入口）
 * 
 * @param tasks - 今日任务列表
 * @param todayDailyReflection - 今天的每日反思记录（如果有）
 * @param todayTaskReflection - 今天的任务反思会话（澄清、拆解、时间、优先级）
 * @returns 5个个性化问题数组
 */
export async function generatePersonalizedQuestions(params: {
  tasks: DailyTask[]
  todayDailyReflection?: DailyReflection | null
  todayTaskReflection?: ReflectionSession | null
}): Promise<string[]> {
  const { tasks, todayDailyReflection = null, todayTaskReflection = null } = params

  // ⭐ 将上下文构建提前到 try 块外，避免 catch 块访问不到
  let taskContext = ''
  let dailyReflectionContext = ''
  let taskReflectionContext = ''

  // 🔧 重试逻辑
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt === 1) {
        logger.debug('开始生成个性化反思问题', {
          taskCount: tasks.length,
          hasDailyReflection: !!todayDailyReflection,
          hasTaskReflection: !!todayTaskReflection
        })

        // 🔍 输出详细的任务列表（便于排查数据隔离问题）
        console.log('📋 任务列表详情:', tasks.map(t => ({
          title: t.title,
          userId: t.userId,  // 检查任务的 userId 是否正确
          noteDate: t.noteDate
        })))

        // 构建上下文
        taskContext = buildTaskContext(tasks)
        dailyReflectionContext = buildTodayDailyReflectionContext(todayDailyReflection)
        taskReflectionContext = buildTaskReflectionContext(todayTaskReflection)

        // 🔍 输出上下文信息（便于调试）
        console.log('📋 构建任务上下文:', { 
          taskCount: tasks.length,
          taskContextLength: taskContext.length,
          hasTaskReflection: !!taskReflectionContext,
          taskReflectionLength: taskReflectionContext.length
        })
      } else {
        console.log(`🔄 第 ${attempt} 次重试生成个性化问题...`)
      }

      // 构建Prompt
      const prompt = buildPrompt(taskContext, dailyReflectionContext, taskReflectionContext)

      // 带超时的AI调用
      console.log(`🤖 开始调用 AI 生成个性化问题... (尝试 ${attempt}/${MAX_RETRIES})`)
      const questions = await Promise.race([
        callAI(prompt),
        new Promise<string[]>((_, reject) => 
          setTimeout(() => reject(new Error('AI超时')), AI_TIMEOUT)
        )
      ])

      console.log('✅ 个性化问题生成成功:', questions)
      logger.debug('个性化问题生成成功', { questions, attempt })
      return questions

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('未知错误')
      console.warn(`⚠️ 第 ${attempt} 次尝试失败:`, lastError.message)
      
      // 如果还有重试次数，继续重试
      if (attempt < MAX_RETRIES) {
        // 等待一小段时间后重试（避免立即重试）
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // 🔧 所有重试都失败后，才降级到通用问题
      logger.warn('个性化问题生成失败（已重试所有次数），使用通用问题', { 
        error: lastError.message,
        attempts: MAX_RETRIES
      })
      // 🔍 在控制台输出详细错误信息（便于调试）
      console.error(`❌ 个性化问题生成失败（已重试 ${MAX_RETRIES} 次），已降级到通用问题`)
      console.error('最后一次错误:', lastError)
      console.log('📋 任务上下文:', taskContext)
      console.log('🔑 API Key 状态:', getApiKey() ? '已配置' : '未配置')
      return [...DAILY_REFLECTION_QUESTIONS]
    }
  }

  // 理论上不会走到这里，但为了类型安全
  return [...DAILY_REFLECTION_QUESTIONS]
}

/**
 * 🎲 从5个问题中随机选择3个
 * 
 * @param questions - 5个问题的数组
 * @returns 3个问题的元组
 */
export function selectThreeQuestions(questions: string[]): [string, string, string] {
  if (questions.length < 3) {
    // 如果问题不足3个，用通用问题补充
    const fallback = [...DAILY_REFLECTION_QUESTIONS]
    while (questions.length < 5) {
      questions.push(fallback[questions.length])
    }
  }

  // Fisher-Yates 洗牌算法
  const indices = [0, 1, 2, 3, 4]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  // 取前3个
  return [
    questions[indices[0]],
    questions[indices[1]],
    questions[indices[2]]
  ]
}

