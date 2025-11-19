/**
 * 任务执行建议生成器
 * 
 * 功能：调用 LLM 根据用户画像和任务上下文生成个性化建议
 */

import type { AdviceRequest, AdviceResult, AdviceConfig } from '@/types/advice'
import { DEFAULT_ADVICE_CONFIG } from '@/types/advice'
import { buildCompleteAdvicePrompt } from './AdvicePrompts'
import { createDoubaoLLM } from '@/lib/llm/doubaoClient'

/**
 * 建议生成器类
 */
export class AdviceGenerator {
  private config: AdviceConfig
  
  constructor(config: Partial<AdviceConfig> = {}) {
    this.config = { ...DEFAULT_ADVICE_CONFIG, ...config }
  }
  
  /**
   * 生成建议
   */
  async generate(request: AdviceRequest): Promise<AdviceResult> {
    try {
      // 1. 检查是否启用
      if (!this.config.enabled) {
        return {
          type: 'skip',
          skipReason: '建议功能未启用'
        }
      }
      
      // 2. 检查操作类型是否需要生成建议
      if (!this.config.enabledActions.includes(request.taskContext.action)) {
        return {
          type: 'skip',
          skipReason: `操作类型 "${request.taskContext.action}" 不需要生成建议`
        }
      }
      
      // 3. 构建 Prompt
      const { systemPrompt, userPrompt } = buildCompleteAdvicePrompt(
        request.userProfile,
        request.taskContext,
        request.currentTime
      )
      
      console.log('🤔 生成任务建议中...')
      console.log('📝 用户画像:', request.userProfile)
      console.log('📋 任务上下文:', request.taskContext)
      
      // 4. 调用 LLM
      const llm = createDoubaoLLM()
      const response = await llm.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: this.config.temperature,
        max_tokens: 150  // 建议不需要太长
      })
      
      // 5. 提取建议内容
      const content = response.content.trim()
      
      // 6. 检查长度
      if (content.length > this.config.maxLength) {
        console.warn('⚠️ 建议内容过长，已截断')
        return {
          type: 'success',
          content: content.substring(0, this.config.maxLength) + '...',
          tone: this.inferTone(request.taskContext.action)
        }
      }
      
      console.log('✅ 建议生成成功:', content)
      
      return {
        type: 'success',
        content,
        tone: this.inferTone(request.taskContext.action)
      }
      
    } catch (error) {
      console.error('❌ 建议生成失败:', error)
      
      return {
        type: 'error',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }
  
  /**
   * 根据操作类型推断建议的语气
   */
  private inferTone(action: string): 'encouraging' | 'reminder' | 'tip' | 'celebration' {
    const toneMap: Record<string, 'encouraging' | 'reminder' | 'tip' | 'celebration'> = {
      create: 'tip',
      update: 'reminder',
      delete: 'reminder',
      complete: 'celebration',
      recurring: 'encouraging'
    }
    
    return toneMap[action] || 'tip'
  }
  
  /**
   * 批量生成建议（用于多个任务操作）
   */
  async generateBatch(requests: AdviceRequest[]): Promise<AdviceResult[]> {
    // 为了避免并发过多，串行生成
    const results: AdviceResult[] = []
    
    for (const request of requests) {
      const result = await this.generate(request)
      results.push(result)
      
      // 如果生成失败或跳过，后续的也跳过
      if (result.type !== 'success') {
        console.log('⏭️ 批量生成中断:', result.type)
        break
      }
    }
    
    return results
  }
}

/**
 * 创建建议生成器实例（单例）
 */
let generatorInstance: AdviceGenerator | null = null

export function getAdviceGenerator(config?: Partial<AdviceConfig>): AdviceGenerator {
  if (!generatorInstance) {
    generatorInstance = new AdviceGenerator(config)
  }
  return generatorInstance
}

/**
 * 快速生成建议（便捷函数）
 */
export async function generateAdvice(request: AdviceRequest): Promise<AdviceResult> {
  const generator = getAdviceGenerator()
  return await generator.generate(request)
}


