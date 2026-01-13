// ============================================
// 管理员统计服务
// ============================================
// 用途：管理员后台统计数据查询、聚合、导出
// ============================================

import { createClient } from '@/lib/supabase-client'
import { aggregateDailyAnalytics } from '@/lib/analyticsService'
import type { DailyUserAnalytics } from '@/types/analytics'

// ============================================
// 类型定义
// ============================================

/**
 * 用户信息（带基础统计）
 */
export interface UserWithStats {
  user_id: string
  username: string
  email?: string
  role?: string
  created_at?: string
}

/**
 * 聚合进度回调
 */
export type AggregationProgressCallback = (current: number, total: number, message: string) => void

/**
 * 聚合结果
 */
export interface AggregationResult {
  success: boolean
  processed: number
  failed: number
  message: string
}

/**
 * 统计概览
 */
export interface AnalyticsSummary {
  totalMessages: number
  reflectionMessages: number
  normalMessages: number
  totalTasks: number
  parentTasks: number
  childTasks: number
  totalQuestions: number
  answeredQuestions: number
  ignoredQuestions: number
  answerRate: number
  clarityCompleted: number
  decompositionCompleted: number
  timeCompleted: number
  priorityCompleted: number
}

// ============================================
// 用户管理
// ============================================

/**
 * 获取所有用户列表
 * 与聊天记录/笔记版本页面使用相同的查询逻辑
 * 
 * @returns 用户列表
 */
export async function getAllUsers(): Promise<UserWithStats[]> {
  try {
    const supabase = createClient()
    
    // 从 user_profiles 获取用户信息
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id, role, created_at')
    
    if (profilesError) {
      console.error('❌ 获取用户配置失败:', profilesError)
      return []
    }
    
    if (!profiles || profiles.length === 0) {
      return []
    }
    
    // 获取对应的用户名（与聊天记录/笔记版本页面相同的逻辑）
    const { data: usersData } = await supabase
      .from('users')
      .select('id, username')
      .in('id', profiles.map(p => p.user_id))
    
    // 构建用户映射
    const userMap = new Map<string, string>()
    if (usersData) {
      usersData.forEach(u => {
        userMap.set(u.id, u.username)
      })
    }
    
    // 合并数据
    return profiles.map(p => ({
      user_id: p.user_id,
      username: userMap.get(p.user_id) || `用户_${p.user_id.substring(0, 8)}`,
      role: p.role,
      created_at: p.created_at
    }))
    
  } catch (error) {
    console.error('❌ getAllUsers 异常:', error)
    return []
  }
}

// ============================================
// 统计数据查询
// ============================================

/**
 * 获取统计数据（支持单用户或全部用户）
 * 
 * @param userId 用户ID，'all' 表示所有用户
 * @param startDate 开始日期 (YYYY-MM-DD)
 * @param endDate 结束日期 (YYYY-MM-DD)
 * @returns 统计数据列表
 */
export async function getAnalyticsData(
  userId: string | 'all',
  startDate: string,
  endDate: string
): Promise<DailyUserAnalytics[]> {
  try {
    const supabase = createClient()
    
    let query = supabase
      .from('daily_user_analytics')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    
    // 如果指定了用户，添加筛选条件
    if (userId !== 'all') {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('❌ 获取统计数据失败:', error)
      return []
    }
    
    return (data || []) as DailyUserAnalytics[]
    
  } catch (error) {
    console.error('❌ getAnalyticsData 异常:', error)
    return []
  }
}

/**
 * 计算统计概览
 * 
 * @param data 统计数据列表
 * @returns 统计概览
 */
