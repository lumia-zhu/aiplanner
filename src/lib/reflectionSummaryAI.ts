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
import { MODEL_CONFIG } from '@/lib/config/modelConfig'

// 使用统一的反思模型配置
const DEEPSEEK_CONFIG = MODEL_CONFIG.reflection

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

你的任务是生成一段**详细、忠实原文**的总结反馈。

**核心要求**：

1. **长度要求**：
   - 总字数：200-300字
   - 分2-3个自然段
   - 确保充分覆盖用户提到的所有重要信息

2. **忠实原文，全面覆盖**：
   - **必须包含用户提到的所有重要内容**，特别是：
     * 完成的任务及其进展情况
     * 遇到的困难、挑战、挣扎
     * 合作/协作相关的问题
     * 用户的真实感受（满意/不满意/焦虑/挣扎等）
   - ⚠️ **绝对不要遗漏用户明确提到的挑战和困难**
   - ⚠️ **绝对不要对用户的感受做出假设或美化**
     * 如果用户说"不满意"，不要说"进展不错"
     * 如果用户说"挣扎"，不要说"很顺利"
   - ✅ 正确做法：忠实反映用户的原话和真实感受

3. **具体且有信息量**：
   - 提取用户回答中的**具体细节**（任务名称、具体挑战、具体发现）
   - 用具体的事实说话，不要泛泛而谈
   - ❌ 错误示例："你今天很棒，继续努力！"（太空泛）
   - ✅ 正确示例："在'研究提案'上遇到了方向选择和合作参与度的挑战，同时批改46份试卷的进度让你感到不够满意"

4. **语气风格**：
   - 温暖、真诚、共情
   - 使用第二人称"你"
   - 最多1-2个emoji

5. **绝对避免**：
   - ❌ 不要遗漏用户提到的重要信息（尤其是挑战和困难）
   - ❌ 不要美化或假设用户的感受
   - ❌ 不要写空洞的彩虹屁
   - ❌ 不要给建议（除非用户明确求助）

**示例**：
- 用户答："处理'研究提案'时遇到方向选择困难，合作参与度也是个问题。批改了46份试卷，但进度不够理想。"
- 总结："看到你在处理'研究提案'时，不仅克服了开始的拖延，还深入思考了有趣的paper，同时梳理了方向选择与合作参与度等具体挑战。同时，你高效批改了46份试卷，虽然进度让你感到不够满意，但这个努力本身已经很值得肯定 ✨"

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
        temperature: 0.7,  // 适中的创造性，确保忠实原文
        max_tokens: 800,   // 增加到800，支持200-300字的总结
        top_p: 0.9,
        // ⚠️ 禁用豆包模型的"深度思考"功能，避免响应时间过长
        thinking: { type: "disabled" }
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
      '今天有没有发生什么意料之外的事情？',
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

