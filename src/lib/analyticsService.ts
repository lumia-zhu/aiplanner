// ============================================
// 用户交互分析服务
// ============================================
// 用途：记录用户行为事件，聚合统计数据
// ============================================

import { createClient } from '@/lib/supabase-client'
import type {
  EventType,
  EventData,
  ReflectionRoundType,
  UserInteractionEvent,
  DailyUserAnalytics,
  AnalyticsQueryParams
} from '@/types/analytics'

// ============================================
// 事件记录函数
// ============================================

/**
 * 记录用户交互事件（通用函数）
 * 
 * @param userId 用户ID
 * @param eventType 事件类型
 * @param eventData 事件数据
 * @param date 事件日期（可选，默认今天）
 */
export async function logEvent(
  userId: string,
  eventType: EventType,
  eventData: EventData,
  date?: string
): Promise<void> {
  try {
    const supabase = createClient()
    const eventDate = date || new Date().toISOString().split('T')[0]
    
    console.log(`📊 准备记录事件: ${eventType}, 日期: ${eventDate}, 用户: ${userId}`)
    
    const { data, error } = await supabase
      .from('user_interaction_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
        date: eventDate
      })
      .select()
    
    if (error) {
      console.error('❌ 记录事件失败:', error.message, error.code, error.details)
    } else {
      console.log(`✅ 事件已记录: ${eventType}`, { date: eventDate, data })
    }
  } catch (error) {
    console.error('❌ logEvent 异常:', error)
  }
}

// ============================================
// 便捷函数（特定事件类型）
// ============================================

/**
 * 记录消息发送事件
 * 
 * @param userId 用户ID
 * @param messageId 消息ID
 * @param isReflection 是否是反思消息
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logMessageSent(
  userId: string,
  messageId: string,
  isReflection: boolean,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'message_sent', {
    messageId,
    isReflection
  }, contextDate)
}

/**
 * 记录任务创建事件
 * 
 * @param userId 用户ID
 * @param taskId 任务ID
 * @param depth 任务层级（0=父任务，>0=子任务）
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logTaskCreated(
  userId: string,
  taskId: string,
  depth: number,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'task_created', {
    taskId,
    isParent: depth === 0,
    depth
  }, contextDate)
}

/**
 * 记录点击反思按钮事件
 * 
 * @param userId 用户ID
 * @param roundType 轮次类型
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logReflectionButtonClicked(
  userId: string,
  roundType: ReflectionRoundType,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'reflection_button_clicked', {
    roundType
  }, contextDate)
}

/**
 * 记录 AI 提问事件
 * 
 * @param userId 用户ID
 * @param questionId 问题ID
 * @param questionText 问题文本
 * @param roundType 轮次类型
 * @param questionCount 本轮问题总数
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logQuestionAsked(
  userId: string,
  questionId: string,
  questionText: string,
  roundType: string,
  questionCount: number,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'reflection_question_asked', {
    questionId,
    questionText,
    roundType,
    questionCount
  }, contextDate)
}

/**
 * 记录用户回答事件
 * 
 * @param userId 用户ID
 * @param questionId 问题ID
 * @param answerText 回答文本
 * @param roundType 轮次类型
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logQuestionAnswered(
  userId: string,
  questionId: string,
  answerText: string,
  roundType: string,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'reflection_question_answered', {
    questionId,
    answerText,
    roundType
  }, contextDate)
}

/**
 * 记录完成轮次事件（至少回答一个问题）
 * 
 * @param userId 用户ID
 * @param roundType 轮次类型
 * @param answeredCount 回答的问题数
 * @param totalCount 总问题数
 * @param contextDate 上下文日期（用户选择的日期）
 */
export async function logRoundCompleted(
  userId: string,
  roundType: string,
  answeredCount: number,
  totalCount: number,
  contextDate?: string
): Promise<void> {
  await logEvent(userId, 'reflection_round_completed', {
    roundType,
    answeredCount,
    totalCount
  }, contextDate)
}

