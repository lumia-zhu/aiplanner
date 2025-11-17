/**
 * 意图分类器 - 判断用户消息是任务管理还是普通聊天
 */

/**
 * 意图类型
 * - task_management: 任务管理相关（需要调用 Agent）
 * - casual_chat: 普通聊天（直接 LLM 回复）
 */
export type IntentType = 'task_management' | 'casual_chat'

/**
 * 意图分类结果
 */
export interface IntentResult {
  type: IntentType
  confidence: number // 置信度 0-1
  reason?: string // 分类原因（用于调试）
}

/**
 * 分类用户消息意图
 * @param userMessage 用户输入的消息
 * @returns 意图分类结果
 */
export async function classifyIntent(userMessage: string): Promise<IntentResult> {
  // 1. 快速规则预判断
  const quickCheck = quickClassify(userMessage)
  if (quickCheck) {
    console.log(`✅ 快速规则分类: ${quickCheck.type} (${quickCheck.reason})`)
    return quickCheck
  }

  // 2. 尝试 LLM 分类
  try {
    console.log('🤖 调用 LLM 进行意图分类...')
    const result = await llmClassify(userMessage)
    console.log(`✅ LLM 分类: ${result.type} (${result.reason})`)
    return result
  } catch (error) {
    console.warn('⚠️ LLM 分类失败，使用默认策略:', error)
    
    // 3. LLM 失败时的降级策略：默认为任务管理（保守）
    return {
      type: 'task_management',
      confidence: 0.6,
      reason: 'LLM 分类失败，默认为任务管理'
    }
  }
}

/**
 * 快速规则分类（基于关键词）
 */
function quickClassify(message: string): IntentResult | null {
  const text = message.trim().toLowerCase()

  // 空消息或纯表情
  if (text.length === 0 || /^[\s\uD83C-\uDBFF\uDC00-\uDFFF]+$/.test(text)) {
    return {
      type: 'casual_chat',
      confidence: 1.0,
      reason: '空消息或纯表情'
    }
  }

  // 纯标点符号或重复字符
  if (/^[!！?？。，,、；;：:…—\-\s]+$/.test(text)) {
    return {
      type: 'casual_chat',
      confidence: 1.0,
      reason: '纯标点符号'
    }
  }

  // 重复语气词（啊啊啊、哈哈哈等）
  if (/^(嗨|哈|哦|啊|呃|嗯|唉|额|诶){2,}$/i.test(text)) {
    return {
      type: 'casual_chat',
      confidence: 0.95,
      reason: '重复语气词'
    }
  }

  // 明确的任务管理关键词（动词+名词组合）
  const taskKeywordsCN = [
    // 创建类
    '创建任务', '添加任务', '新建任务', '建个任务', '加个任务', '加一个任务',
    '帮我创建', '帮我添加', '帮我建',
    // 删除类
    '删除任务', '移除任务', '删掉', '删除第',
    // 完成类
    '完成任务', '完成了', '做完了', '标记完成',
    // 查询类
    '查看任务', '查询任务', '有什么任务', '有哪些任务', '任务列表', '看看任务',
    '今天有什么', '明天有什么', '今天的任务', '明天的任务', '本周任务',
    // 修改类
    '修改任务', '更新任务', '编辑任务', '改一下',
    // 待办相关
    '待办', '代办', '待办事项', 'todo', 'to do', 'to-do', 'task', 'tasks'
  ]

  for (const keyword of taskKeywordsCN) {
    if (text.includes(keyword)) {
      return {
        type: 'task_management',
        confidence: 0.95,
        reason: `包含任务关键词: ${keyword}`
      }
    }
  }

  // 明确的普通聊天关键词
  const casualKeywordsCN = [
    // 问候
    '你好', '您好', 'hello', 'hi', '嗨', '早上好', '晚上好', '下午好',
    // 感谢
    '谢谢', '感谢', 'thanks', 'thank you', '多谢',
    // 告别
    '再见', 'bye', '拜拜', '再会',
    // 闲聊话题（且不包含任务词）
    '天气怎么样', '心情', '怎么样啊', '在吗', '在不在'
  ]

  for (const keyword of casualKeywordsCN) {
    if (text.includes(keyword) && !hasTaskKeywords(text)) {
      return {
        type: 'casual_chat',
        confidence: 0.9,
        reason: `包含聊天关键词: ${keyword}`
      }
    }
  }

  // 非常短的消息（≤5字符）且不包含任务关键词
  if (text.length <= 5 && !hasTaskKeywords(text)) {
    return {
      type: 'casual_chat',
      confidence: 0.85,
      reason: '过短且无任务关键词'
    }
  }

  // 疑问句但不包含任务关键词（可能是闲聊）
  if ((text.includes('?') || text.includes('？')) && !hasTaskKeywords(text)) {
    return {
      type: 'casual_chat',
      confidence: 0.8,
      reason: '疑问句且无任务关键词'
    }
  }

  // 如果包含任务相关词，但不确定具体意图，倾向于任务管理
  if (hasTaskKeywords(text)) {
    return {
      type: 'task_management',
      confidence: 0.75,
      reason: '包含任务相关词汇'
    }
  }

  // 无法快速判断，返回 null
  return null
}

