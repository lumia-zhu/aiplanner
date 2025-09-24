import { createClient } from './supabase-client'
import type { Task } from '@/types'

// 任务相关的数据库操作

// 获取用户的所有任务（按优先级+截止时间排序）
export async function getUserTasks(userId: string): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: true }) // high=1, medium=2, low=3
      .order('deadline_datetime', { ascending: true, nullsLast: true })
    
    if (error) {
      return { error: error.message }
    }
    
    // 按照PRD要求的排序逻辑重新排序
    const sortedTasks = (data || []).sort((a, b) => {
      // 首先按优先级排序
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // 然后按截止时间排序
      if (!a.deadline_datetime && !b.deadline_datetime) return 0
      if (!a.deadline_datetime) return 1
      if (!b.deadline_datetime) return -1
      
      // 直接比较时间戳
      const aTime = new Date(a.deadline_datetime).getTime()
      const bTime = new Date(b.deadline_datetime).getTime()
      
      return aTime - bTime
    })
    
    return { tasks: sortedTasks }
  } catch (error) {
    return { error: '获取任务失败' }
  }
}

// 创建新任务
export async function createTask(
  userId: string,
  taskData: {
    title: string
    description?: string
    deadline_time?: string
    priority: 'low' | 'medium' | 'high'
  }
): Promise<{ task?: Task; error?: string }> {
  try {
    const supabase = createClient()
    
    // 处理截止时间，支持两种格式：
    // 1. 完整日期时间格式（如：2025-09-24T23:59:00）- 来自TaskForm和Canvas导入
    // 2. 仅时间格式（如：16:00）- 来自Outlook导入
    let deadlineDateTime = null
    if (taskData.deadline_time) {
      try {
        if (taskData.deadline_time.includes('T')) {
          // 完整的日期时间格式，直接使用
          const localDateTime = new Date(taskData.deadline_time)
          deadlineDateTime = localDateTime.toISOString()
        } else if (taskData.deadline_time.match(/^\d{1,2}:\d{2}$/)) {
          // 仅时间格式（HH:MM），组合今天的日期
          const today = new Date()
          const [hours, minutes] = taskData.deadline_time.split(':')
          const localDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes))
          deadlineDateTime = localDateTime.toISOString()
        } else {
          // 尝试直接解析
          const localDateTime = new Date(taskData.deadline_time)
          if (!isNaN(localDateTime.getTime())) {
            deadlineDateTime = localDateTime.toISOString()
          }
        }
      } catch (error) {
        console.warn('解析截止时间失败:', taskData.deadline_time, error)
      }
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          user_id: userId,
          title: taskData.title,
          description: taskData.description || null,
          deadline_datetime: deadlineDateTime,
          priority: taskData.priority,
          completed: false
        }
      ])
      .select()
      .single()
    
    if (error) {
      return { error: error.message }
    }
    
    return { task: data }
  } catch (error) {
    return { error: '创建任务失败' }
  }
}

// 更新任务
export async function updateTask(
  taskId: string,
  updates: {
    title?: string
    description?: string
    deadline_time?: string
    priority?: 'low' | 'medium' | 'high'
    completed?: boolean
  }
): Promise<{ task?: Task; error?: string }> {
  try {
    const supabase = createClient()
    
    // 准备更新数据
    const updateData: any = { ...updates }
    
    // 如果更新了截止时间，需要转换为完整的日期时间
    if (updates.deadline_time !== undefined) {
      if (updates.deadline_time) {
        try {
          if (updates.deadline_time.includes('T')) {
            // 完整的日期时间格式，直接使用
            const localDateTime = new Date(updates.deadline_time)
            updateData.deadline_datetime = localDateTime.toISOString()
          } else if (updates.deadline_time.match(/^\d{1,2}:\d{2}$/)) {
            // 仅时间格式（HH:MM），组合今天的日期
            const today = new Date()
            const [hours, minutes] = updates.deadline_time.split(':')
            const localDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes))
            updateData.deadline_datetime = localDateTime.toISOString()
          } else {
            // 尝试直接解析
            const localDateTime = new Date(updates.deadline_time)
            if (!isNaN(localDateTime.getTime())) {
              updateData.deadline_datetime = localDateTime.toISOString()
            } else {
              updateData.deadline_datetime = null
            }
          }
        } catch (error) {
          console.warn('解析截止时间失败:', updates.deadline_time, error)
          updateData.deadline_datetime = null
        }
      } else {
        updateData.deadline_datetime = null
      }
      // 删除原始的 deadline_time 字段，因为数据库中没有这个字段
      delete updateData.deadline_time
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()
    
    if (error) {
      return { error: error.message }
    }
    
    return { task: data }
  } catch (error) {
    return { error: '更新任务失败' }
  }
}

// 删除任务
export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
    
    if (error) {
      return { error: error.message }
    }
    
    return {}
  } catch (error) {
    return { error: '删除任务失败' }
  }
}

// 切换任务完成状态
export async function toggleTaskComplete(taskId: string, completed: boolean): Promise<{ task?: Task; error?: string }> {
  return updateTask(taskId, { completed })
}

// 检查任务是否过期
export function isTaskOverdue(task: Task): boolean {
  if (!task.deadline_datetime || task.completed) return false
  
  const now = new Date()
  const taskDeadline = new Date(task.deadline_datetime)
  
  return taskDeadline < now
}
