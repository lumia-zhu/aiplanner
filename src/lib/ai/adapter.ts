/**
 * AI 模型适配器基础实现
 * 
 * 提供模型适配器的抽象基类和工具函数
 */

import type {
  ModelConfig,
  IModelAdapter,
  GenerateTextOptions,
  GenerateObjectOptions,
  StreamTextOptions,
  ModelMetrics
} from '@/types/workflow/adapter'

/**
 * 模型指标收集器
 * 
 * 用于记录和统计模型调用的各项指标
 */
export class MetricsCollector {
  private metrics: ModelMetrics = {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    successRate: 0,
    averageLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    totalTokens: 0
  }
  
  private latencies: number[] = []
  
  /**
   * 记录一次成功的调用
   */
  recordSuccess(latency: number, tokens?: number) {
    this.metrics.totalCalls++
    this.metrics.successCalls++
    this.latencies.push(latency)
    
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency)
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency)
    this.metrics.averageLatency = this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length
    this.metrics.successRate = this.metrics.successCalls / this.metrics.totalCalls
    this.metrics.lastCallAt = new Date()
    
    if (tokens) {
      this.metrics.totalTokens = (this.metrics.totalTokens || 0) + tokens
    }
  }
  
  /**
   * 记录一次失败的调用
   */
  recordFailure(error: Error) {
    this.metrics.totalCalls++
    this.metrics.failedCalls++
    this.metrics.successRate = this.metrics.successCalls / this.metrics.totalCalls
    this.metrics.lastError = {
      message: error.message,
      code: (error as any).code,
      timestamp: new Date()
    }
    this.metrics.lastCallAt = new Date()
  }
  
  /**
   * 获取当前指标
   */
  getMetrics(): ModelMetrics {
    return { ...this.metrics }
  }
  
  /**
   * 重置指标
   */
  reset() {
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      successRate: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      totalTokens: 0
    }
    this.latencies = []
  }
}

/**
 * 模型适配器抽象基类
 * 
 * 提供通用的指标收集和错误处理功能
 */
export abstract class BaseModelAdapter implements IModelAdapter {
  abstract readonly name: string
  abstract readonly config: ModelConfig
  
  protected metricsCollector: MetricsCollector
  
  constructor() {
    this.metricsCollector = new MetricsCollector()
  }
  
  /**
   * 执行带指标收集的操作
   */
  protected async withMetrics<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await operation()
      const latency = Date.now() - startTime
      this.metricsCollector.recordSuccess(latency)
      return result
    } catch (error) {
      this.metricsCollector.recordFailure(error as Error)
      throw error
    }
  }
  
  /**
   * 获取适配器指标
   */
  getMetrics(): ModelMetrics {
    return this.metricsCollector.getMetrics()
  }
  
  /**
   * 检查适配器是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 尝试发送一个简单的请求来测试可用性
      await this.generateText('test', { maxTokens: 1 })
      return true
    } catch {
      return false
    }
  }
  
  // 抽象方法，由子类实现
  abstract generateText(
    prompt: string,
    options?: GenerateTextOptions
  ): Promise<string>
  
  abstract generateObject<T>(
    prompt: string,
    schema: any,
    options?: GenerateObjectOptions
  ): Promise<T>
  
  abstract streamText(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: StreamTextOptions
  ): Promise<string>
}

/**
 * 构建消息数组
 * 
 * 将提示词和选项转换为标准的消息格式
 */
export function buildMessages(
  prompt: string,
  options?: GenerateTextOptions
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  
  // 添加系统提示词
  if (options?.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt
    })
  }
  
  // 添加历史消息
  if (options?.messages) {
    messages.push(...options.messages)
  }
  
  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: prompt
  })
  
  return messages
}

/**
 * 合并配置选项
 * 
 * 将用户选项与模型默认配置合并
 */
export function mergeOptions<T extends GenerateTextOptions>(
  modelConfig: ModelConfig,
  userOptions?: T
): T {
  return {
    ...modelConfig.defaultParams,
    ...userOptions
  } as T
}

