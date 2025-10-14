/**
 * AI 服务层统一导出
 * 
 * 导出所有 AI 相关的类和函数
 */

// 适配器基类和工具
export {
  BaseModelAdapter,
  MetricsCollector,
  buildMessages,
  mergeOptions
} from './adapter'

// 豆包适配器
export {
  DoubaoAdapter,
  createDoubaoAdapter
} from './doubao'

// AI 服务
export {
  AIService,
  createAIService
} from './service'

// Prompt 管理
export {
  BasePromptTemplate,
  PromptManager,
  promptManager
} from '../prompts/index'

// 任务分析 Prompts
export {
  ANALYZE_TASKS_V1,
  ANALYZE_TASKS_V2
} from '../prompts/analyze'

