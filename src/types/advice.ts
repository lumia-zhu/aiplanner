/**
 * 任务执行建议相关类型定义
 * 
 * 功能：在用户完成任务操作后，基于用户画像和任务上下文，
 *      AI生成个性化的执行建议
 */

/**
 * 用户画像
 * 从用户个人资料中提取的关键信息
 */
export interface UserProfile {
  /** 用户专业（例如：计算机科学、市场营销） */
  major?: string
  
  /** 年级/学年（例如：大一、研二） */
  grade?: string
  
  /** 当前面临的挑战（例如：拖延症、时间管理困难） */
  challenges?: string[]
  
  /** 常去的场所（例如：图书馆、咖啡厅、健身房） */
  workplaces?: string[]
}

/**
 * 任务上下文
 * 工具执行相关的任务信息
 */
export interface TaskContext {
  /** 任务操作类型 */
  action: 'create' | 'update' | 'delete' | 'complete' | 'recurring'
  
  /** 任务标题 */
  taskTitle: string
  
  /** 任务日期（YYYY-MM-DD） */
  taskDate: string
  
  /** 任务是否已完成（仅对 complete 操作有效） */
  completed?: boolean
  
  /** 是否是周期性任务 */
  isRecurring?: boolean
  
  /** 受影响的日期数量（批量操作） */
  affectedDatesCount?: number
  
  /** 工具执行结果消息 */
  resultMessage: string
}

/**
 * 建议生成请求
 */
export interface AdviceRequest {
  /** 用户画像 */
  userProfile: UserProfile
  
  /** 任务上下文 */
  taskContext: TaskContext
  
  /** 当前时间（用于时间相关的建议，例如：早上 vs 晚上） */
  currentTime?: Date
}

/**
 * 建议生成结果
 */
export interface AdviceResult {
  /** 建议类型 */
  type: 'success' | 'skip' | 'error'
  
  /** 建议内容（1-2句话，简短实用） */
  content?: string
  
  /** 建议的语气/风格 */
  tone?: 'encouraging' | 'reminder' | 'tip' | 'celebration'
  
  /** 跳过原因（当 type='skip' 时） */
  skipReason?: string
  
  /** 错误信息（当 type='error' 时） */
  error?: string
}

/**
 * 建议配置
 * 用于控制建议生成的行为
 */
export interface AdviceConfig {
  /** 是否启用建议功能 */
  enabled: boolean
  
  /** 建议的最大长度（字符数） */
  maxLength: number
  
  /** 哪些操作类型需要生成建议 */
  enabledActions: Array<'create' | 'update' | 'delete' | 'complete' | 'recurring'>
  
  /** LLM 温度参数（0-1，越高越有创意） */
  temperature: number
}

/**
 * 默认建议配置
 */
export const DEFAULT_ADVICE_CONFIG: AdviceConfig = {
  enabled: true,
  maxLength: 100,
  enabledActions: ['create', 'complete', 'recurring'],  // 只对创建、完成、周期性任务生成建议
  temperature: 0.7
}

