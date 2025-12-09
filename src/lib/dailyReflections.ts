/**
 * 每日反思功能 - 数据库服务层 (CRUD)
 * 
 * 功能说明：
 * - 创建、查询、更新每日反思记录
 * - 随机抽取3个不重复的问题
 * - 支持中断恢复
 * - 分页查询历史记录
 */

import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'
import type { 
  DailyReflection, 
  CreateReflectionInput, 
  UpdateReflectionAnswer,
  CompleteReflectionInput,
  DAILY_REFLECTION_QUESTIONS 
} from '@/types/daily-reflection'
import { DAILY_REFLECTION_QUESTIONS as QUESTIONS } from '@/types/daily-reflection'

/**
 * 🎲 随机抽取3个不重复的问题
 * 
 * 算法：Fisher-Yates 洗牌算法
 * 
 * @returns 包含3个问题的数组
 */
export function getRandomQuestions(): [string, string, string] {
  // 创建问题索引数组 [0, 1, 2, 3, 4]
  const indices = Array.from({ length: QUESTIONS.length }, (_, i) => i)
  
  // Fisher-Yates 洗牌
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  
  // 取前3个索引对应的问题
  const selectedIndices = indices.slice(0, 3)
  const questions: [string, string, string] = [
    QUESTIONS[selectedIndices[0]],
    QUESTIONS[selectedIndices[1]],
    QUESTIONS[selectedIndices[2]]
  ]
  
  logger.debug('随机抽取的问题索引:', selectedIndices)
  logger.debug('随机抽取的问题:', questions)
  
  return questions
}

/**
 * 📅 获取今天的反思记录
 * 
 * @param userId - 用户ID
 * @param date - 日期（YYYY-MM-DD格式），默认为今天
 * @returns 反思记录或null
 */
export async function getTodayReflection(
  userId: string, 
  date?: string
): Promise<DailyReflection | null> {
  try {
    // 如果没有传入日期，使用今天的日期
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    logger.debug('查询反思记录:', { userId, date: targetDate })
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle()
    
    if (error) {
      logger.error('查询反思记录失败:', error)
      // 提供更详细的错误信息
      if (error.code === '42P01') {
        throw new Error('数据库表 daily_reflections 不存在，请先执行数据库迁移脚本')
      }
      throw new Error(`数据库查询失败: ${error.message || JSON.stringify(error)}`)
    }
    
    if (!data) {
      logger.debug('未找到反思记录')
      return null
    }
    
    logger.debug('找到反思记录:', data)
    return data as DailyReflection
  } catch (error: any) {
    logger.error('getTodayReflection 错误:', error)
    throw error
  }
}

/**
 * ✨ 创建新的每日反思会话
 * 
 * 会自动随机抽取3个问题并创建记录
 * 
 * @param userId - 用户ID
 * @param date - 日期（YYYY-MM-DD格式），默认为今天
 * @returns 新创建的反思记录
 */
export async function createDailyReflection(
  userId: string,
  date?: string
): Promise<DailyReflection> {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    // 随机抽取3个问题
    const [question1, question2, question3] = getRandomQuestions()
    
    logger.debug('创建反思记录:', { userId, date: targetDate, questions: [question1, question2, question3] })
    
    const input: CreateReflectionInput = {
      user_id: userId,
      date: targetDate,
      question_1: question1,
      question_2: question2,
      question_3: question3
    }
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .insert(input)
      .select()
      .single()
    
    if (error) {
      // 🔍 检查是否是唯一约束冲突（今天已有记录）
      if (error.code === '23505') {
        logger.debug('今天已有反思记录，唯一约束生效')
        throw new Error('DUPLICATE_REFLECTION')
      }
      
      // 提供更详细的错误信息
      logger.error('创建反思记录失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error: error
      })
      
      throw new Error(`创建失败: ${error.message || error.code || JSON.stringify(error)}`)
    }
    
    logger.debug('反思记录创建成功:', data)
    return data as DailyReflection
  } catch (error: any) {
    // 如果是已知的重复错误，直接抛出不记录
    if (error.message === 'DUPLICATE_REFLECTION') {
      throw error
    }
    
    logger.error('createDailyReflection 错误:', error)
    throw error
  }
}

