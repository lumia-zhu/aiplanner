/**
 * 豆包 AI 模型适配器
 * 
 * 使用 Vercel AI SDK 封装豆包模型调用
 */

import { generateText, generateObject, streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type {
  ModelConfig,
  GenerateTextOptions,
  GenerateObjectOptions,
  StreamTextOptions
} from '@/types/workflow/adapter'
import { BaseModelAdapter, buildMessages, mergeOptions } from './adapter'

/**
 * 豆包模型适配器
 * 
 * 豆包使用 OpenAI 兼容的 API，因此可以使用 @ai-sdk/openai
 */
export class DoubaoAdapter extends BaseModelAdapter {
  readonly name = 'doubao-seed-1-6-vision-250815'
  readonly config: ModelConfig
  
  private provider: ReturnType<typeof createOpenAI>
  
  constructor(config: ModelConfig) {
    super()
    this.config = config
    
    // 直接使用豆包的完整 URL，不使用 Vercel AI SDK 的自动路径拼接
    // 这样可以确保与对话功能使用相同的端点
    this.provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
      // 不使用 compatibility 选项，避免 SDK 改变请求路径
    })
    
    console.log(`✅ 豆包适配器初始化成功: ${config.modelId}`)
    console.log(`🔧 DoubaoAdapter baseURL: ${config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3'}`)
  }
  
  /**
   * 生成文本（非流式）
   * 直接使用 fetch 调用豆包 API，避免 Vercel AI SDK 的兼容性问题
   */
  async generateText(
    prompt: string,
    options?: GenerateTextOptions
  ): Promise<string> {
    return this.withMetrics(async () => {
      const mergedOptions = mergeOptions(this.config, options)
      const messages = buildMessages(prompt, mergedOptions)
      
      console.log('🤖 豆包生成文本:', {
        prompt: prompt.substring(0, 100) + '...',
        temperature: mergedOptions.temperature,
        maxTokens: mergedOptions.maxTokens
      })
      
      // 直接使用 fetch 调用豆包 API（与对话功能一致）
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          temperature: mergedOptions.temperature,
          max_tokens: mergedOptions.maxTokens,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`豆包 API 错误 (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      
      console.log('✅ 豆包文本生成完成，长度:', text.length)
      return text
    })
  }
  
  /**
   * 生成结构化对象（带 JSON Schema 验证）
   * 使用豆包的 response_format 参数实现结构化输出
   */
  async generateObject<T>(
    prompt: string,
    schema: any,
    options?: GenerateObjectOptions
  ): Promise<T> {
    return this.withMetrics(async () => {
      const mergedOptions = mergeOptions(this.config, options)
      const messages = buildMessages(prompt, mergedOptions)
      
      console.log('🤖 豆包生成对象:', {
        prompt: prompt.substring(0, 100) + '...',
        hasSchema: !!schema
      })
      
      // 豆包要求：使用 response_format 时，messages 必须包含 'json' 这个词
      // 在最后一条消息末尾添加 JSON 格式说明
      const messagesWithJsonHint = messages.map((m, index) => {
        if (index === messages.length - 1 && m.role === 'user') {
          return {
            role: m.role,
            content: m.content + '\n\n请以 JSON 格式返回结果。'
          }
        }
        return m
      })
      
      // 直接使用 fetch 调用豆包 API，使用 json_schema 格式强约束输出结构
      // 这里使用调用方传入的 schema（应为 JSON Schema 对象）
      const jsonSchema = schema || { type: 'object' }

      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelId,
          messages: messagesWithJsonHint.map(m => ({
            role: m.role,
            content: m.content
          })),
          temperature: mergedOptions.temperature || 0.3,
          max_tokens: mergedOptions.maxTokens,
          // 使用豆包的 response_format: json_schema 强约束输出
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'StructuredResult',
              schema: jsonSchema
            }
          }
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`豆包 API 错误 (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || '{}'
      
      // 解析 JSON 响应
      try {
        const object = JSON.parse(content)
        console.log('✅ 豆包对象生成完成')
        return object as T
      } catch (parseError) {
        console.error('❌ JSON 解析失败:', content)
        throw new Error(`JSON 解析失败: ${parseError}`)
      }
    })
  }
  
  /**
   * 流式生成文本
   */
  async streamText(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: StreamTextOptions
  ): Promise<string> {
    return this.withMetrics(async () => {
      const mergedOptions = mergeOptions(this.config, options)
      const messages = buildMessages(prompt, mergedOptions)
      
      console.log('🤖 豆包流式生成:', {
        prompt: prompt.substring(0, 100) + '...'
      })
      
      const { textStream } = await streamText({
        model: this.provider(this.config.modelId),
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: mergedOptions.temperature,
        maxTokens: mergedOptions.maxTokens,
        maxRetries: mergedOptions.maxRetries || 3,
      })
      
      let fullText = ''
      
      // 逐块处理流式输出
      for await (const chunk of textStream) {
        fullText += chunk
        onChunk(chunk)
        
        // 如果设置了延迟，等待一下（用于 UI 动画）
        if (mergedOptions.chunkDelay && mergedOptions.chunkDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, mergedOptions.chunkDelay))
        }
      }
      
      console.log('✅ 豆包流式生成完成，总长度:', fullText.length)
      return fullText
    })
  }
}

/**
 * 创建豆包适配器的工厂函数
 * 
 * @param apiKey - 豆包 API Key
 * @param modelId - 模型 ID（默认使用视觉模型）
 * @returns 豆包适配器实例
 */
export function createDoubaoAdapter(
  apiKey: string,
  modelId: string = 'doubao-seed-1-6-vision-250815'
): DoubaoAdapter {
  const config: ModelConfig = {
    name: 'doubao',
    provider: 'doubao',
    apiKey,
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId,
    defaultParams: {
      temperature: 0.7,
      maxTokens: 2000,
    },
    enabled: true,
    priority: 1
  }
  
  return new DoubaoAdapter(config)
}

