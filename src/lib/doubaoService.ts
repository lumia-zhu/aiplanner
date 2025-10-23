'use client'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

// 任务澄清的JSON Schema定义（用于结构化输出）
const TASK_CLARIFICATION_SCHEMA = {
  type: "object",
  properties: {
    structured_context: {
      type: "object",
      properties: {
        timeline: {
          type: "string",
          description: "时间相关的自然语言描述，如果没有则填写空字符串"
        },
        deadline_datetime: {
          type: "string",
          description: "ISO 8601格式的截止时间，如 2025-01-15T14:00:00，如果没有则填写空字符串"
        },
        deadline_confidence: {
          type: "string",
          enum: ["high", "medium", "low", ""],
          description: "时间解析的置信度：high(明确日期时间)/medium(相对时间)/low(模糊时间)/空字符串(无时间)"
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "外部依赖列表，如果没有则为空数组"
        },
        expected_output: {
          type: "string",
          description: "期望的产出形式，如果没有则填写空字符串"
        },
        difficulty: {
          type: "string",
          description: "预期的困难点或障碍，如果没有则填写空字符串"
        },
        mood: {
          type: "string",
          description: "用户对任务的情绪感受，如果没有则填写空字符串"
        },
        priority_reason: {
          type: "string",
          description: "优先级理由，如果没有则填写空字符串"
        }
      },
      required: ["timeline", "deadline_datetime", "deadline_confidence", 
                 "dependencies", "expected_output", "difficulty", 
                 "mood", "priority_reason"],
      additionalProperties: false
    },
    summary: {
      type: "string",
      description: "一句话总结，以'我理解的任务是这样的：'开头"
    }
  },
  required: ["structured_context", "summary"],
  additionalProperties: false
}

// 交互式消息类型
export type InteractiveMessageType = 
  | 'task-decomposition'     // 任务拆解
  | 'workflow-options'       // 工作流初始选项（完善单个任务/排序/结束）
  | 'single-task-action'     // 单任务操作选项（澄清/拆解/估时）
  | 'feeling-options'        // 优先级排序感觉选项
  | 'task-selection'         // 任务选择列表
  | 'clarification-confirm'  // 澄清确认按钮
  | 'estimation-confirm'     // 估时确认按钮
  | 'action-options'         // 动作选项（保留兼容）

