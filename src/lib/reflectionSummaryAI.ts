/**
 * 每日反思 - AI 总结生成服务
 * 
 * 功能说明：
 * - 根据用户的3个反思回答，生成温暖、支持性的AI总结
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
 * 🎯 生成每日反思的AI总结
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
    logger.debug('开始生成反思总结', { questions, answers })
    
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
    const systemPrompt = `你是一位温暖、善解人意的生活导师和心理支持者。用户刚刚完成了每日任务反思，回答了${answeredCount}个问题（跳过了${skippedCount}个）。

你的任务是根据用户的回答，生成一段温暖、支持性的总结反馈。

**生成要求**：

1. **语气风格**：
   - 温暖、真诚、像朋友一样亲切
   - 使用第二人称"你"，拉近距离
   - 多使用积极词汇：太棒了、很好、继续保持等
   - 适当使用emoji增加亲和力（1-3个）

2. **内容结构**：
   - 第一段：肯定用户的努力和成就（即使很小也要发现亮点）
   - 第二段：对挑战和困难表示理解和支持
   - 第三段：给予鼓励和正向展望

3. **分析重点**：
   - 任务完成情况：是否有进展？完成了什么？
   - 情绪状态：用户的精力和心情如何？
   - 意外情况：有没有惊喜或挑战？
   - 有益发现：什么对用户有帮助？

4. **长度控制**：
   - 总字数：100-200字
   - 分2-3个自然段
   - 简洁有力，不啰嗦

5. **避免**：
   - 不要说教或给建议（除非用户明确表达困惑）
   - 不要重复用户的原话
   - 不要空泛的鼓励（要具体）
   - 不要过度使用emoji（最多3个）

6. **特殊情况处理**：
   - 如果用户跳过了某些问题，不要提及跳过的事
   - 如果用户表达消极情绪，给予理解和支持，不是解决方案
   - 如果用户没有明确表达困难，就不要假设有困难

**示例风格**：
- "太棒了！今天你完成了3个重要任务，这种成就感一定很棒！虽然遇到了一些技术挑战，但你依然保持了积极的心态。精力充沛、心情愉快，这是最好的状态！继续保持这份热情，明天一定会更好！💪"

现在，请根据用户的回答生成总结。`

    const userPrompt = `用户的反思回答：

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
    logger.error('生成反思总结失败:', error)
    
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
    '感谢你抽出时间进行今日反思！即使是简单的停下来回顾，也是对自己的关注和照顾。每一天的努力都值得被看见，继续保持这份用心！✨',
    
    '完成今日反思是一个很好的开始！反思本身就是一种成长，它帮助我们更清晰地看到自己的进步。相信明天会有更多收获！💪',
    
    '谢谢你参与今天的反思时刻！无论今天过得如何，能停下来回顾就已经很棒了。每一天都是新的开始，期待你明天的分享！🌟',
    
    '今天你完成了反思打卡！这个习惯会让你更了解自己、更清晰地看到成长。保持这份用心，你会发现越来越多的变化！🎯',
    
    '感谢你的参与！反思是认识自己的第一步，即使今天没有太多想说的，这份暂停和回顾也很有价值。明天继续加油！☀️'
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

