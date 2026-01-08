/**
 * AI 对话消息管理模块
 * 用于存储和读取用户与 AI 助手的对话记录
 * 
 * 更新日志：
 * - 2025-11-13: 添加全局对话支持（context_date 字段）
 * - 2026-01-08: 添加完整对话记录支持（message_type, session_id, metadata 字段）
 */

import { createClient } from '@/lib/supabase-client'
import type { ChatMessage, MessageContent } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 消息类型枚举
 */
export type ChatMessageType = 
  | 'text'                    // 普通文本消息
  | 'agent_thought'           // Agent 思考过程
  | 'agent_action'            // Agent 工具调用
  | 'agent_observation'       // Agent 观察结果
  | 'agent_need_input'        // Agent 需要用户输入
  | 'reflection_question'     // 反思问题
  | 'reflection_answer'       // 反思回答
  | 'reflection_summary'      // 反思总结
  | 'task_selection'          // 任务选择
  | 'task_decomposition'      // 任务拆解
  | 'daily_reflection'        // 每日反思
  | 'task_list'               // 任务列表
  | 'error'                   // 错误消息

/**
 * 扩展保存选项
 */
export interface SaveMessageOptions {
  contextDate?: string           // 上下文日期
  messageType?: ChatMessageType  // 消息类型
  sessionId?: string             // 会话 ID
  metadata?: Record<string, any> // 额外元数据
}

/**
 * 保存单条对话消息到数据库
 * @param userId - 用户ID
 * @param chatDate - 对话日期（格式：YYYY-MM-DD，可以是 'global' 表示全局对话）
 * @param role - 消息角色：'user' 或 'assistant'
 * @param content - 消息内容（ChatMessage 的 content 数组）
 * @param options - 可选参数：字符串（contextDate，向后兼容）或 SaveMessageOptions 对象
 * @returns 成功返回 { success: true, messageId?: string }，失败返回 { success: false, error: string }
 */