// 交互式消息数据接口
export interface InteractiveMessage {
  type: InteractiveMessageType
  data: any  // 根据type不同，data结构不同
  isActive?: boolean  // 是否可交互（默认true，确认后变为false）
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: Array<{
    type: 'text' | 'image_url' | 'interactive'  // ⭐ 新增 'interactive'
    text?: string
    image_url?: {
      url: string
    }
    interactive?: InteractiveMessage  // ⭐ 新增交互式消息
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
        stream: !!onStream, // 如果有回调函数就启用流式输出
        thinking: {
          type: "disabled" // 关闭深度思考以提高响应速度
        }
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

  // 任务拆解专用服务
  async decomposeTask(
    taskTitle: string,
    taskDescription?: string,
    userContext?: string,  // 用户提供的任务上下文
    onStream?: (chunk: string) => void
  ): Promise<ChatResponse> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: '请在环境变量中配置 NEXT_PUBLIC_DOUBAO_API_KEY' }
    }

    try {
      // 构建任务拆解专用的系统提示词
      const systemPrompt = `你是一个专业的任务分解专家。你的任务是将用户提供的复杂任务分解为3-5个具体可执行的子任务。

重要要求：
1. 必须严格按照JSON格式返回，不要添加任何解释文字
2. 子任务标题要简洁明了，控制在15字以内，直接说明要做什么
3. 子任务应该按照逻辑顺序排列
4. JSON格式必须严格正确，所有字符串必须用双引号包围

返回格式：
{
  "subtasks": [
    {
      "title": "具体的子任务标题",
      "order": 1
    }
  ]
}

注意：只需要title和order两个字段，不需要description或时间估计。`

      // 构建用户消息
      const userMessage = `请将以下任务拆解为具体的子任务：

任务标题：${taskTitle}
${taskDescription ? `任务描述：${taskDescription}` : ''}

${userContext ? `📋 用户补充信息：
${userContext}

请特别考虑用户提供的背景信息，确保子任务符合实际情境。
` : ''}

请分析这个任务，并将其拆解为3-5个具体可执行的子任务。每个子任务都应该有明确的完成标准。`

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: [{
            type: 'text',
            text: systemPrompt
          }]
        },
        // 添加示例对话
        {
          role: 'user',
          content: [{
            type: 'text',
            text: '请将以下任务拆解为具体的子任务：\n\n任务标题：准备学术会议演讲\n任务描述：需要在下周的学术会议上做20分钟的演讲'
          }]
        },
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: '{"subtasks":[{"title":"确定演讲主题和大纲","order":1},{"title":"收集整理相关资料","order":2},{"title":"制作演讲PPT","order":3},{"title":"练习演讲内容","order":4},{"title":"准备问答环节","order":5}]}'
          }]
        },
        {
          role: 'user',
          content: [{
            type: 'text',
            text: userMessage
          }]
        }
      ]

      // 准备请求体
      const requestBody = {
        model: DOUBAO_CONFIG.model,
        messages: messages,
        max_tokens: 1500,
        temperature: 0.3, // 较低的温度确保输出更稳定
        stream: !!onStream,
        thinking: {
          type: "disabled" // 关闭深度思考以提高响应速度
        }
      }

      console.log('🔧 任务拆解请求:', {
        taskTitle,
        taskDescription,
        systemPrompt: systemPrompt.substring(0, 100) + '...'
      })

      const response = await fetch(DOUBAO_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('任务拆解API响应错误:', response.status, errorText)
        return { 
          success: false, 
          error: `API请求失败: ${response.status} ${response.statusText}` 
        }
      }

      // 处理流式或非流式响应
      if (onStream) {
        return await this.handleStreamResponse(response, onStream)
      } else {
        const data = await response.json()
        // 兼容不同返回结构：content 可能是字符串，或数组[{type:'text', text: '...'}]
        const aiContent = data?.choices?.[0]?.message?.content
        let message = ''
        if (typeof aiContent === 'string') {
          message = aiContent
        } else if (Array.isArray(aiContent)) {
          // 拼接所有文本片段
          message = aiContent
            .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
            .join('')
        }
        console.log('📝 任务拆解响应(原始):', JSON.stringify(aiContent)?.slice(0, 300) + '...')
        console.log('📝 任务拆解响应(提取文本):', message?.slice(0, 200) + '...')
        if (!message || message.trim().length === 0) {
          return { success: false, error: '模型未返回可用文本内容' }
        }
        return { success: true, message }
      }

    } catch (error: unknown) {
      console.error('任务拆解请求失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return { 
        success: false, 
        error: `任务拆解失败: ${errorMessage}` 
      }
    }
  }

  // 任务澄清专用服务 - 将用户回答转换为结构化上下文
  async clarifyTask(
    taskTitle: string,
    taskDescription: string | undefined,
    questions: Array<{ dimension: string; question: string; purpose: string }>,
    userAnswer: string
  ): Promise<{
    success: boolean
    structured_context?: {
      timeline?: string
      deadline_datetime?: string
      deadline_confidence?: 'high' | 'medium' | 'low'
      dependencies?: string[]
      expected_output?: string
      difficulty?: string
      mood?: string
      priority_reason?: string
    }
    summary?: string
    error?: string
  }> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: '请在环境变量中配置 NEXT_PUBLIC_DOUBAO_API_KEY' }
    }

    try {
      // 获取当前时间作为参考
      const currentDate = new Date()
      const currentDateStr = currentDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
      const currentISO = currentDate.toISOString()
      
      // 构建任务澄清专用的系统提示词
      const systemPrompt = `你是一位专业的任务管理助手。用户刚刚回答了关于任务的澄清问题，你需要将用户的自然语言回答整合为结构化的任务上下文。

⏰ 当前时间参考：${currentDateStr}（ISO格式：${currentISO}）

重要要求：
1. 仔细分析用户的回答，提取相关信息
2. **特别注意时间信息的提取和转换**：
   - 如果用户提到了具体时间（如"明天下午3点"、"下周一早上"、"1月20日"），必须转换为ISO 8601格式
   - **时区处理：用户所在时区为北京时间（UTC+8），返回的时间格式必须不包含时区标识**
   - 转换规则：
     * "今天" → 使用当天日期
     * "明天" → 当天+1天
     * "后天" → 当天+2天
     * "下周X" → 计算到下周对应的星期几
     * "X月Y日" → 使用当前年份（如果该日期已过则为明年）+ 指定月日
     * 时间默认值：早上→09:00，中午→12:00，下午→14:00，晚上→19:00，具体时间点按用户描述
     * 如果未指定具体时间点，使用23:59
   - **重要：返回的时间必须是北京本地时间，格式为"YYYY-MM-DDTHH:mm:ss"（不带Z或时区偏移）**
   - 同时保留原始自然语言描述在timeline字段
   - 设置置信度：
     * "high": 明确的日期+时间点（如"1月15日下午3点"、"今天下午1点"）
     * "medium": 相对日期（如"明天下午"）
     * "low": 时间模糊（如"这周"、"月底前"）
     * "": 用户完全没提时间
3. 如果用户未提及某个字段，该字段设置为空字符串""
4. 生成一句话总结，以"我理解的任务是这样的："开头，不超过100字

输出格式说明：
- timeline: 字符串，保留用户的原始时间表达，没有则为空字符串""
- deadline_datetime: 字符串，北京本地时间的ISO格式（如"2025-01-17T13:00:00"，不带Z或+08:00），没有则为空字符串""
- deadline_confidence: 字符串，只能是"high"/"medium"/"low"或空字符串""
- dependencies: 数组，如["依赖1", "依赖2"]，没有则为空数组[]
- 其他字段: 字符串，没有则为空字符串""
- summary: 必须是字符串，不能为空`

      // 构建问题列表文本
      const questionList = questions
        .map((q, i) => `${i + 1}. ${q.question} (目的：${q.purpose})`)
        .join('\n')

      // 构建用户消息
      const userMessage = `任务信息：
- 标题：${taskTitle}
- 描述：${taskDescription || '无'}

我向用户提出了以下澄清问题：
${questionList}

用户的回答：
${userAnswer}

请分析用户的回答，提取结构化信息，并生成一句话总结。`

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: [{
            type: 'text',
            text: systemPrompt
          }]
        },
        // 添加示例对话
        {
          role: 'user',
          content: [{
            type: 'text',
            text: `任务信息：
- 标题：准备课程PPT
- 描述：下周要讲的内容

我向用户提出了以下澄清问题：
1. 你准备这个PPT的主要目的是什么？ (目的：区分目标与产出形式)
2. 有没有需要别人提供的信息或文件？ (目的：识别外部依赖)
3. 相比其他任务，这个任务的重要程度如何？ (目的：准备优先级判断)

用户的回答：
这是给学生上课用的，主要是讲解新概念。需要从导师那里拿到最新的研究数据。这个任务比较重要，因为下周就要上课了，但是我现在有点焦虑，担心数据来不及。

请分析用户的回答，提取结构化信息，并生成一句话总结。`
          }]
        },
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: `{"structured_context":{"timeline":"下周上课前完成","dependencies":["导师提供的最新研究数据"],"expected_output":"用于课堂讲解的PPT，需要包含新概念和研究数据","difficulty":"数据获取的时效性，担心导师数据来不及提供","mood":"有点焦虑","priority_reason":"下周就要上课，时间紧迫且对学生影响大"},"summary":"我理解的任务是这样的：你需要在下周上课前制作一份讲解新概念的课程PPT，其中需要用到导师提供的最新研究数据。这个任务比较重要且紧迫，你目前有点焦虑，主要担心数据能否及时获取。"}`
          }]
        },
        {
          role: 'user',
          content: [{
            type: 'text',
            text: userMessage
          }]
        }
      ]

      // 准备请求体 - 使用结构化输出
      const requestBody = {
        model: DOUBAO_CONFIG.model,
        messages: messages,
        stream: false,
        temperature: 0.7,
        thinking: {
          type: "disabled"  // 关闭深度思考以提高响应速度
        },
        response_format: {   // 使用结构化输出
          type: "json_schema",
          json_schema: {
            name: "task_clarification",
            strict: true,
            schema: TASK_CLARIFICATION_SCHEMA
          }
        }
      }

      console.log('📝 调用任务澄清API（结构化输出）...')

      // 调用豆包 API
      const response = await fetch(DOUBAO_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('任务澄清 API 错误响应:', errorText)
        return { success: false, error: `API 调用失败 (${response.status})` }
      }

      // 处理响应
      const data = await response.json()
      const aiContent = data?.choices?.[0]?.message?.content
      
      let messageText = ''
      if (typeof aiContent === 'string') {
        messageText = aiContent
      } else if (Array.isArray(aiContent)) {
        messageText = aiContent
          .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
          .join('')
      }

      console.log('📝 任务澄清响应(结构化):', messageText?.slice(0, 200) + '...')

      if (!messageText || messageText.trim().length === 0) {
        return { success: false, error: '模型未返回可用文本内容' }
      }

      // 解析 JSON - 由于使用了 json_schema，返回应该是纯净的JSON
      try {
        const parsed = JSON.parse(messageText)
        
        if (!parsed.structured_context || !parsed.summary) {
          console.error('JSON结构不完整:', parsed)
          return { success: false, error: 'AI返回的数据结构不完整' }
        }

        // 将空字符串转换为undefined（便于后续处理）
        const context = parsed.structured_context
        const normalizedContext = {
          timeline: context.timeline || undefined,
          deadline_datetime: context.deadline_datetime || undefined,
          deadline_confidence: context.deadline_confidence || undefined,
          dependencies: (context.dependencies && context.dependencies.length > 0) ? context.dependencies : undefined,
          expected_output: context.expected_output || undefined,
          difficulty: context.difficulty || undefined,
          mood: context.mood || undefined,
          priority_reason: context.priority_reason || undefined,
        }
        
        // 验证 deadline_datetime 格式（如果存在）
        if (normalizedContext.deadline_datetime) {
          const deadline = new Date(normalizedContext.deadline_datetime)
          if (isNaN(deadline.getTime())) {
            console.warn('deadline_datetime 格式无效，将忽略:', 
                         normalizedContext.deadline_datetime)
            normalizedContext.deadline_datetime = undefined
            normalizedContext.deadline_confidence = undefined
          } else {
            console.log('✅ 解析到截止时间:', 
                       normalizedContext.deadline_datetime,
                       '置信度:', 
                       normalizedContext.deadline_confidence)
          }
        }

        return {
          success: true,
          structured_context: normalizedContext,
          summary: parsed.summary
        }
      } catch (parseError) {
        console.error('JSON解析失败:', messageText, parseError)
        return { success: false, error: '无法解析AI返回的结构化数据' }
      }

    } catch (error: unknown) {
      console.error('任务澄清请求失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return { 
        success: false, 
        error: `任务澄清失败: ${errorMessage}` 
      }
    }
  }
}

// 导出单例
export const doubaoService = new DoubaoService()
export type { ChatMessage, ChatResponse, InteractiveMessage, InteractiveMessageType }
