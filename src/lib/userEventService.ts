// ============================================
// 用户事件服务
// ============================================
// 用途：记录用户行为事件，管理会话
// ============================================

import { createClient } from '@/lib/supabase-client'
import type {
  EventCategory,
  EventAction,
  EntityType,
  ViewMode,
  CreateUserEventInput,
  CreateSessionInput,
  UpdateSessionInput,
  // Metadata 类型
  TaskCreatedMetadata,
  TaskCompletedMetadata,
  TaskMovedMetadata,
  ReflectionRoundStartedMetadata,
  QuestionShownMetadata,
  QuestionAnsweredMetadata,
  QuestionSkippedMetadata,
  RoundCompletedMetadata,
  ViewChangedMetadata,
  DateChangedMetadata,
  MessageSentMetadata,
  AIResponseMetadata,
  SessionStartedMetadata,
  SessionEndedMetadata
} from '@/types/user-event'

// ============================================
// 会话管理
// ============================================

/**
 * 创建新会话
 */
export async function createSession(input: CreateSessionInput): Promise<boolean> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        id: input.sessionId,
        user_id: input.userId,
        started_at: new Date().toISOString(),
        device_info: input.deviceInfo || {}
      })
    
    if (error) {
      console.error('❌ 创建会话失败:', error)
      return false
    }
    
    console.log('✅ 会话已创建:', input.sessionId)
    return true
  } catch (error) {
    console.error('❌ createSession 异常:', error)
    return false
  }
}

/**
 * 更新会话（结束时调用）
 */
export async function updateSession(input: UpdateSessionInput): Promise<boolean> {
  try {
    const supabase = createClient()
    
    const updateData: Record<string, any> = {}
    if (input.endedAt) updateData.ended_at = input.endedAt
    if (input.durationMs !== undefined) updateData.duration_ms = input.durationMs
    if (input.eventsCount !== undefined) updateData.events_count = input.eventsCount
    
    const { error } = await supabase
      .from('user_sessions')
      .update(updateData)
      .eq('id', input.sessionId)
    
    if (error) {
      console.error('❌ 更新会话失败:', error)
      return false
    }
    
    console.log('✅ 会话已更新:', input.sessionId)
    return true
  } catch (error) {
    console.error('❌ updateSession 异常:', error)
    return false
  }
}

// ============================================
// 核心事件记录函数
// ============================================

/**
 * 记录用户事件（通用函数）
 * 
 * @param input 事件参数
 * @returns 是否成功
 */
export async function logUserEvent(input: CreateUserEventInput): Promise<boolean> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_events')
      .insert({
        user_id: input.userId,
        session_id: input.sessionId,
        event_category: input.eventCategory,
        event_action: input.eventAction,
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
        entity_title: input.entityTitle || null,
        context_date: input.contextDate,
        view_mode: input.viewMode || null,
        duration_ms: input.durationMs || null,
        metadata: input.metadata || {}
      })
    
    if (error) {
      console.error(`❌ 记录事件失败 [${input.eventCategory}.${input.eventAction}]:`, error)
      return false
    }
    
    console.log(`✅ 事件已记录: ${input.eventCategory}.${input.eventAction}`)
    return true
  } catch (error) {
    console.error('❌ logUserEvent 异常:', error)
    return false
  }
}

// ============================================
// 便捷函数：任务模块
// ============================================

/**
 * 记录任务创建事件
 */
