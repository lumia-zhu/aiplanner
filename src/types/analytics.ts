// ============================================
// 用户交互分析 - 类型定义
// ============================================
// 用途：定义事件类型、事件数据、统计数据的 TypeScript 类型
// ============================================

/**
 * 事件类型枚举
 * 
 * - message_sent: 发送消息（包括用户和AI）
 * - task_created: 创建任务
 * - reflection_button_clicked: 点击反思按钮
 * - reflection_question_asked: AI 提出反思问题
 * - reflection_question_answered: 用户回答问题
 * - reflection_round_completed: 完成一轮反思（至少回答一个问题）
 */
export type EventType =
  | 'message_sent'
  | 'task_created'
  | 'reflection_button_clicked'
  | 'reflection_question_asked'
  | 'reflection_question_answered'
  | 'reflection_round_completed'

/**
 * 反思轮次类型
 */
export type ReflectionRoundType = 'clarity' | 'decomposition' | 'time' | 'priority'

/**
 * 事件数据接口（存储在 event_data JSONB 字段中）
 */
export interface EventData {
  // message_sent 事件
  isReflection?: boolean        // 是否是反思消息
  messageId?: string            // 消息ID
  
  // task_created 事件
  taskId?: string               // 任务ID
  isParent?: boolean            // 是否是父任务
  depth?: number                // 任务层级
  
  // reflection_button_clicked 事件
  roundType?: ReflectionRoundType  // 轮次类型
  
  // reflection_question_asked 事件
  questionId?: string           // 问题ID
  questionText?: string         // 问题文本
  questionCount?: number        // 本轮问了几个问题
  
  // reflection_question_answered 事件
  answerText?: string           // 回答文本
  
  // reflection_round_completed 事件
  answeredCount?: number        // 回答了几个问题
  totalCount?: number           // 总共几个问题
}

/**
 * 用户交互事件记录
 */
export interface UserInteractionEvent {
  id: string
  user_id: string
  event_type: EventType
  event_data: EventData | null
  date: string                  // YYYY-MM-DD 格式
  created_at: string
}

/**
 * 每日用户统计数据
 */
export interface DailyUserAnalytics {
  id: string
  user_id: string
  date: string                  // YYYY-MM-DD 格式
  
  // 📊 对话统计
  total_messages: number        // 总消息数
  reflection_messages: number   // 反思消息数
  normal_messages: number       // 普通对话消息数
  
  // 📊 任务统计
  total_tasks: number           // 总任务数
  parent_tasks: number          // 父任务数
  child_tasks: number           // 子任务数
  
  // 📊 交互类型统计（完成至少一次回答）
  clarity_completed: number     // 完成澄清交互的次数
  decomposition_completed: number  // 完成拆解交互的次数
  time_completed: number        // 完成估时交互的次数
  priority_completed: number    // 完成排序交互的次数
  
  // 📊 响应率统计
  total_questions: number       // AI 提出的问题总数
  answered_questions: number    // 用户回答的问题数
  ignored_questions: number     // 忽略的问题数
  
  created_at: string
  updated_at: string
}

/**
 * 用户统计汇总（跨天聚合）
 */
export interface UserAnalyticsSummary {
  user_id: string
  total_days: number            // 统计的天数
  
  // 汇总数据
  total_messages: number
  total_reflection_messages: number
  total_tasks: number
  total_parent_tasks: number
  total_child_tasks: number
  total_clarity_completed: number
  total_decomposition_completed: number
  total_time_completed: number
  total_priority_completed: number
  total_questions: number
  total_answered_questions: number
  total_ignored_questions: number
  answer_rate_percent: number   // 回答率百分比
}

/**
 * 统计查询参数
 */
export interface AnalyticsQueryParams {
  userId: string
  startDate: string             // YYYY-MM-DD 格式
  endDate: string               // YYYY-MM-DD 格式
}

/**
 * CSV 导出配置
 */
export interface CSVExportConfig {
  filename?: string             // 文件名（默认自动生成）
  dateRange: {
    start: string
    end: string
  }
  includeHeaders?: boolean      // 是否包含表头（默认 true）
}
