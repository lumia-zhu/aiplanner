// ============================================
// 用户事件数据收集 - TypeScript 类型定义
// ============================================
// 用途：定义事件类型、会话类型、数据结构
// ============================================

/**
 * 事件大类
 */
export type EventCategory = 
  | 'task'           // 任务操作
  | 'reflection'     // 反思交互
  | 'navigation'     // 导航切换
  | 'chat'           // 聊天消息
  | 'daily_review'   // 每日回顾
  | 'session'        // 会话生命周期
  | 'system'         // 系统事件

/**
 * 任务相关事件动作
 */
export type TaskEventAction = 
  | 'created'           // 创建任务
  | 'updated'           // 更新任务
  | 'completed'         // 完成任务
  | 'uncompleted'       // 取消完成
  | 'deleted'           // 删除任务
  | 'moved'             // 移动任务（矩阵拖拽）
  | 'time_estimated'    // 设置时间估算
  | 'deadline_set'      // 设置截止时间
  | 'deadline_cleared'  // 清除截止时间

/**
 * 反思相关事件动作
 */
export type ReflectionEventAction = 
  | 'round_started'      // 开始一轮反思
  | 'question_shown'     // 显示问题
  | 'question_answered'  // 回答问题
  | 'question_skipped'   // 跳过问题
  | 'round_completed'    // 完成一轮反思

/**
 * 导航相关事件动作
 */
export type NavigationEventAction = 
  | 'view_changed'        // 切换视图（notes/matrix）
  | 'date_changed'        // 切换日期
  | 'matrix_axis_changed' // 切换矩阵维度

/**
 * 聊天相关事件动作
 */
export type ChatEventAction = 
  | 'message_sent'         // 发送消息
  | 'ai_response_received' // AI 回复

/**
 * 每日回顾相关事件动作
 */
export type DailyReviewEventAction = 
  | 'started'            // 开始回顾
  | 'question_answered'  // 回答问题
  | 'question_skipped'   // 跳过问题
  | 'completed'          // 完成回顾

/**
 * 会话相关事件动作
 */
export type SessionEventAction = 
  | 'started'    // 会话开始
  | 'heartbeat'  // 心跳
  | 'ended'      // 会话结束

/**
 * 系统相关事件动作
 */
export type SystemEventAction = 
  | 'error_occurred'  // 发生错误
  | 'ai_timeout'      // AI 超时

/**
 * 所有事件动作（联合类型）
 */
export type EventAction = 
  | TaskEventAction
  | ReflectionEventAction
  | NavigationEventAction
  | ChatEventAction
  | DailyReviewEventAction
  | SessionEventAction
  | SystemEventAction

/**
 * 实体类型
 */
export type EntityType = 
  | 'task'      // 任务
  | 'question'  // 问题
  | 'note'      // 笔记
  | 'matrix'    // 矩阵
  | 'message'   // 消息

/**
 * 视图模式
 */
export type ViewMode = 'notes' | 'matrix'

// ============================================
// 数据库实体类型
// ============================================

/**
 * 用户会话（对应 user_sessions 表）
 */
export interface UserSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  events_count: number
  device_info: Record<string, any>
  created_at: string
}

/**
 * 用户事件（对应 user_events 表）
 */
export interface UserEvent {
  id: string
  user_id: string
  session_id: string
  
  event_category: EventCategory
  event_action: EventAction
  
  entity_type: EntityType | null
  entity_id: string | null
  entity_title: string | null
  
  context_date: string          // YYYY-MM-DD
  view_mode: ViewMode | null
  
  created_at: string
  duration_ms: number | null
  
  metadata: Record<string, any>
}

// ============================================
// 输入类型（用于创建记录）
// ============================================

/**
 * 创建会话的输入参数
 */
export interface CreateSessionInput {
  sessionId: string
  userId: string
  deviceInfo?: {
    userAgent?: string
    referrer?: string
    screenWidth?: number
    screenHeight?: number
  }
}

/**
 * 更新会话的输入参数
 */
export interface UpdateSessionInput {
  sessionId: string
  endedAt?: string
  durationMs?: number
  eventsCount?: number
}

/**
 * 创建事件的输入参数（通用）
 */
export interface CreateUserEventInput {
  userId: string
  sessionId: string
  eventCategory: EventCategory
  eventAction: EventAction
  entityType?: EntityType
  entityId?: string
  entityTitle?: string
  contextDate: string           // YYYY-MM-DD
  viewMode?: ViewMode
  durationMs?: number
  metadata?: Record<string, any>
}

// ============================================
// 特定事件的 Metadata 类型
// ============================================

/**
 * 任务创建事件的 metadata
 */
export interface TaskCreatedMetadata {
  depth: number
  isParent: boolean
  parentId?: string
}

/**
 * 任务完成事件的 metadata
 */
export interface TaskCompletedMetadata {
  timeFromCreationMs?: number   // 从创建到完成的时间
}

/**
 * 任务移动事件的 metadata
 */
export interface TaskMovedMetadata {
  fromQuadrant: string
  toQuadrant: string
  x?: number
  y?: number
}

/**
 * 反思轮次开始的 metadata
 */
export interface ReflectionRoundStartedMetadata {
  roundType: string             // clarity/decomposition/time/priority
  taskIds: string[]
  taskCount: number
}

/**
 * 问题显示的 metadata
 */
export interface QuestionShownMetadata {
  questionIndex: number
  questionText: string
  roundType: string
}

/**
 * 问题回答的 metadata
 */
export interface QuestionAnsweredMetadata {
  answerText: string
  answerLength: number
  roundType: string
  responseTimeMs?: number       // 用户输入时长
}

/**
 * 问题跳过的 metadata
 */
export interface QuestionSkippedMetadata {
  questionText: string
  roundType: string
}

/**
 * 轮次完成的 metadata
 */
export interface RoundCompletedMetadata {
  roundType: string
  answeredCount: number
  totalCount: number
  skippedCount: number
}

/**
 * 视图切换的 metadata
 */
export interface ViewChangedMetadata {
  fromMode: ViewMode
  toMode: ViewMode
}

/**
 * 日期切换的 metadata
 */
export interface DateChangedMetadata {
  fromDate: string
  toDate: string
}

/**
 * 消息发送的 metadata
 */
export interface MessageSentMetadata {
  messageLength: number
  isReflection: boolean
}

/**
 * AI 响应的 metadata
 */
export interface AIResponseMetadata {
  responseTimeMs: number
  tokenCount?: number
  functionName?: string
}

/**
 * 会话开始的 metadata
 */
export interface SessionStartedMetadata {
  userAgent?: string
  referrer?: string
}

/**
 * 会话结束的 metadata
 */
export interface SessionEndedMetadata {
  totalDurationMs: number
  eventsCount: number
}

/**
 * 错误事件的 metadata
 */
export interface ErrorOccurredMetadata {
  errorType: string
  errorMessage: string
  stack?: string
}