export function logTaskCreated(
  userId: string,
  sessionId: string,
  taskId: string,
  taskTitle: string,
  depth: number,
  contextDate: string,
  viewMode?: ViewMode,
  parentId?: string
): Promise<boolean> {
  const metadata: TaskCreatedMetadata = {
    depth,
    isParent: depth === 0,
    parentId
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'task',
    eventAction: 'created',
    entityType: 'task',
    entityId: taskId,
    entityTitle: taskTitle,
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录任务完成事件
 */
export function logTaskCompleted(
  userId: string,
  sessionId: string,
  taskId: string,
  taskTitle: string,
  contextDate: string,
  viewMode?: ViewMode,
  timeFromCreationMs?: number
): Promise<boolean> {
  const metadata: TaskCompletedMetadata = {
    timeFromCreationMs
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'task',
    eventAction: 'completed',
    entityType: 'task',
    entityId: taskId,
    entityTitle: taskTitle,
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录任务取消完成事件
 */
export function logTaskUncompleted(
  userId: string,
  sessionId: string,
  taskId: string,
  taskTitle: string,
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'task',
    eventAction: 'uncompleted',
    entityType: 'task',
    entityId: taskId,
    entityTitle: taskTitle,
    contextDate,
    viewMode,
    metadata: {}
  })
}

/**
 * 记录任务删除事件
 */
export function logTaskDeleted(
  userId: string,
  sessionId: string,
  taskId: string,
  taskTitle: string,
  contextDate: string
): Promise<boolean> {
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'task',
    eventAction: 'deleted',
    entityType: 'task',
    entityId: taskId,
    entityTitle: taskTitle,
    contextDate,
    metadata: {}
  })
}

/**
 * 记录任务移动事件（矩阵拖拽）
 */
export function logTaskMoved(
  userId: string,
  sessionId: string,
  taskId: string,
  taskTitle: string,
  fromQuadrant: string,
  toQuadrant: string,
  contextDate: string,
  x?: number,
  y?: number
): Promise<boolean> {
  const metadata: TaskMovedMetadata = {
    fromQuadrant,
    toQuadrant,
    x,
    y
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'task',
    eventAction: 'moved',
    entityType: 'task',
    entityId: taskId,
    entityTitle: taskTitle,
    contextDate,
    viewMode: 'matrix',
    metadata
  })
}

// ============================================
// 便捷函数：反思模块
// ============================================

/**
 * 记录反思轮次开始
 */
export function logReflectionRoundStarted(
  userId: string,
  sessionId: string,
  roundType: string,
  taskIds: string[],
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  const metadata: ReflectionRoundStartedMetadata = {
    roundType,
    taskIds,
    taskCount: taskIds.length
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'reflection',
    eventAction: 'round_started',
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录问题显示
 */
export function logQuestionShown(
  userId: string,
  sessionId: string,
  questionText: string,
  questionIndex: number,
  roundType: string,
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  const metadata: QuestionShownMetadata = {
    questionIndex,
    questionText,
    roundType
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'reflection',
    eventAction: 'question_shown',
    entityType: 'question',
    entityTitle: questionText.substring(0, 100), // 截断
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录问题回答
 */
export function logQuestionAnswered(
  userId: string,
  sessionId: string,
  questionText: string,
  answerText: string,
  roundType: string,
  contextDate: string,
  viewMode?: ViewMode,
  responseTimeMs?: number
): Promise<boolean> {
  const metadata: QuestionAnsweredMetadata = {
    answerText,
    answerLength: answerText.length,
    roundType,
    responseTimeMs
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'reflection',
    eventAction: 'question_answered',
    entityType: 'question',
    entityTitle: questionText.substring(0, 100),
    contextDate,
    viewMode,
    durationMs: responseTimeMs,
    metadata
  })
}

/**
 * 记录问题跳过
 */
export function logQuestionSkipped(
  userId: string,
  sessionId: string,
  questionText: string,
  roundType: string,
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  const metadata: QuestionSkippedMetadata = {
    questionText,
    roundType
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'reflection',
    eventAction: 'question_skipped',
    entityType: 'question',
    entityTitle: questionText.substring(0, 100),
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录反思轮次完成
 */
export function logReflectionRoundCompleted(
  userId: string,
  sessionId: string,
  roundType: string,
  answeredCount: number,
  totalCount: number,
  skippedCount: number,
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  const metadata: RoundCompletedMetadata = {
    roundType,
    answeredCount,
    totalCount,
    skippedCount
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'reflection',
    eventAction: 'round_completed',
    contextDate,
    viewMode,
    metadata
  })
}

// ============================================
// 便捷函数：导航模块
// ============================================

/**
 * 记录视图切换
 */
export function logViewChanged(
  userId: string,
  sessionId: string,
  fromMode: ViewMode,
  toMode: ViewMode,
  contextDate: string
): Promise<boolean> {
  const metadata: ViewChangedMetadata = {
    fromMode,
    toMode
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'navigation',
    eventAction: 'view_changed',
    contextDate,
    viewMode: toMode,
    metadata
  })
}

/**
 * 记录日期切换
 */
export function logDateChanged(
  userId: string,
  sessionId: string,
  fromDate: string,
  toDate: string,
  viewMode: ViewMode
): Promise<boolean> {
  const metadata: DateChangedMetadata = {
    fromDate,
    toDate
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'navigation',
    eventAction: 'date_changed',
    contextDate: toDate,
    viewMode,
    metadata
  })
}

/**
 * 记录矩阵维度切换
 */
export function logMatrixAxisChanged(
  userId: string,
  sessionId: string,
  xAxis: string,
  yAxis: string,
  contextDate: string,
  previousXAxis?: string,
  previousYAxis?: string
): Promise<boolean> {
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'navigation',
    eventAction: 'matrix_axis_changed',
    contextDate,
    viewMode: 'matrix',
    metadata: {
      xAxis,
      yAxis,
      previousXAxis,
      previousYAxis
    }
  })
}