export async function saveChatMessage(
  userId: string,
  chatDate: string,
  role: 'user' | 'assistant',
  content: ChatMessage['content'],
  options?: string | SaveMessageOptions  // 兼容旧版本：字符串当作 contextDate
) {
  try {
    // 解析选项（兼容旧版本）
    const opts: SaveMessageOptions = typeof options === 'string' 
      ? { contextDate: options }
      : options || {}
    
    // 构建插入数据
    const insertData: Record<string, any> = {
      user_id: userId,
      chat_date: chatDate,
      role: role,
      content: content,
      context_date: opts.contextDate || chatDate
    }
    
    // 添加新字段（如果提供）
    if (opts.messageType) {
      insertData.message_type = opts.messageType
    }
    if (opts.sessionId) {
      insertData.session_id = opts.sessionId
    }
    if (opts.metadata && Object.keys(opts.metadata).length > 0) {
      insertData.metadata = opts.metadata
    }
    
    logger.debug('保存对话消息:', { 
      userId, 
      chatDate, 
      role, 
      messageType: opts.messageType || 'text',
      hasMetadata: !!opts.metadata
    })
    
    const supabase = createClient()
    
    // 插入消息到数据库
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
      .select('id')
      .single()
    
    if (error) {
      logger.error('保存消息失败:', error.message)
      return { success: false, error: error.message || JSON.stringify(error) }
    }
    
    logger.debug('消息保存成功:', { messageId: data?.id })
    return { success: true, messageId: data?.id }
    
  } catch (error) {
    console.error('❌ 保存消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 从消息内容推断消息类型
 * @param content - 消息内容数组
 * @returns 推断的消息类型
 */
export function inferMessageType(content: ChatMessage['content']): ChatMessageType {
  if (!content || content.length === 0) return 'text'
  
  for (const item of content) {
    if (item.type === 'interactive' && item.interactive) {
      const interactiveType = item.interactive.type
      switch (interactiveType) {
        case 'agent-thought':
          return 'agent_thought'
        case 'agent-action':
          return 'agent_action'
        case 'agent-observation':
          return 'agent_observation'
        case 'agent-need-input':
          return 'agent_need_input'
        case 'question-answer':
          return 'reflection_question'
        case 'reflection-qa-summary':
          return 'reflection_summary'
        case 'reflection-task-selection':
          return 'task_selection'
        case 'task-decomposition':
          return 'task_decomposition'
        case 'daily-reflection-question':
        case 'daily-reflection-complete':
          return 'daily_reflection'
        default:
          return 'text'
      }
    }
    if (item.type === 'task-list') {
      return 'task_list'
    }
  }
  
  return 'text'
}

/**
 * 获取某天的所有对话消息
 * @param userId - 用户ID
 * @param chatDate - 对话日期（格式：YYYY-MM-DD）
 * @returns 成功返回 { success: true, messages: ChatMessage[] }，失败返回 { success: false, error: string }
 */
export async function getChatMessages(
  userId: string,
  chatDate: string
) {
  try {
    console.log('📖 读取对话消息:', { userId, chatDate })
    
    const supabase = createClient()
    
    console.log('🔍 开始查询 chat_messages 表...')
    
    // 查询该用户该日期的所有消息，按创建时间排序
    // ✅ 软删除：只查询未被删除的消息
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    
    console.log('📊 查询结果:', { 
      hasData: !!data, 
      dataLength: data?.length || 0, 
      hasError: !!error 
    })
    
    if (error) {
      console.error('❌ 读取消息失败 - 详细错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      return { success: false, error: error.message || JSON.stringify(error), messages: [] }
    }
    
    // 将数据库格式转换为 ChatMessage 格式
    const messages: ChatMessage[] = data.map(row => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as ChatMessage['content']
    }))
    
    console.log(`✅ 读取到 ${messages.length} 条消息`)
    return { success: true, messages }
    
  } catch (error) {
    console.error('❌ 读取消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误',
      messages: []
    }
  }
}

/**
 * 清空某天的所有对话消息
 * @param userId - 用户ID
 * @param chatDate - 对话日期（格式：YYYY-MM-DD）
 * @returns 成功返回 { success: true, count: number }，失败返回 { success: false, error: string }
 */
export async function clearChatMessages(
  userId: string,
  chatDate: string
) {
  try {
    console.log('🗑️ 清空对话消息:', { userId, chatDate })
    
    const supabase = createClient()
    
    // 先查询要软删除的消息数量（只统计未删除的）
    const { data: existingMessages, error: queryError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
      .is('deleted_at', null)
    
    console.log('📊 查询到的未删除消息数量:', existingMessages?.length || 0)
    
    if (queryError) {
      console.error('❌ 查询消息失败:', queryError)
    }
    
    // 如果没有消息，直接返回
    if (!existingMessages || existingMessages.length === 0) {
      console.log('ℹ️ 没有需要删除的消息')
      return { success: true, count: 0 }
    }
    
    console.log('🗑️ 开始软删除操作...')
    console.log('🔍 软删除条件:', {
      user_id: userId,
      chat_date: chatDate,
      messagesToDelete: existingMessages.map(m => m.id)
    })
    
    // ✅ 软删除：标记 deleted_at 而不是真正删除
    const { data, error, count: deletedCount } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
      .is('deleted_at', null)
      .select()
    
    console.log('🔍 软删除操作结果:', {
      hasData: !!data,
      dataLength: data?.length || 0,
      deletedCount: deletedCount,
      hasError: !!error
    })
    
    if (error) {
      console.error('❌ 软删除消息失败 - 详细错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      return { success: false, error: error.message || JSON.stringify(error), count: 0 }
    }
    
    const finalCount = data?.length || deletedCount || 0
    console.log(`✅ 已软删除 ${finalCount} 条消息（数据保留在数据库），ID:`, data?.map(d => d.id))
    return { success: true, count: finalCount }
    
  } catch (error) {
    console.error('❌ 清空消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误',
      count: 0
    }
  }
}

/**
 * 获取用户有对话记录的所有日期列表
 * @param userId - 用户ID
 * @returns 成功返回 { success: true, dates: string[] }，失败返回 { success: false, error: string }
 */
export async function getChatDates(userId: string) {
  try {
    console.log('📅 获取对话日期列表:', { userId })
    
    const supabase = createClient()
    
    // 查询该用户所有不同的对话日期
    const { data, error } = await supabase
      .from('chat_messages')
      .select('chat_date')
      .eq('user_id', userId)
      .order('chat_date', { ascending: false })
    
    if (error) {
      console.error('❌ 获取日期列表失败:', error)
      return { success: false, error: error.message, dates: [] }
    }
    
    // 去重并转换为字符串数组
    const dates = [...new Set(data.map(row => row.chat_date))]
    
    console.log(`✅ 找到 ${dates.length} 个有对话的日期`)
    return { success: true, dates }
    
  } catch (error) {
    console.error('❌ 获取日期列表异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误',
      dates: []
    }
  }
}

/**
 * 获取用户的所有对话消息（全局查询，不按日期过滤）
 * 用于支持跨日期的全局对话功能
 * 
 * @param userId - 用户ID
 * @param options - 可选参数
 * @param options.limit - 限制返回的消息数量（默认：最近 100 条）
 * @param options.before - 返回此时间戳之前的消息（用于分页）
 * @returns 成功返回 { success: true, messages: ChatMessage[] }，失败返回 { success: false, error: string }
 */
export async function getAllChatMessages(
  userId: string,
  options?: {
    limit?: number
    before?: string  // ISO 时间戳
  }
) {
  try {
    const limit = options?.limit || 100  // 默认加载最近 100 条
    
    logger.debug('读取全局对话消息:', { userId, limit, before: options?.before })
    
    const supabase = createClient()
    
    // 查询该用户的所有消息，按创建时间排序
    // ✅ 软删除：只查询未被删除的消息
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    
    // 如果提供了 before 参数，用于分页加载
    if (options?.before) {
      query = query.lt('created_at', options.before)
    }
    
    // 限制数量
    query = query.limit(limit)
    
    const { data, error } = await query
    
    if (error) {
      logger.error('读取全局消息失败:', error.message)
      return { success: false, error: error.message || JSON.stringify(error), messages: [] }
    }
    
    // 将数据库格式转换为 ChatMessage 格式
    const messages: ChatMessage[] = data.map(row => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as ChatMessage['content'],
      // ✅ 附加上下文信息（可选）
      contextDate: row.context_date,
      createdAt: row.created_at
    }))
    
    logger.debug(`读取到 ${messages.length} 条全局消息`)
    return { success: true, messages }
    
  } catch (error) {
    logger.error('读取全局消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误',
      messages: []
    }
  }
}

/**
 * 清空用户的所有对话消息（全局清空）
 * 
 * @param userId - 用户ID
 * @returns 成功返回 { success: true, count: number }，失败返回 { success: false, error: string }
 */
export async function clearAllChatMessages(userId: string) {
  try {
    logger.info('清空全局对话消息:', { userId })
    
    const supabase = createClient()
    
    // 先查询要软删除的消息数量（只统计未删除的）
    const { data: existingMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
    
    if (!existingMessages || existingMessages.length === 0) {
      logger.debug('没有需要删除的消息')
      return { success: true, count: 0 }
    }
    
    // ✅ 软删除：标记 deleted_at 而不是真正删除
    const { error, count } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('deleted_at', null)
    
    if (error) {
      logger.error('软删除全局消息失败:', error.message)
      return { success: false, error: error.message, count: 0 }
    }
    
    const deletedCount = count || existingMessages.length
    logger.success(`已软删除 ${deletedCount} 条全局消息（数据保留在数据库）`)
    return { success: true, count: deletedCount }
    
  } catch (error) {
    logger.error('清空全局消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误',
      count: 0
    }
  }
}











