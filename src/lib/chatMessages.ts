/**
 * AI 对话消息管理模块
 * 用于存储和读取用户与 AI 助手的对话记录
 */

import { createClient } from '@/lib/supabase-client'
import type { ChatMessage } from '@/lib/doubaoService'

/**
 * 保存单条对话消息到数据库
 * @param userId - 用户ID
 * @param chatDate - 对话日期（格式：YYYY-MM-DD）
 * @param role - 消息角色：'user' 或 'assistant'
 * @param content - 消息内容（ChatMessage 的 content 数组）
 * @returns 成功返回 { success: true }，失败返回 { success: false, error: string }
 */
export async function saveChatMessage(
  userId: string,
  chatDate: string,
  role: 'user' | 'assistant',
  content: ChatMessage['content']
) {
  try {
    const insertData = {
      user_id: userId,
      chat_date: chatDate,
      role: role,
      content: content
    }
    
    console.log('💾 保存对话消息:', { 
      userId, 
      chatDate, 
      role, 
      contentLength: content.length,
      insertData: JSON.stringify(insertData).substring(0, 200) // 只显示前200个字符
    })
    
    const supabase = createClient()
    
    // 插入消息到数据库
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
      .select()
    
    if (error) {
      console.error('❌ 保存消息失败 - 详细错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      return { success: false, error: error.message || JSON.stringify(error) }
    }
    
    console.log('✅ 消息保存成功:', data)
    return { success: true }
    
  } catch (error) {
    console.error('❌ 保存消息异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
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
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
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
    
    // 先查询要删除的消息数量
    const { data: existingMessages, error: queryError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
    
    console.log('📊 查询到的消息数量:', existingMessages?.length || 0)
    
    if (queryError) {
      console.error('❌ 查询消息失败:', queryError)
    }
    
    // 如果没有消息，直接返回
    if (!existingMessages || existingMessages.length === 0) {
      console.log('ℹ️ 没有需要删除的消息')
      return { success: true, count: 0 }
    }
    
    console.log('🗑️ 开始删除操作...')
    console.log('🔍 删除条件:', {
      user_id: userId,
      chat_date: chatDate,
      messagesToDelete: existingMessages.map(m => m.id)
    })
    
    // 方案1: 按条件删除
    const { data, error, count: deletedCount } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('chat_date', chatDate)
      .select()
    
    console.log('🔍 删除操作结果:', {
      hasData: !!data,
      dataLength: data?.length || 0,
      deletedCount: deletedCount,
      hasError: !!error
    })
    
    if (error) {
      console.error('❌ 清空消息失败 - 详细错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      return { success: false, error: error.message || JSON.stringify(error), count: 0 }
    }
    
    const finalCount = data?.length || deletedCount || 0
    console.log(`✅ 已清空 ${finalCount} 条消息，实际删除的ID:`, data?.map(d => d.id))
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