/**
 * 检查是否包含任务相关关键词
 */
function hasTaskKeywords(text: string): boolean {
  const taskIndicators = [
    '任务', '待办', '代办', 'todo', 'task',
    '完成', '创建', '添加', '删除', '查看', '修改',
    '今天', '明天', '本周', 'deadline', '截止'
  ]
  
  return taskIndicators.some(keyword => text.includes(keyword))
}

/**
 * 使用 LLM 进行意图分类
 */
async function llmClassify(userMessage: string): Promise<IntentResult> {
  const systemPrompt = `你是一个意图分类助手，需要判断用户消息属于以下哪一类：

1. **task_management（任务管理）**：
   - 用户想要创建、查询、修改、删除、完成任务
   - 询问今天/明天/某天的任务
   - 任何与待办事项、任务列表相关的操作
   - 例子：
     * "帮我创建一个任务：写报告"
     * "今天有什么任务？"
     * "完成买菜任务"
     * "查看我的待办"
     * "删除第一个任务"

2. **casual_chat（普通聊天）**：
   - 日常问候、闲聊
   - 无意义的表情或语气词
   - 询问天气、心情等非任务相关的话题
   - 感谢、道别等礼貌用语
   - 例子：
     * "你好"
     * "啊啊啊啊"
     * "今天天气怎么样？"
     * "😊"
     * "谢谢"

**重要**：只返回 JSON 格式，不要有其他文字：
{
  "type": "task_management" 或 "casual_chat",
  "confidence": 0.0-1.0 之间的数字,
  "reason": "简短的分类理由"
}`

  try {
    const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
    if (!apiKey) {
      throw new Error('缺少 DOUBAO_API_KEY')
    }

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'doubao-seed-1-6-vision-250815',  // 使用和主系统相同的模型
        messages: [
          {
            role: 'system',
            content: [{ type: 'text', text: systemPrompt }]
          },
          {
            role: 'user',
            content: [{ type: 'text', text: `用户消息：「${userMessage}」` }]
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 解析 LLM 返回的 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        type: result.type,
        confidence: result.confidence,
        reason: result.reason
      }
    }

    // 无法解析，默认返回任务管理
    return {
      type: 'task_management',
      confidence: 0.5,
      reason: 'LLM 返回格式错误，使用默认值'
    }
  } catch (error) {
    console.error('LLM 分类失败:', error)
    throw error
  }
}

/**
 * 批量分类（用于测试）
 */
export async function batchClassify(messages: string[]): Promise<IntentResult[]> {
  const results: IntentResult[] = []
  
  for (const message of messages) {
    const result = await classifyIntent(message)
    results.push(result)
  }
  
  return results
}

