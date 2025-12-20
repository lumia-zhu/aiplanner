/**
 * 每日回顾 - AI 总结生成服务
 * 
 * 功能说明：
 * - 根据用户的3个回顾回答，生成温暖、支持性的AI总结
 * - 识别用户的积极成果并给予肯定
 * - 对困难和挑战给予理解和鼓励
 * - 提供建设性的建议和正向反馈
 */

import { logger } from '@/utils/logger'

/**
 * Deepseek V3.2 配置
 */
const DEEPSEEK_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'deepseek-v3-2-251201'
}

/**
 * 获取 API Key
 */
function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
  if (!apiKey) {
    throw new Error('缺少 NEXT_PUBLIC_DOUBAO_API_KEY 环境变量')
  }
  return apiKey
}

/**
 * 🎯 生成每日回顾的AI总结
 * 
 * @param questions - 用户回答的问题数组（最多3个）
 * @param answers - 用户的回答数组（对应questions，可能为null表示跳过）
 * @returns AI生成的总结文本
 */
export async function generateReflectionSummary(
  questions: [string, string, string],
  answers: [string | null, string | null, string | null]
): Promise<string> {
  try {
    logger.debug('开始生成回顾总结', { questions, answers })
    
    // 统计回答情况
    const answeredCount = answers.filter(a => a !== null && a.trim() !== '').length
    const skippedCount = 3 - answeredCount
    
    if (answeredCount === 0) {
      // 如果用户一个问题都没回答，返回鼓励性的默认消息
      return generateDefaultSummary()
    }
    
    // 构建用户回答的上下文
    const qaContext = questions
      .map((q, i) => {
        const answer = answers[i]
        return answer ? `问题${i + 1}：${q}\n回答：${answer}` : null
      })
      .filter(Boolean)
      .join('\n\n')
    
    // 构建系统提示词
    const systemPrompt = `你是一位温暖、善解人意的生活导师。用户刚刚完成了每日任务回顾，回答了${answeredCount}个问题。

你的任务是生成一段**简洁、具体**的总结反馈。

**核心要求**：

1. **简洁精炼**：
   - 总字数：60-100字
   - 只写1-2个自然段
   - 每句话都要有信息量，不说废话

2. **必须具体**：
   - **提取用户回答中的具体内容**（完成了什么任务？遇到什么具体挑战？有什么具体发现？）
   - 用具体的事实说话，不要泛泛而谈
   - ❌ 错误示例："你今天很棒，继续努力！"（太空泛）
   - ✅ 正确示例："在'修复任务'上专注投入了1小时，还找到了'从用户角度考虑'这个有效的工作思路 ✨"

3. **语气风格**：
   - 温暖、真诚，像朋友一样
   - 使用第二人称"你"
   - 最多1个emoji

4. **绝对避免**：
   - ❌ 不要写空洞的彩虹屁（"你很棒""继续加油"）
   - ❌ 不要重复用户的原话
   - ❌ 不要假设用户没说的内容
   - ❌ 不要分三段（太长）
   - ❌ 不要给建议（除非用户明确求助）

5. **内容重点**（按优先级）：
   1. 用户完成了什么具体任务/事项
   2. 遇到了什么具体挑战或发现
   3. 简短的肯定或鼓励（不超过10字）

**示例**：
- 用户答："完成了3个任务，精力还行，发现提前规划很有用"
- 总结："看到你今天完成了3个任务，并且发现'提前规划'这个方法很有效 ✨"

现在，请根据用户的具体回答生成总结。`

    const userPrompt = `用户的回顾回答：

${qaContext}

请生成一段温暖、支持性的总结反馈。`

    // 调用 AI API
    const response = await fetch(DEEPSEEK_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.8,  // 较高的创造性
        max_tokens: 500,   // 最多生成500个token
        top_p: 0.9
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('AI API 请求失败:', { status: response.status, error: errorText })
      throw new Error(`AI API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      logger.error('AI 返回空内容')
      throw new Error('AI 返回空内容')
    }

    logger.debug('AI 总结生成成功', { summary })
    return summary

  } catch (error) {
    logger.error('生成回顾总结失败:', error)
    
    // 降级：返回默认的鼓励性消息
    return generateDefaultSummary()
  }
}

/**
 * 🎁 生成默认的鼓励性总结（降级方案）
 * 
 * 当AI生成失败或用户没有回答任何问题时使用
 */
function generateDefaultSummary(): string {
  const defaultSummaries = [
    '感谢你完成今日回顾！能停下来回顾自己，这份用心很棒 ✨',
    
    '谢谢你参与今天的回顾时刻！这个习惯会让你更了解自己 💪',
    
    '今天完成了回顾打卡！继续保持这份对自己的关注 🌟',
    
    '感谢你的参与！即使简单的暂停和回顾，也很有价值 ☀️'
  ]
  
  // 随机选择一条默认消息
  const randomIndex = Math.floor(Math.random() * defaultSummaries.length)
  return defaultSummaries[randomIndex]
}

/**
 * 🧪 测试：生成反思总结（带示例数据）
 */
export async function testGenerateReflectionSummary() {
  console.log('=== 测试 AI 反思总结生成 ===\n')
  
  // 测试案例1：完整回答
  console.log('测试1：用户完整回答了3个问题')
  const summary1 = await generateReflectionSummary(
    [
      '今天你的任务进展如何？有哪些完成得不错的？',
      '任务是否按你预期的方式进行？有什么偏差吗？',
      '此刻你的精力和情绪状态如何？感觉怎么样？'
    ],
    [
      '今天完成了3个重要任务，特别是解决了一个困扰很久的Bug，感觉很有成就感！',
      '整体还算顺利，不过有个功能花的时间比预期多了一些。',
      '精力还不错，心情愉快，对明天充满期待！'
    ]
  )
  console.log('AI总结:', summary1)
  console.log('\n')
  
  // 测试案例2：跳过了一个问题
  console.log('测试2：用户跳过了第二个问题')
  const summary2 = await generateReflectionSummary(
    [
      '今天你的任务进展如何？有哪些完成得不错的？',
      '今天有没有遇到意外的情况或惊喜？',
      '此刻你的精力和情绪状态如何？感觉怎么样？'
    ],
    [
      '完成了两个任务，但还有一个没做完。',
      null,  // 跳过
      '有点累，但还好。'
    ]
  )
  console.log('AI总结:', summary2)
  console.log('\n')
  
  // 测试案例3：用户没有回答任何问题
  console.log('测试3：用户没有回答任何问题')
  const summary3 = await generateReflectionSummary(
    [
      '今天你的任务进展如何？有哪些完成得不错的？',
      '任务是否按你预期的方式进行？有什么偏差吗？',
      '此刻你的精力和情绪状态如何？感觉怎么样？'
    ],
    [null, null, null]
  )
  console.log('AI总结（默认）:', summary3)
  console.log('\n')
  
  console.log('=== 测试完成 ===')
}