export function calculateSummary(data: DailyUserAnalytics[]): AnalyticsSummary {
  const summary: AnalyticsSummary = {
    totalMessages: 0,
    reflectionMessages: 0,
    normalMessages: 0,
    totalTasks: 0,
    parentTasks: 0,
    childTasks: 0,
    totalQuestions: 0,
    answeredQuestions: 0,
    ignoredQuestions: 0,
    answerRate: 0,
    clarityCompleted: 0,
    decompositionCompleted: 0,
    timeCompleted: 0,
    priorityCompleted: 0
  }
  
  for (const item of data) {
    summary.totalMessages += item.total_messages || 0
    summary.reflectionMessages += item.reflection_messages || 0
    summary.normalMessages += item.normal_messages || 0
    summary.totalTasks += item.total_tasks || 0
    summary.parentTasks += item.parent_tasks || 0
    summary.childTasks += item.child_tasks || 0
    summary.totalQuestions += item.total_questions || 0
    summary.answeredQuestions += item.answered_questions || 0
    summary.ignoredQuestions += item.ignored_questions || 0
    summary.clarityCompleted += item.clarity_completed || 0
    summary.decompositionCompleted += item.decomposition_completed || 0
    summary.timeCompleted += item.time_completed || 0
    summary.priorityCompleted += item.priority_completed || 0
  }
  
  // 计算回答率
  if (summary.totalQuestions > 0) {
    summary.answerRate = Math.round((summary.answeredQuestions / summary.totalQuestions) * 100)
  }
  
  return summary
}

// ============================================
// 数据聚合
// ============================================

/**
 * 生成日期范围内的所有日期
 */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  
  return dates
}

/**
 * 手动触发数据聚合
 * 
 * @param userId 用户ID，'all' 表示所有用户
 * @param startDate 开始日期 (YYYY-MM-DD)
 * @param endDate 结束日期 (YYYY-MM-DD)
 * @param onProgress 进度回调
 * @returns 聚合结果
 */
export async function runAggregation(
  userId: string | 'all',
  startDate: string,
  endDate: string,
  onProgress?: AggregationProgressCallback
): Promise<AggregationResult> {
  try {
    const dates = generateDateRange(startDate, endDate)
    let processed = 0
    let failed = 0
    
    // 获取要处理的用户列表
    let userIds: string[] = []
    
    if (userId === 'all') {
      const users = await getAllUsers()
      userIds = users.map(u => u.user_id)
    } else {
      userIds = [userId]
    }
    
    const totalTasks = userIds.length * dates.length
    let currentTask = 0
    
    console.log(`📊 开始聚合: ${userIds.length} 个用户, ${dates.length} 天, 共 ${totalTasks} 个任务`)
    
    // 遍历用户和日期
    for (const uid of userIds) {
      for (const date of dates) {
        currentTask++
        
        // 更新进度
        if (onProgress) {
          onProgress(currentTask, totalTasks, `正在处理 ${date}...`)
        }
        
        try {
          const result = await aggregateDailyAnalytics(uid, date)
          if (result) {
            processed++
          }
        } catch (error) {
          console.error(`❌ 聚合失败: userId=${uid}, date=${date}`, error)
          failed++
        }
      }
    }
    
    const message = `聚合完成: 成功 ${processed} 个, 失败 ${failed} 个`
    console.log(`✅ ${message}`)
    
    return {
      success: failed === 0,
      processed,
      failed,
      message
    }
    
  } catch (error) {
    console.error('❌ runAggregation 异常:', error)
    return {
      success: false,
      processed: 0,
      failed: 0,
      message: `聚合异常: ${error}`
    }
  }
}

// ============================================
// 数据导出
// ============================================

/**
 * 导出统计数据为 CSV（带用户名）
 * 
 * @param data 统计数据
 * @param users 用户列表（用于匹配用户名）
 * @returns CSV 字符串
 */
export function exportAnalyticsWithUsernames(
  data: DailyUserAnalytics[],
  users: UserWithStats[]
): string {
  // 创建用户ID到用户名的映射
  const userMap = new Map(users.map(u => [u.user_id, u.username]))
  
  // CSV 表头
  const headers = [
    '日期',
    '用户名',
    '用户ID',
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
  const rows = data.map(a => [
    a.date,
    userMap.get(a.user_id) || '未知用户',
    a.user_id,
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
