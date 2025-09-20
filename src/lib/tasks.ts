import { createClient } from './supabase-client'
import type { Task } from '@/types'

// 任务相关的数据库操作

// 获取用户的所有任务（按优先级+截止日期排序）
export async function getUserTasks(userId: string): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: true }) // high=1, medium=2, low=3
      .order('deadline_time', { ascending: true, nullsLast: true })
    
    if (error) {
      return { error: error.message }
    }
    
    // 按照PRD要求的排序逻辑重新排序（针对当天任务）
    const sortedTasks = (data || []).sort((a, b) => {
      // 首先按优先级排序
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // 然后按截止时间排序
      if (!a.deadline_time && !b.deadline_time) return 0
      if (!a.deadline_time) return 1
      if (!b.deadline_time) return -1
      
      // 比较今天的时间
      const today = new Date().toISOString().split('T')[0]
      const aTime = new Date(`${today}T${a.deadline_time}`).getTime()
      const bTime = new Date(`${today}T${b.deadline_time}`).getTime()
      
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
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          user_id: userId,
          title: taskData.title,
          description: taskData.description || null,
          deadline_time: taskData.deadline_time || null,
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
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
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

// 检查任务是否过期（基于当天时间）
export function isTaskOverdue(task: Task): boolean {
  if (!task.deadline_time || task.completed) return false
  
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const taskDeadline = new Date(`${today}T${task.deadline_time}`)
  
  return taskDeadline < now
}