/**
 * 💬 更新反思回答
 * 
 * @param reflectionId - 反思记录ID
 * @param questionIndex - 问题索引（1、2、3）
 * @param answer - 用户的回答
 * @returns 更新后的反思记录
 */
export async function updateReflectionAnswer(
  reflectionId: string,
  questionIndex: 1 | 2 | 3,
  answer: string
): Promise<DailyReflection> {
  try {
    logger.debug('更新反思回答:', { reflectionId, questionIndex, answer })
    
    // 构建更新对象
    const updates: any = {
      [`answer_${questionIndex}`]: answer,
      current_question_index: questionIndex
    }
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .update(updates)
      .eq('id', reflectionId)
      .select()
      .maybeSingle()  // 使用 maybeSingle 而不是 single
    
    if (error) {
      logger.error('更新反思回答失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`更新回答失败: ${error.message || error.code}`)
    }
    
    if (!data) {
      logger.error('更新反思回答失败: 未找到记录', { reflectionId })
      throw new Error(`未找到反思记录: ${reflectionId}`)
    }
    
    logger.debug('反思回答更新成功:', data)
    return data as DailyReflection
  } catch (error: any) {
    logger.error('updateReflectionAnswer 错误:', error)
    throw error
  }
}

/**
 * ✅ 完成反思并保存AI总结
 * 
 * @param reflectionId - 反思记录ID
 * @param aiSummary - AI生成的总结
 * @returns 更新后的反思记录
 */
export async function completeReflection(
  reflectionId: string,
  aiSummary: string
): Promise<DailyReflection> {
  try {
    logger.debug('完成反思:', { reflectionId, aiSummary: aiSummary.substring(0, 50) + '...' })
    
    const updates: CompleteReflectionInput = {
      ai_summary: aiSummary,
      status: 'completed',
      current_question_index: 3
    }
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .update(updates)
      .eq('id', reflectionId)
      .select()
      .maybeSingle()  // 使用 maybeSingle 而不是 single，避免 0 条记录时报错
    
    if (error) {
      logger.error('完成反思失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`完成反思失败: ${error.message || error.code}`)
    }
    
    if (!data) {
      logger.error('完成反思失败: 未找到记录', { reflectionId })
      throw new Error(`未找到反思记录: ${reflectionId}`)
    }
    
    logger.debug('反思完成成功:', data)
    return data as DailyReflection
  } catch (error: any) {
    logger.error('completeReflection 错误:', error)
    throw error
  }
}

/**
 * 📦 批量更新所有反思答案（优化版，减少数据库调用）
 * 
 * @param reflectionId - 反思记录ID
 * @param answers - 三个问题的答案数组
 * @returns 更新后的反思记录
 */
export async function batchUpdateReflectionAnswers(
  reflectionId: string,
  answers: [string | null, string | null, string | null]
): Promise<DailyReflection> {
  try {
    logger.debug('批量更新反思回答:', { reflectionId, answers })
    
    // 构建更新对象
    const updates: any = {
      answer_1: answers[0],
      answer_2: answers[1],
      answer_3: answers[2],
      current_question_index: 3 // 标记为已完成所有问题
    }
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .update(updates)
      .eq('id', reflectionId)
      .select()
      .maybeSingle()
    
    if (error) {
      logger.error('批量更新反思回答失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`批量更新回答失败: ${error.message || error.code}`)
    }
    
    if (!data) {
      logger.error('批量更新失败: 未找到记录', { reflectionId })
      throw new Error(`未找到反思记录: ${reflectionId}`)
    }
    
    logger.debug('批量更新成功:', data)
    return data as DailyReflection
  } catch (error) {
    logger.error('batchUpdateReflectionAnswers 错误:', error)
    throw error
  }
}

/**
 * ⏭️ 跳过当前问题（不保存回答）
 * 
 * @param reflectionId - 反思记录ID
 * @param questionIndex - 跳过的问题索引（1、2、3）
 * @returns 更新后的反思记录
 */
export async function skipReflectionQuestion(
  reflectionId: string,
  questionIndex: 1 | 2 | 3
): Promise<DailyReflection> {
  try {
    logger.debug('跳过问题:', { reflectionId, questionIndex })
    
    // 只更新 current_question_index，不保存回答
    const updates = {
      current_question_index: questionIndex
    }
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .update(updates)
      .eq('id', reflectionId)
      .select()
      .single()
    
    if (error) {
      logger.error('跳过问题失败:', error)
      throw error
    }
    
    logger.debug('问题跳过成功:', data)
    return data as DailyReflection
  } catch (error) {
    logger.error('skipReflectionQuestion 错误:', error)
    throw error
  }
}

/**
 * 📚 获取反思历史记录（分页）
 * 
 * @param userId - 用户ID
 * @param limit - 每页数量，默认10条
 * @param offset - 偏移量，默认0
 * @returns 反思记录数组
 */
export async function getReflectionHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<DailyReflection[]> {
  try {
    logger.debug('查询反思历史:', { userId, limit, offset })
    
    const { data, error } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')  // 只查询已完成的反思
      .order('date', { ascending: false })  // 按日期倒序
      .range(offset, offset + limit - 1)
    
    if (error) {
      logger.error('查询反思历史失败:', error)
      throw error
    }
    
    logger.debug(`查询到 ${data?.length || 0} 条反思记录`)
    return (data || []) as DailyReflection[]
  } catch (error) {
    logger.error('getReflectionHistory 错误:', error)
    throw error
  }
}

/**
 * 🔢 获取反思历史总数
 * 
 * @param userId - 用户ID
 * @returns 总记录数
 */
export async function getReflectionHistoryCount(userId: string): Promise<number> {
  try {
    logger.debug('查询反思历史总数:', { userId })
    
    const { count, error } = await supabase
      .from('daily_reflections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    if (error) {
      logger.error('查询反思历史总数失败:', error)
      throw error
    }
    
    logger.debug('反思历史总数:', count)
    return count || 0
  } catch (error) {
    logger.error('getReflectionHistoryCount 错误:', error)
    throw error
  }
}

/**
 * 🗑️ 删除反思记录（用于测试或用户主动删除）
 * 
 * @param reflectionId - 反思记录ID
 * @returns 是否删除成功
 */
export async function deleteReflection(reflectionId: string): Promise<boolean> {
  try {
    logger.debug('删除反思记录:', { reflectionId })
    
    const { error } = await supabase
      .from('daily_reflections')
      .delete()
      .eq('id', reflectionId)
    
    if (error) {
      logger.error('删除反思记录失败:', error)
      throw error
    }
    
    logger.debug('反思记录删除成功')
    return true
  } catch (error) {
    logger.error('deleteReflection 错误:', error)
    throw error
  }
}

/**
 * 📊 获取反思统计信息
 * 
 * @param userId - 用户ID
 * @returns 统计信息（总数、本周数量、本月数量等）
 */
export async function getReflectionStats(userId: string) {
  try {
    logger.debug('查询反思统计:', { userId })
    
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // 查询总数
    const { count: totalCount } = await supabase
      .from('daily_reflections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    // 查询本周数量
    const { count: weekCount } = await supabase
      .from('daily_reflections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('date', weekAgo)
    
    // 查询本月数量
    const { count: monthCount } = await supabase
      .from('daily_reflections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('date', monthAgo)
    
    const stats = {
      total: totalCount || 0,
      thisWeek: weekCount || 0,
      thisMonth: monthCount || 0
    }
    
    logger.debug('反思统计结果:', stats)
    return stats
  } catch (error) {
    logger.error('getReflectionStats 错误:', error)
    throw error
  }
}