// ============================================
// 便捷函数：聊天模块
// ============================================

/**
 * 记录消息发送
 */
export function logMessageSent(
  userId: string,
  sessionId: string,
  messageLength: number,
  isReflection: boolean,
  contextDate: string,
  viewMode?: ViewMode
): Promise<boolean> {
  const metadata: MessageSentMetadata = {
    messageLength,
    isReflection
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'chat',
    eventAction: 'message_sent',
    entityType: 'message',
    contextDate,
    viewMode,
    metadata
  })
}

/**
 * 记录 AI 响应
 */
export function logAIResponseReceived(
  userId: string,
  sessionId: string,
  responseTimeMs: number,
  contextDate: string,
  viewMode?: ViewMode,
  functionName?: string,
  tokenCount?: number
): Promise<boolean> {
  const metadata: AIResponseMetadata = {
    responseTimeMs,
    tokenCount,
    functionName
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'chat',
    eventAction: 'ai_response_received',
    contextDate,
    viewMode,
    durationMs: responseTimeMs,
    metadata
  })
}

// ============================================
// 便捷函数：会话模块
// ============================================

/**
 * 记录会话开始事件
 */
export function logSessionStarted(
  userId: string,
  sessionId: string,
  contextDate: string
): Promise<boolean> {
  const metadata: SessionStartedMetadata = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'session',
    eventAction: 'started',
    contextDate,
    metadata
  })
}

/**
 * 记录会话结束事件
 */
export function logSessionEnded(
  userId: string,
  sessionId: string,
  totalDurationMs: number,
  eventsCount: number,
  contextDate: string
): Promise<boolean> {
  const metadata: SessionEndedMetadata = {
    totalDurationMs,
    eventsCount
  }
  
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'session',
    eventAction: 'ended',
    contextDate,
    durationMs: totalDurationMs,
    metadata
  })
}

// ============================================
// 便捷函数：系统模块
// ============================================

/**
 * 记录错误事件
 */
export function logErrorOccurred(
  userId: string,
  sessionId: string,
  errorType: string,
  errorMessage: string,
  contextDate: string,
  stack?: string
): Promise<boolean> {
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'system',
    eventAction: 'error_occurred',
    contextDate,
    metadata: {
      errorType,
      errorMessage,
      stack
    }
  })
}

/**
 * 记录 AI 超时事件
 */
export function logAITimeout(
  userId: string,
  sessionId: string,
  functionName: string,
  timeoutMs: number,
  contextDate: string
): Promise<boolean> {
  return logUserEvent({
    userId,
    sessionId,
    eventCategory: 'system',
    eventAction: 'ai_timeout',
    contextDate,
    metadata: {
      functionName,
      timeoutMs
    }
  })
}
