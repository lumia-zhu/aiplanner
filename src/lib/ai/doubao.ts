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
  readonly name = 'doubao'
  readonly config: ModelConfig
  
  private provider: ReturnType<typeof createOpenAI>
  
  constructor(config: ModelConfig) {
    super()
    this.config = config
    
    // 创建 OpenAI 兼容的 provider
    this.provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
    })
    
    console.log(`✅ 豆包适配器初始化成功: ${config.modelId}`)
  }
  
  /**
   * 生成文本（非流式）
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
      
      const { text } = await generateText({
        model: this.provider(this.config.modelId),
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: mergedOptions.temperature,
        maxTokens: mergedOptions.maxTokens,
        maxRetries: mergedOptions.maxRetries || 3,
      })
      
      console.log('✅ 豆包文本生成完成，长度:', text.length)
      return text
    })
  }
  
  /**
   * 生成结构化对象（带 JSON Schema 验证）
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
      
      const { object } = await generateObject({
        model: this.provider(this.config.modelId),
        schema: schema,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: mergedOptions.temperature || 0.3, // 结构化输出使用更低的温度
        maxTokens: mergedOptions.maxTokens,
        maxRetries: mergedOptions.maxRetries || 3,
      })
      
      console.log('✅ 豆包对象生成完成')
      return object as T
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

