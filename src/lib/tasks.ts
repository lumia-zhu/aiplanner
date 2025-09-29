import { createClient } from './supabase-client'
import type { Task, SubtaskSuggestion } from '@/types'

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
      .order('deadline_datetime', { ascending: true, nullsFirst: false })
    
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
    parent_id?: string
    estimated_duration?: string
    subtask_order?: number
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
          completed: false,
          parent_id: taskData.parent_id || null,
          estimated_duration: taskData.estimated_duration || null,
          subtask_order: taskData.subtask_order || 0,
          is_expanded: false
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

// ===== 任务拆解相关功能 =====

// 获取用户的所有任务（包含子任务层级结构）
export async function getUserTasksWithSubtasks(userId: string): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    // 获取所有任务（包括子任务）
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('parent_id', { ascending: true, nullsFirst: true }) // 先父任务后子任务
      .order('subtask_order', { ascending: true }) // 子任务按顺序排列
      .order('priority', { ascending: true }) // 同级任务按优先级
      .order('deadline_datetime', { ascending: true, nullsFirst: false })
    
    if (error) {
      return { error: error.message }
    }
    
    // 构建任务树结构
    const tasks = buildTaskTree(data || [])
    
    return { tasks }
  } catch (error) {
    return { error: '获取任务失败' }
  }
}

// 构建任务树结构（将扁平数组转换为层级结构）
function buildTaskTree(flatTasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>()
  const rootTasks: Task[] = []
  
  // 第一遍：创建任务映射
  flatTasks.forEach(task => {
    taskMap.set(task.id, { ...task, subtasks: [] })
  })
  
  // 第二遍：构建父子关系
  flatTasks.forEach(task => {
    const taskNode = taskMap.get(task.id)!
    
    if (task.parent_id) {
      // 这是子任务，添加到父任务的subtasks中
      const parent = taskMap.get(task.parent_id)
      if (parent) {
        parent.subtasks = parent.subtasks || []
        parent.subtasks.push(taskNode)
      }
    } else {
      // 这是顶级任务
      rootTasks.push(taskNode)
    }
  })
  
  // 对每个层级进行排序
  const sortTasks = (tasks: Task[]) => {
    return tasks.sort((a, b) => {
      // 按优先级排序
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // 子任务按subtask_order排序
      if (a.parent_id && b.parent_id && a.parent_id === b.parent_id) {
        return (a.subtask_order || 0) - (b.subtask_order || 0)
      }
      
      // 按截止时间排序
      if (!a.deadline_datetime && !b.deadline_datetime) return 0
      if (!a.deadline_datetime) return 1
      if (!b.deadline_datetime) return -1
      
      const aTime = new Date(a.deadline_datetime).getTime()
      const bTime = new Date(b.deadline_datetime).getTime()
      
      return aTime - bTime
    })
  }
  
  // 递归排序所有层级
  const sortRecursively = (tasks: Task[]): Task[] => {
    const sorted = sortTasks(tasks)
    sorted.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks = sortRecursively(task.subtasks)
      }
    })
    return sorted
  }
  
  return sortRecursively(rootTasks)
}

// 批量创建子任务
export async function createSubtasks(
  parentId: string,
  userId: string,
  subtasks: SubtaskSuggestion[]
): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    console.log('🔧 开始创建子任务:', { parentId, userId, subtasksCount: subtasks.length })
    
    // 准备子任务数据
    const subtaskData = subtasks
      .filter(subtask => subtask.is_selected)
      .map((subtask, index) => ({
        user_id: userId,
        title: subtask.title.trim(),
        description: subtask.description?.trim() || null,
        priority: subtask.priority,
        parent_id: parentId,
        subtask_order: subtask.order || index + 1,
        estimated_duration: subtask.estimated_duration?.trim() || null,
        completed: false,
        is_expanded: false
      }))
    
    console.log('📋 准备插入的子任务数据:', subtaskData)
    
    if (subtaskData.length === 0) {
      return { error: '没有选中的子任务' }
    }
    
    // 验证父任务是否存在
    const { data: parentTask, error: parentError } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', parentId)
      .eq('user_id', userId)
      .single()
    
    if (parentError || !parentTask) {
      console.error('父任务验证失败:', parentError)
      return { error: '父任务不存在或无权限访问' }
    }
    
    // 批量插入子任务
    const { data, error } = await supabase
      .from('tasks')
      .insert(subtaskData)
      .select()
    
    if (error) {
      console.error('插入子任务失败:', error)
      return { error: `插入失败: ${error.message}` }
    }
    
    console.log('✅ 子任务插入成功:', data)
    
    // 更新父任务的展开状态
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ is_expanded: true })
      .eq('id', parentId)
    
    if (updateError) {
      console.warn('更新父任务展开状态失败:', updateError)
    }
    
    return { tasks: data || [] }
  } catch (error) {
    console.error('创建子任务异常:', error)
    return { error: `创建子任务失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

// 切换任务的展开/收起状态
export async function toggleTaskExpansion(
  taskId: string,
  isExpanded: boolean
): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tasks')
      .update({ is_expanded: isExpanded })
      .eq('id', taskId)
    
    if (error) {
      return { error: error.message }
    }
    
    return {}
  } catch (error) {
    return { error: '更新任务状态失败' }
  }
}

// 获取任务的子任务列表
export async function getSubtasks(parentId: string): Promise<{ tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .order('subtask_order', { ascending: true })
    
    if (error) {
      return { error: error.message }
    }
    
    return { tasks: data || [] }
  } catch (error) {
    return { error: '获取子任务失败' }
  }
}

// 更新子任务的排序
export async function updateSubtaskOrder(
  subtaskId: string,
  newOrder: number
): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tasks')
      .update({ subtask_order: newOrder })
      .eq('id', subtaskId)
    
    if (error) {
      return { error: error.message }
    }
    
    return {}
  } catch (error) {
    return { error: '更新子任务排序失败' }
  }
}