// ============================================
// 查询函数
// ============================================

/**
 * 查询指定日期范围的事件
 * 
 * @param userId 用户ID
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getEvents(
  userId: string,
  startDate: string,
  endDate: string
): Promise<UserInteractionEvent[]> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('user_interaction_events')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('❌ 查询事件失败:', error)
      return []
    }
    
    return (data || []) as UserInteractionEvent[]
  } catch (error) {
    console.error('❌ getEvents 异常:', error)
    return []
  }
}

/**
 * 获取用户的每日统计数据
 * 
 * @param userId 用户ID
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getDailyAnalytics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyUserAnalytics[]> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('daily_user_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
    
    if (error) {
      console.error('❌ 查询统计数据失败:', error)
      return []
    }
    
    return (data || []) as DailyUserAnalytics[]
  } catch (error) {
    console.error('❌ getDailyAnalytics 异常:', error)
    return []
  }
}

// ============================================
// 聚合函数
// ============================================

/**
 * 聚合指定日期的统计数据
 * 
 * @param userId 用户ID
 * @param date 日期（YYYY-MM-DD）
 * @returns 聚合后的统计数据
 */
export async function aggregateDailyAnalytics(
  userId: string,
  date: string
): Promise<DailyUserAnalytics | null> {
  try {
    const supabase = createClient()
    
    console.log(`📊 开始聚合统计数据: userId=${userId}, date=${date}`)
    
    // 1️⃣ 查询当天的所有事件
    const { data: events, error: eventsError } = await supabase
      .from('user_interaction_events')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
    
    if (eventsError) {
      console.error('❌ 查询事件失败:', eventsError)
    }
    
    // 2️⃣ 查询当天 notes 中实际存在的任务（不受删除影响）
    const { data: tasks, error: tasksError } = await supabase
      .from('daily_tasks')
      .select('id, depth, parent_task_id')
      .eq('user_id', userId)
      .eq('note_date', date)
    
    if (tasksError) {
      console.error('❌ 查询任务失败:', tasksError)
    }
    
    // 如果既没有事件也没有任务，返回 null
    if ((!events || events.length === 0) && (!tasks || tasks.length === 0)) {
      console.log('⚠️ 当天没有事件和任务记录')
      return null
    }
    
    // 3️⃣ 初始化统计数据
    const analytics = {
      user_id: userId,
      date: date,
      
      // 对话统计
      total_messages: 0,
      reflection_messages: 0,
      normal_messages: 0,
      
      // 任务统计（直接从 daily_tasks 表统计）
      total_tasks: tasks?.length || 0,
      parent_tasks: tasks?.filter(t => (t.depth ?? 0) === 0).length || 0,
      child_tasks: tasks?.filter(t => (t.depth ?? 0) > 0).length || 0,
      
      // 交互类型统计
      clarity_completed: 0,
      decomposition_completed: 0,
      time_completed: 0,
      priority_completed: 0,
      
      // 响应率统计
      total_questions: 0,
      answered_questions: 0,
      ignored_questions: 0
    }
    
    console.log(`📊 任务统计: 总任务=${analytics.total_tasks}, 父任务=${analytics.parent_tasks}, 子任务=${analytics.child_tasks}`)
    
    // 4️⃣ 遍历事件进行统计（不包括 task_created）
    const completedRounds = new Set<string>()  // 记录已完成的轮次
    
    if (events && events.length > 0) {
      events.forEach((event: any) => {
        const eventData = event.event_data || {}
        
        switch (event.event_type) {
          case 'message_sent':
            analytics.total_messages++
            if (eventData.isReflection) {
              analytics.reflection_messages++
            } else {
              analytics.normal_messages++
            }
            break
          
          // 🆕 不再统计 task_created 事件，因为已经从数据库直接查询
          // case 'task_created': 
          //   (已移除)
          
          case 'reflection_question_asked':
            // 每显示一个问题卡片就算一个问题
            analytics.total_questions++
            break
          
          case 'reflection_question_answered':
            // 用户输入内容并提交才算已回答
            analytics.answered_questions++
            break
          
          case 'reflection_round_completed':
            const roundType = eventData.roundType
            if (roundType && !completedRounds.has(roundType)) {
              completedRounds.add(roundType)
              
              // 根据轮次类型增加计数
              switch (roundType) {
                case 'clarity':
                  analytics.clarity_completed++
                  break
                case 'decomposition':
                  analytics.decomposition_completed++
                  break
                case 'time':
                  analytics.time_completed++
                  break
                case 'priority':
                  analytics.priority_completed++
                  break
              }
            }
            break
        }
      })
    }
    
    // 4️⃣ 计算忽略的问题数
    analytics.ignored_questions = Math.max(
      0,
      analytics.total_questions - analytics.answered_questions
    )
    
    console.log('📊 统计结果:', analytics)
    
    // 5️⃣ 保存到汇总表（先查询再决定 insert 或 update）
    // 先检查是否已存在
    const { data: existing } = await supabase
      .from('daily_user_analytics')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single()
    
    let result: DailyUserAnalytics | null = null
    let saveError: any = null
    
    if (existing) {
      // 已存在，执行更新
      const { data, error } = await supabase
        .from('daily_user_analytics')
        .update({
          ...analytics,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', date)
        .select()
        .single()
      result = data as DailyUserAnalytics
      saveError = error
    } else {
      // 不存在，执行插入
      const { data, error } = await supabase
        .from('daily_user_analytics')
        .insert({
          ...analytics,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      result = data as DailyUserAnalytics
      saveError = error
    }
    
    if (saveError) {
      console.error('❌ 保存统计数据失败:', saveError, JSON.stringify(saveError))
      return null
    }
    
    console.log('✅ 统计数据已保存')
    return result
    
  } catch (error) {
    console.error('❌ aggregateDailyAnalytics 异常:', error)
    return null
  }
}

/**
 * 批量聚合指定日期范围的统计数据
 * 
 * @param userId 用户ID
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function aggregateMultipleDays(
  userId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  
  console.log(`📊 批量聚合 ${dates.length} 天的数据...`)
  
  for (const date of dates) {
    await aggregateDailyAnalytics(userId, date)
  }
  
  console.log('✅ 批量聚合完成')
}

// ============================================
// 导出函数
// ============================================

/**
 * 导出统计数据为 CSV 格式
 * 
 * @param analytics 统计数据数组
 * @returns CSV 字符串
 */
export function exportAnalyticsToCSV(
  analytics: DailyUserAnalytics[]
): string {
  // CSV 表头
  const headers = [
    '日期',
    '总消息数',
    '反思消息数',
    '普通消息数',
    '总任务数',
    '父任务数',
    '子任务数',
    '澄清完成数',
    '拆解完成数',
    '估时完成数',
    '排序完成数',
    '总问题数',
    '已回答数',
    '忽略数',
    '回答率(%)'
  ]
  
  // CSV 数据行
  const rows = analytics.map(a => [
    a.date,
    a.total_messages,
    a.reflection_messages,
    a.normal_messages,
    a.total_tasks,
    a.parent_tasks,
    a.child_tasks,
    a.clarity_completed,
    a.decomposition_completed,
    a.time_completed,
    a.priority_completed,
    a.total_questions,
    a.answered_questions,
    a.ignored_questions,
    a.total_questions > 0 
      ? ((a.answered_questions / a.total_questions) * 100).toFixed(2)
      : '0'
  ])
  
  // 组合 CSV
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  return csv
}

/**
 * 触发 CSV 文件下载
 * 
 * @param csv CSV 字符串
 * @param filename 文件名
 */
export function downloadCSV(csv: string, filename: string): void {
  // 添加 BOM 头，确保 Excel 正确识别 UTF-8
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}
