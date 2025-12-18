/**
 * 每日反思功能 - TypeScript 类型定义
 * 
 * 功能说明：
 * - 每天从5个问题中随机抽取3个问题
 * - 用户逐个回答，支持跳过
 * - 支持中断恢复
 * - AI生成总结反馈
 */

/**
 * 反思状态
 * - in_progress: 反思进行中（未完成所有问题）
 * - completed: 反思已完成（所有问题已回答并生成AI总结）
 */
export type ReflectionStatus = 'in_progress' | 'completed'

/**
 * 每日反思记录（对应数据库 daily_reflections 表）
 */
export interface DailyReflection {
  id: string
  user_id: string
  date: string  // YYYY-MM-DD 格式
  
  // 问题和回答
  question_1: string
  answer_1: string | null
  
  question_2: string
  answer_2: string | null
  
  question_3: string
  answer_3: string | null
  
  // AI生成的总结
  ai_summary: string | null
  
  // 状态跟踪
  status: ReflectionStatus
  current_question_index: number  // 0-3
  
  // 时间戳
  created_at: string
  updated_at: string
}

/**
 * 创建每日反思的输入参数
 */
export interface CreateReflectionInput {
  user_id: string
  date: string  // YYYY-MM-DD 格式
  question_1: string
  question_2: string
  question_3: string
}

/**
 * 更新反思回答的输入参数
 */
export interface UpdateReflectionAnswer {
  question_index: 1 | 2 | 3  // 问题索引（1、2、3）
  answer: string  // 用户的回答内容
  current_question_index: number  // 更新后的当前问题索引
}

/**
 * 完成反思的输入参数
 */
export interface CompleteReflectionInput {
  ai_summary: string  // AI生成的总结
  status: 'completed'
  current_question_index: 3
}

/**
 * 问题-回答对（用于显示和处理）
 */
export interface QuestionAnswerPair {
  question: string
  answer: string | null
  questionIndex: 1 | 2 | 3
}

/**
 * 反思会话上下文（用于UI状态管理）
 */
export interface ReflectionContext {
  reflection: DailyReflection
  currentPair: QuestionAnswerPair | null  // 当前正在回答的问题
  isLastQuestion: boolean  // 是否是最后一个问题
  answeredCount: number  // 已回答的问题数量
}

/**
 * 每日反思问题池
 */
export const DAILY_REFLECTION_QUESTIONS = [
  "今天你的任务进展如何？有哪些完成得不错的？",
  "任务是否按你预期的方式进行？有什么偏差吗？",
  "今天有没有遇到意外的情况或惊喜？",
  "今天什么对你最有帮助？（工具、方法、人或想法）",
  "此刻你的精力和情绪状态如何？感觉怎么样？"
] as const

/**
 * 问题池类型
 */
export type DailyReflectionQuestion = typeof DAILY_REFLECTION_QUESTIONS[number]













