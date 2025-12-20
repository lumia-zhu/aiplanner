/**
 * 任务上下文信息相关类型定义
 * 用于存储从反思问答中提取的任务背景、目标、资源等信息
 */

/**
 * 任务上下文信息
 */
export interface TaskContextInfo {
  id: string
  task_id: string
  content: string
  source: string
  source_question?: string
  source_answer?: string
  display_order: number
  created_at: string
  updated_at: string
}

/**
 * 添加上下文信息的请求
 */
export interface AddContextInfoRequest {
  task_id: string
  content: string
  source: string
  source_question?: string
  source_answer?: string
  display_order?: number
}

/**
 * 更新上下文信息的请求
 */
export interface UpdateContextInfoRequest {
  content?: string
  display_order?: number
}

/**
 * LLM 提取的上下文信息
 */
export interface ExtractedContext {
  content: string  // 提取的核心信息
}

/**
 * 问答对
 */
export interface QuestionAnswerPair {
  question: string
  answer: string
}








