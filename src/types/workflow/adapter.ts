/**
 * AI 模型适配器类型定义
 * 
 * 本文件定义了 AI 模型适配器系统的类型，包括：
 * - 模型配置
 * - 模型适配器接口
 * - 模型指标
 */

/**
 * AI 模型提供商
 */
export type ModelProvider = 'doubao' | 'openai' | 'anthropic' | 'custom'

/**
 * AI 模型配置
 */
export interface ModelConfig {
  /** 模型唯一名称 */
  name: string
  
  /** 提供商 */
  provider: ModelProvider
  
  /** API 密钥 */
  apiKey: string
  
  /** API 基础 URL（可选，用于兼容接口） */
  baseURL?: string
  
  /** 模型 ID */
  modelId: string
  
  /** 默认参数 */
  defaultParams?: {
    temperature?: number
    maxTokens?: number
    topP?: number
    presencePenalty?: number
    frequencyPenalty?: number
  }
  
  /** 是否启用 */
  enabled?: boolean
  
  /** 优先级（数字越小优先级越高） */
  priority?: number
}

/**
 * AI 模型适配器接口
 * 
 * 所有模型适配器都需要实现这个接口，提供统一的调用方式
 */
export interface IModelAdapter {
  /** 适配器名称 */
  readonly name: string
  
  /** 模型配置 */
  readonly config: ModelConfig
  
  /**
   * 生成文本（非流式）
   * 
   * @param prompt - 提示词
   * @param options - 可选参数
   * @returns 生成的文本
   */
  generateText(
    prompt: string, 
    options?: GenerateTextOptions
  ): Promise<string>
  
  /**
   * 生成结构化对象（带 JSON Schema 验证）
   * 
   * @param prompt - 提示词
   * @param schema - Zod schema
   * @param options - 可选参数
   * @returns 结构化对象
   */
  generateObject<T>(
    prompt: string,
    schema: any,
    options?: GenerateObjectOptions
  ): Promise<T>
  
  /**
   * 流式生成文本
   * 
   * @param prompt - 提示词
   * @param onChunk - 每个 chunk 的回调
   * @param options - 可选参数
   * @returns 完整文本
   */
  streamText(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: StreamTextOptions
  ): Promise<string>
  
  /**
   * 检查适配器是否可用
   * 
   * @returns 是否可用
   */
  isAvailable(): Promise<boolean>
  
  /**
   * 获取适配器指标
   * 
   * @returns 指标对象
   */
  getMetrics(): ModelMetrics
}

/**
 * 生成文本的选项
 */
export interface GenerateTextOptions {
  /** 温度（0-2，越高越随机） */
  temperature?: number
  
  /** 最大 token 数 */
  maxTokens?: number
  
  /** 系统提示词 */
  systemPrompt?: string
  
  /** 对话历史 */
  messages?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  
  /** 停止词 */
  stop?: string[]
  
  /** 超时时间（ms） */
  timeout?: number
  
  /** 最大重试次数 */
  maxRetries?: number
}

/**
 * 生成对象的选项
 */
export interface GenerateObjectOptions extends Omit<GenerateTextOptions, 'stop'> {
  /** 是否严格模式（必须完全符合 schema） */
  strictMode?: boolean
}

/**
 * 流式生成的选项
 */
export interface StreamTextOptions extends GenerateTextOptions {
  /** 是否在每个 chunk 后延迟（ms） */
  chunkDelay?: number
}

/**
 * AI 模型指标
 * 
 * 用于监控和优化模型使用
 */
export interface ModelMetrics {
  /** 总调用次数 */
  totalCalls: number
  
  /** 成功调用次数 */
  successCalls: number
  
  /** 失败调用次数 */
  failedCalls: number
  
  /** 成功率（0-1） */
  successRate: number
  
  /** 平均延迟（ms） */
  averageLatency: number
  
  /** 最小延迟（ms） */
  minLatency: number
  
  /** 最大延迟（ms） */
  maxLatency: number
  
  /** 最后一次错误 */
  lastError?: {
    message: string
    code?: string
    timestamp: Date
  }
  
  /** 总 token 使用量 */
  totalTokens?: number
  
  /** 最后调用时间 */
  lastCallAt?: Date
}

/**
 * 模型切换策略
 */
export type FallbackStrategy = 
  | 'none'        // 不降级，失败即返回错误
  | 'next'        // 切换到下一个可用模型
  | 'cheapest'    // 切换到最便宜的模型
  | 'fastest'     // 切换到最快的模型
  | 'custom'      // 自定义策略

/**
 * 模型选择策略配置
 */
export interface ModelSelectionConfig {
  /** 主模型 */
  primaryModel: string
  
  /** 备用模型列表（按优先级） */
  fallbackModels?: string[]
  
  /** 降级策略 */
  fallbackStrategy: FallbackStrategy
  
  /** 自定义降级函数 */
  customFallback?: (
    error: Error,
    attemptedModels: string[]
  ) => string | null
  
  /** 失败后的重试次数 */
  maxRetries?: number
  
  /** 超时时间（ms） */
  timeout?: number
}

/**
 * AI 服务配置
 */
export interface AIServiceConfig {
  /** 已注册的适配器 */
  adapters: Map<string, IModelAdapter>
  
  /** 模型选择配置 */
  selectionConfig: ModelSelectionConfig
  
  /** 是否启用缓存 */
  enableCache?: boolean
  
  /** 缓存过期时间（ms） */
  cacheExpiry?: number
  
  /** 是否启用指标收集 */
  enableMetrics?: boolean
  
  /** 是否启用日志 */
  enableLogging?: boolean
}

/**
 * 缓存键生成函数类型
 */
export type CacheKeyGenerator = (
  prompt: string,
  options?: any
) => string

/**
 * 缓存项
 */
export interface CacheEntry<T = any> {
  /** 缓存的值 */
  value: T
  
  /** 创建时间 */
  createdAt: Date
  
  /** 过期时间 */
  expiresAt: Date
  
  /** 命中次数 */
  hits: number
}

