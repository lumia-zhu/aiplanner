/**
 * AI 服务统一入口
 * 
 * 提供统一的 AI 调用接口，支持：
 * - 多模型管理
 * - 自动降级
 * - 结果缓存
 * - 指标收集
 */

import type {
  IModelAdapter,
  ModelSelectionConfig,
  AIServiceConfig,
  CacheEntry,
  GenerateTextOptions,
  GenerateObjectOptions,
  StreamTextOptions
} from '@/types/workflow/adapter'

/**
 * 简单的内存缓存实现
 */
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultExpiry: number
  
  constructor(expiryMs: number = 5 * 60 * 1000) { // 默认 5 分钟
    this.defaultExpiry = expiryMs
  }
  
  /**
   * 设置缓存
   */
  set(key: string, value: T, expiryMs?: number): void {
    const now = new Date()
    const expiry = expiryMs || this.defaultExpiry
    
    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + expiry),
      hits: 0
    })
  }
  
  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // 检查是否过期
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    // 增加命中次数
    entry.hits++
    return entry.value
  }
  
  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear()
  }
  
  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size
  }
}

/**
 * AI 服务类
 * 
 * 统一管理所有 AI 模型适配器
 */
export class AIService {
  private adapters: Map<string, IModelAdapter>
  private selectionConfig: ModelSelectionConfig
  private textCache: SimpleCache<string>
  private objectCache: SimpleCache<any>
  private enableCache: boolean
  private enableLogging: boolean
  
  constructor(config?: Partial<AIServiceConfig>) {
    this.adapters = config?.adapters || new Map()
    // 默认使用豆包模型
    this.selectionConfig = config?.selectionConfig || {
      primaryModel: 'doubao-seed-1-6-vision-250815',  // 和对话使用相同的模型
      fallbackStrategy: 'none',
      maxRetries: 3,
      timeout: 30000 // 30 秒
    }
    this.enableCache = config?.enableCache ?? true
    this.enableLogging = config?.enableLogging ?? true
    this.textCache = new SimpleCache(config?.cacheExpiry)
    this.objectCache = new SimpleCache(config?.cacheExpiry)
    
    if (this.enableLogging) {
      console.log('🚀 AI 服务初始化完成', {
        enableCache: this.enableCache,
        primaryModel: this.selectionConfig.primaryModel
      })
    }
  }
  
  /**
   * 注册模型适配器
   */
  registerAdapter(adapter: IModelAdapter): void {
    this.adapters.set(adapter.name, adapter)
    
    if (this.enableLogging) {
      console.log(`✅ 注册适配器: ${adapter.name}`)
    }
  }
  
  /**
   * 设置主模型
   */
  setPrimaryModel(modelName: string): void {
    if (!this.adapters.has(modelName)) {
      throw new Error(`模型 ${modelName} 未注册`)
    }
    this.selectionConfig.primaryModel = modelName
    
    if (this.enableLogging) {
      console.log(`🔄 切换主模型: ${modelName}`)
    }
  }
  
  /**
   * 获取适配器
   */
  private getAdapter(modelName?: string): IModelAdapter {
    const name = modelName || this.selectionConfig.primaryModel
    const adapter = this.adapters.get(name)
    
    if (!adapter) {
      throw new Error(`模型 ${name} 未注册`)
    }
    
    return adapter
  }
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(
    method: string,
    prompt: string,
    options?: any
  ): string {
    const optionsStr = options ? JSON.stringify(options) : ''
    return `${method}:${prompt}:${optionsStr}`
  }
  
