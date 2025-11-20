/**
 * 普通对话服务
 * 
 * 用于处理非任务管理的日常对话
 * 直接调用豆包 LLM，不使用 Agent 架构
 */

export interface CasualChatOptions {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  systemContext?: string // 🆕 额外的上下文信息
}

const DEFAULT_OPTIONS: Required<Omit<CasualChatOptions, 'systemContext'>> = {
  temperature: 0.7,
  maxTokens: 500,
  systemPrompt: '你是一个友好的AI助手，用简洁、自然的语言回复用户。保持对话轻松愉快。'
}

/**
 * 普通对话（流式输出）
 * 
 * @param userMessage 用户消息
 * @param conversationHistory 对话历史（最近5条）
 * @param options 可选配置
 * @returns 异步生成器，逐字返回 AI 回复
 */
export async function* casualChat(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
  options: CasualChatOptions = {}
): AsyncGenerator<string> {
  
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // 🆕 处理系统上下文
  let finalSystemPrompt = opts.systemPrompt
  if (options.systemContext) {
    console.log('🧠 注入系统上下文:', { length: options.systemContext.length })
    finalSystemPrompt += `\n\n${options.systemContext}`
  }
  
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
  if (!apiKey) {
    throw new Error('缺少 DOUBAO_API_KEY')
  }

  // 构建消息列表
  const messages = [
    // 系统提示
    {
      role: 'system',
      content: [{ type: 'text', text: finalSystemPrompt }]
    },
    // 对话历史（限制最近5条，避免上下文过长）
    ...conversationHistory.slice(-5).map(msg => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }]
    })),
    // 当前用户消息
    {
      role: 'user',
      content: [{ type: 'text', text: userMessage }]
    }
  ]

  console.log('💬 普通对话 - 发送请求:', {
    messageCount: messages.length,
    userMessage: userMessage.substring(0, 100)
  })

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'doubao-seed-1-6-vision-250815',
        messages: messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true  // 启用流式输出
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    // 解析流式响应
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('💬 普通对话 - 流式响应完成')
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      
      // 保留最后一个不完整的行
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // 跳过空行和注释
        if (!trimmedLine || trimmedLine.startsWith(':')) {
          continue
        }

        // 解析 SSE 数据
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6)
          
          // 检查是否是结束标记
          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            
            if (content) {
              yield content
            }
          } catch (e) {
            console.warn('解析 SSE 数据失败:', data)
          }
        }
      }
    }

  } catch (error) {
    console.error('💬 普通对话失败:', error)
    throw error
  }
}

/**
 * 普通对话（非流式，返回完整文本）
 * 
 * @param userMessage 用户消息
 * @param conversationHistory 对话历史
 * @param options 可选配置
 * @returns 完整的 AI 回复文本
 */
export async function casualChatSync(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
  options: CasualChatOptions = {}
): Promise<string> {
  
  let fullResponse = ''
  
  for await (const chunk of casualChat(userMessage, conversationHistory, options)) {
    fullResponse += chunk
  }
  
  return fullResponse
}
