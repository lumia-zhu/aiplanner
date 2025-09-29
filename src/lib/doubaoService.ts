'use client'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
    }
  }>
}

interface ChatResponse {
  success: boolean
  message?: string
  error?: string
}

class DoubaoService {
  private getApiKey(): string | null {
    return process.env.NEXT_PUBLIC_DOUBAO_API_KEY || null
  }

  // 检查API Key是否可用
  hasApiKey(): boolean {
    return !!this.getApiKey()
  }

  // 将图片文件转换为 base64
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 处理流式响应
  private async handleStreamResponse(response: Response, onStream: (chunk: string) => void): Promise<ChatResponse> {
    const reader = response.body?.getReader()
    if (!reader) {
      return { success: false, error: '无法读取流式响应' }
    }

    const decoder = new TextDecoder()
    let fullMessage = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            // 检查是否是结束标志
            if (data === '[DONE]') {
              return { success: true, message: fullMessage }
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed?.choices?.[0]?.delta?.content
              
              if (content) {
                fullMessage += content
                onStream(content) // 实时输出内容块
              }
            } catch (parseError) {
              console.warn('解析流式数据失败:', data, parseError)
            }
          }
        }
      }

      return { success: true, message: fullMessage }
    } catch (error: unknown) {
      console.error('流式响应处理失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return { success: false, error: `流式响应处理失败: ${errorMessage}` }
    } finally {
      reader.releaseLock()
    }
  }

  // 发送聊天消息（支持文本和图片）
  async sendMessage(
    message: string, 
    imageBase64?: string,
    conversationHistory: ChatMessage[] = [],
    onStream?: (chunk: string) => void
  ): Promise<ChatResponse> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: '请在环境变量中配置 NEXT_PUBLIC_DOUBAO_API_KEY' }
    }

    try {
      // 构建消息内容
      const messageContent: ChatMessage['content'] = [
        {
          type: 'text',
          text: message
        }
      ]

      // 如果有图片，添加图片内容
      if (imageBase64) {
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: imageBase64
          }
        })
      }

      // 构建完整的消息历史
      const isTaskMode = message.includes('TASK_RECOGNITION_MODE')
      
      const messages: ChatMessage[] = [
        // 系统提示词
        {
          role: 'system',
          content: [{
            type: 'text',
            text: isTaskMode
              ? 'You are a JSON task extractor. CRITICAL RULE: You must respond with ONLY valid JSON starting with { and ending with }. NO explanations. NO text before or after JSON. NO Chinese explanations. NO "这是" or "以下是". If you add any text outside JSON braces, the system will crash.'
              : '你是一个专业的任务管理助手，可以帮助用户管理任务、制定计划、提供建议。如果用户发送了图片，请分析图片内容并提供相关的任务管理建议。请用中文回复。'
          }]
        }
      ]

      // 如果是任务识别模式，添加强制JSON示例
      if (isTaskMode) {
        messages.push({
          role: 'user',
          content: [{
            type: 'text',
            text: 'Example: Extract tasks from "报名截止9月18日13:00，讲座9月19日9:30" Response format:'
          }]
        })
        messages.push({
          role: 'assistant',
          content: [{
            type: 'text',
            text: '{"tasks":[{"title":"报名讲座","description":"","priority":"high","deadline_date":"2025-09-18","deadline_time":"13:00"},{"title":"参加讲座","description":"","priority":"medium","deadline_date":"2025-09-19","deadline_time":"09:30"}]}'
          }]
        })
      }

      // 添加历史对话
      messages.push(...conversationHistory)
      
      // 添加当前消息
      messages.push({
        role: 'user',
        content: messageContent
      })

      // 准备请求体
      const requestBody = {
        model: DOUBAO_CONFIG.model,
        messages: messages,
        max_tokens: 1000,
        temperature: isTaskMode ? 0.1 : 0.7, // 任务识别模式使用更低的温度
        stream: !!onStream // 如果有回调函数就启用流式输出
      }

      console.log('发送消息到豆包:', requestBody)
      
      // 调试：检查是否是任务识别模式
      if (isTaskMode) {
        console.log('🔍 检测到任务识别模式')
        console.log('系统提示词:', messages[0].content[0].text)
        console.log('消息总数:', messages.length)
        console.log('最后一条用户消息:', messages[messages.length - 1].content[0].text?.substring(0, 200))
      }

      // 调用豆包 API
      const response = await fetch(DOUBAO_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('豆包响应状态:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('豆包 API 错误响应:', errorText)
        
        // 处理常见错误
        if (response.status === 401) {
          return { success: false, error: 'API Key 无效，请检查环境变量配置' }
        } else if (response.status === 429) {
          return { success: false, error: 'API 调用频率超限，请稍后重试' }
        } else if (response.status === 400) {
          return { success: false, error: '请求参数错误，请检查输入内容' }
        } else {
          return { success: false, error: `API 调用失败 (${response.status}): ${errorText}` }
        }
      }

      // 处理流式响应
      if (onStream && requestBody.stream) {
        return await this.handleStreamResponse(response, onStream)
      } else {
        // 处理非流式响应
        const responseData = await response.json()
        console.log('豆包响应数据:', responseData)

        if (responseData?.choices?.[0]?.message?.content) {
          const aiMessage = responseData.choices[0].message.content
          return {
            success: true,
            message: typeof aiMessage === 'string' ? aiMessage : aiMessage[0]?.text || '抱歉，我无法理解这个消息。'
          }
        } else {
          return { success: false, error: '未收到有效响应' }
        }
      }

    } catch (error: unknown) {
      console.error('豆包 API 调用失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return { 
        success: false, 
        error: `网络请求失败: ${errorMessage}` 
      }
    }
  }
}

// 导出单例
export const doubaoService = new DoubaoService()
export type { ChatMessage, ChatResponse }
