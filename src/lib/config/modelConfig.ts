/**
 * 🤖 AI 模型统一配置文件
 * 
 * 所有 AI 服务都从这里读取模型配置，方便统一管理和切换。
 * 
 * 使用方法：
 *   import { MODEL_CONFIG } from '@/lib/config/modelConfig'
 *   
 *   // 获取反思相关模型配置
 *   MODEL_CONFIG.reflection.model
 *   MODEL_CONFIG.reflection.endpoint
 *   
 *   // 获取通用模型配置
 *   MODEL_CONFIG.general.model
 *   MODEL_CONFIG.general.endpoint
 */

/**
 * 模型配置类型
 */
interface ModelEndpointConfig {
  /** API 端点地址 */
  endpoint: string
  /** 模型名称/ID */
  model: string
}

interface ModelConfigType {
  /** 反思相关功能使用的模型（需要更强的理解和生成能力） */
  reflection: ModelEndpointConfig
  /** 通用功能使用的模型（任务管理、对话、Agent 等） */
  general: ModelEndpointConfig
}

/**
 * AI 模型配置
 * 
 * - reflection: 用于反思问题生成、反思总结等需要深度理解的功能
 * - general: 用于任务拆解、时间估算、日常对话、Agent 等通用功能
 */
export const MODEL_CONFIG: ModelConfigType = {
  // 反思相关模型
  reflection: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-seed-1-8-251228'
  },
  
  // 通用任务模型
  general: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-seed-1-8-251228'
  }
}

/**
 * 获取当前使用的模型名称（用于日志显示）
 */
export function getModelDisplayName(type: 'reflection' | 'general'): string {
  const model = MODEL_CONFIG[type].model
  if (model.includes('deepseek')) {
    return 'Deepseek'
  } else if (model.includes('doubao-seed-1-8')) {
    return '豆包 Seed 1.8'
  } else if (model.includes('doubao')) {
    return '豆包 (Doubao)'
  }
  return model
}