  /**
   * 生成文本（带缓存和降级）
   */
  async generateText(
    prompt: string,
    options?: GenerateTextOptions & { modelName?: string }
  ): Promise<string> {
    // 检查缓存
    if (this.enableCache) {
      const cacheKey = this.generateCacheKey('generateText', prompt, options)
      const cached = this.textCache.get(cacheKey)
      
      if (cached) {
        if (this.enableLogging) {
          console.log('💾 使用缓存结果')
        }
        return cached
      }
    }
    
    try {
      // 使用主模型
      const adapter = this.getAdapter(options?.modelName)
      const result = await adapter.generateText(prompt, options)
      
      // 缓存结果
      if (this.enableCache) {
        const cacheKey = this.generateCacheKey('generateText', prompt, options)
        this.textCache.set(cacheKey, result)
      }
      
      return result
      
    } catch (error) {
      if (this.enableLogging) {
        console.error('❌ 主模型调用失败:', error)
      }
      
      // 降级处理
      if (this.selectionConfig.fallbackStrategy === 'next' && 
          this.selectionConfig.fallbackModels && 
          this.selectionConfig.fallbackModels.length > 0) {
        
        for (const fallbackModel of this.selectionConfig.fallbackModels) {
          try {
            if (this.enableLogging) {
              console.log(`🔄 尝试降级模型: ${fallbackModel}`)
            }
            
            const adapter = this.getAdapter(fallbackModel)
            const result = await adapter.generateText(prompt, options)
            
            if (this.enableLogging) {
              console.log(`✅ 降级模型成功: ${fallbackModel}`)
            }
            
            return result
            
          } catch (fallbackError) {
            if (this.enableLogging) {
              console.error(`❌ 降级模型失败: ${fallbackModel}`, fallbackError)
            }
            continue
          }
        }
      }
      
      // 所有模型都失败了
      throw error
    }
  }
  
  /**
   * 生成结构化对象（带缓存）
   */
  async generateObject<T>(
    prompt: string,
    schema: any,
    options?: GenerateObjectOptions & { modelName?: string }
  ): Promise<T> {
    // 检查缓存
    if (this.enableCache) {
      const cacheKey = this.generateCacheKey('generateObject', prompt, { schema, ...options })
      const cached = this.objectCache.get(cacheKey)
      
      if (cached) {
        if (this.enableLogging) {
          console.log('💾 使用缓存结果')
        }
        return cached
      }
    }
    
    try {
      const adapter = this.getAdapter(options?.modelName)
      const result = await adapter.generateObject<T>(prompt, schema, options)
      
      // 缓存结果
      if (this.enableCache) {
        const cacheKey = this.generateCacheKey('generateObject', prompt, { schema, ...options })
        this.objectCache.set(cacheKey, result)
      }
      
      return result
      
    } catch (error) {
      if (this.enableLogging) {
        console.error('❌ 生成对象失败:', error)
      }
      throw error
    }
  }
  
  /**
   * 流式生成文本（不缓存）
   */
  async streamText(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: StreamTextOptions & { modelName?: string }
  ): Promise<string> {
    try {
      const adapter = this.getAdapter(options?.modelName)
      return await adapter.streamText(prompt, onChunk, options)
      
    } catch (error) {
      if (this.enableLogging) {
        console.error('❌ 流式生成失败:', error)
      }
      throw error
    }
  }
  
  /**
   * 获取所有适配器的指标
   */
  getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {}
    
    for (const [name, adapter] of this.adapters.entries()) {
      metrics[name] = adapter.getMetrics()
    }
    
    return metrics
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.textCache.clear()
    this.objectCache.clear()
    
    if (this.enableLogging) {
      console.log('🗑️ 缓存已清除')
    }
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): { textCacheSize: number; objectCacheSize: number } {
    return {
      textCacheSize: this.textCache.size(),
      objectCacheSize: this.objectCache.size()
    }
  }
}

/**
 * 创建默认的 AI 服务实例
 */
export function createAIService(doubaoApiKey: string): AIService {
  const service = new AIService({
    enableCache: true,
    cacheExpiry: 5 * 60 * 1000, // 5 分钟
    enableLogging: true,
    selectionConfig: {
      primaryModel: 'doubao-seed-1-6-vision-250815',
      fallbackStrategy: 'none',
      maxRetries: 3,
      timeout: 30000
    }
  })
  
  // 注册豆包适配器
  const { createDoubaoAdapter } = require('./doubao')
  const doubaoAdapter = createDoubaoAdapter(doubaoApiKey)
  service.registerAdapter(doubaoAdapter)
  
  return service
}



