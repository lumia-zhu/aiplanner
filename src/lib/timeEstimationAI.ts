/**
 * 时间估计AI服务
 * 用于生成个性化的时间估计反思问题
 * 
 * 核心原则：纯聚焦时间判断，不涉及其他维度
 */

import type { Task } from '@/types'
import { MODEL_CONFIG } from '@/lib/config/modelConfig'

// 使用统一的通用模型配置
const DOUBAO_CONFIG = MODEL_CONFIG.general

/**
 * 生成个性化反思问题（AI驱动）
 * @param params 参数对象
 * @returns 反思问题文本（包含3个问题）
 */
export async function generateReflectionQuestion(params: {
  task: Task
  initialEstimate: number
}): Promise<string> {
  const { task, initialEstimate } = params
  
  console.log('🕐 [时间估算] 开始生成反思问题，任务:', task.title, '估计:', initialEstimate, '分钟')
  
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
  if (!apiKey) {
    console.warn('⚠️ Doubao API Key未配置，使用规则反思')
    return getRuleBasedReflection(task, initialEstimate)
  }
  
  // 构建AI Prompt（极简且聚焦时间）
  const systemPrompt = `你是一位擅长启发式提问的时间估算教练。你的目标是通过开放式问题，引导用户更深入地思考任务的实际情况，从而做出更准确的时间判断。

**核心原则：启发元认知，而非直接质问**
- 问题要开放式（需要思考和解释，不能简单回答"是/否"）
- 引导用户发现自己可能忽略的时间因素
- 探索用户对任务的理解深度
- 帮助用户意识到理想情况与现实的差距

**时间估算的常见盲区**：
1. 只算核心动作，忽略准备、收尾、切换、等待等隐藏耗时
2. 按最顺利的情况估算，没考虑卡点、返工、查资料的时间
3. 凭直觉估大任务，没有拆解和分步估算
4. 低估熟悉度的影响（第一次做 vs 熟练操作）

**好问题示例（开放式，启发思考）**：
✅ "这个任务的哪个环节最容易超时？为什么？"
✅ "你估计的${initialEstimate}分钟，是打算一口气做完，还是会中途休息？"
✅ "如果${initialEstimate}分钟没做完，最可能卡在哪里？"
✅ "这个任务你心里有清晰的步骤吗？每步大概要花多久？"
✅ "你做过类似的任务吗？上次实际花了多久？"
✅ "开始做之前，还需要做哪些准备？准备会花多久？"

**要避免的问题类型**：
❌ 封闭式问题："考虑准备时间了吗？"（只能回答是/否）
❌ 偏离时间的问题："你打算怎么做这个任务？"（问做法，不是时间）
❌ 无关问题："今天还有其他任务吗？"（与当前任务时间无关）
❌ 假设流程的问题："验证环节需要多久？"（用户可能根本不验证）

**提问策略**：
• 从用户的估计出发，探索盲区（"${initialEstimate}分钟包括了XX吗？"）
• 探索不确定性（"哪个部分最不确定？""最可能超时的是？"）
• 引导拆解（"这个任务具体分几步？""每步呢？"）
• 对比经验（"之前做过吗？""实际花了多久？"）
• 探索现实约束（"一口气做完还是分几次？""会被打断吗？"）

**输出格式（恰好 3 个问题）**：
• 问题1（开放式，引导深入思考）
• 问题2（开放式，探索盲区）
• 问题3（开放式，对比现实）`

  const userMessage = `用户正在估算任务时间，请帮助 TA 重新审视估算。

**任务**：${task.title}
${task.description ? `**描述**：${task.description}` : ''}
${task.tags?.length ? `**标签**：${task.tags.join('、')}` : ''}
${task.deadline_datetime ? `**截止时间**：${new Date(task.deadline_datetime).toLocaleString('zh-CN')}` : ''}

**用户的初始估计**：${initialEstimate} 分钟

---

请生成 3 个问题，帮助用户发现时间估算中可能忽略的部分。
记住：只关注时间判断，不扩展到其他维度。`

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
        max_tokens: 300,  // 3个问题需要足够的token空间
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
      console.log('🕐 [时间估算] AI生成的问题:\n', text.trim())
      return text.trim()
    } else {
      throw new Error('AI返回内容为空')
    }
  } catch (error) {
    console.error('❌ AI反思问题生成失败:', error)
    // 降级到规则反思
    console.log('🕐 [时间估算] 使用降级规则生成问题')
    return getRuleBasedReflection(task, initialEstimate)
  }
}

/**
 * 规则基础的反思问题生成（降级方案）
 * 返回3个聚焦时间判断的反思问题
 */
function getRuleBasedReflection(
  task: Task,
  initialEstimate: number
): string {
  const questions: string[] = []
  const tags = task.tags || []
  
  // 通用时间问题
  questions.push(`${initialEstimate}分钟包括了所有步骤吗？有没有忽略的准备或收尾时间？`)
  
  // 基于标签的问题
  if (tags.some(t => ['学习', '阅读', '研究'].includes(t))) {
    questions.push('学习类任务容易低估，实践和理解的时间算了吗？')
  } else if (tags.some(t => ['技术', '开发', '调试'].includes(t))) {
    questions.push('技术任务可能遇到意外问题，预留了调试时间吗？')
  } else {
    questions.push('这个估计是理想情况还是考虑了可能的意外？')
  }
  
  // 经验对比
  questions.push('你之前做过类似任务吗？实际花的时间和估计一致吗？')
  
  // 用项目符号格式化，让3个问题更清晰
  return questions.map(q => `• ${q}`).join('\n')
}

