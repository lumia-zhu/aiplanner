import { createClient } from './supabase-client'
import type { Task, SubtaskSuggestion } from '@/types'

// 任务相关的数据库操作

/**
 * 获取用户某一天的所有任务
 * @param userId - 用户ID
 * @param date - 日期字符串 (YYYY-MM-DD)
 * @returns 任务列表
 */
export async function getTasksByDate(
  userId: string,
  date: string
): Promise<Task[]> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('获取任务失败:', error)
      throw new Error(`获取任务失败: ${error.message}`)
    }
    
    return data || []
  } catch (error) {
    console.error('getTasksByDate 异常:', error)
    return []
  }
}

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
    priority?: 'low' | 'medium' | 'high'
    parent_id?: string
    estimated_duration?: number // ⭐ 改为number类型（分钟数）
    subtask_order?: number
    tags?: string[] // ⭐ 新增: 任务标签
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
          tags: taskData.tags || [], // ⭐ 新增: 保存标签
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
    tags?: string[] // ⭐ 新增: 任务标签
    estimated_duration?: number // ⭐ 新增: 预估时长（分钟数）
  }
): Promise<{ task?: Task; error?: string }> {
  try {
    console.log('🔍 updateTask 被调用:', { taskId, updates })
    
    const supabase = createClient()
    
    // 准备更新数据
    const updateData: any = { ...updates }
    
    // ⭐ 关键修复: 处理空字符串的description
    // 如果description是空字符串，将其转换为null以清空数据库字段
    if ('description' in updateData && updateData.description === '') {
      updateData.description = null
      console.log('📝 将空description转换为null')
    }
    
    console.log('📝 初始 updateData:', updateData)
    
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
    
    // ⭐ 新增: 处理标签更新
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags || []
    }
    
    console.log('💾 最终发送到数据库的 updateData:', updateData)
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()
    
    console.log('📦 数据库返回结果:', { data, error })
    
    if (error) {
      console.error('❌ 数据库更新失败:', error)
      return { error: error.message }
    }
    
    console.log('✅ updateTask 成功:', data)
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

/**
 * 复制任务到指定日期（保留标题、标签、优先级等属性）
 * 用于从历史日期快速添加任务到今天
 * @param taskId - 原任务ID
 * @param targetDate - 目标日期（通常是今天）
 * @param userId - 用户ID
 * @returns 新创建的任务对象
 */
export async function copyTaskToDate(
  taskId: string,
  targetDate: Date,
  userId: string
): Promise<Task> {
  try {
    const supabase = createClient()
    
    // 1. 查询原任务详情
    const { data: originalTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError || !originalTask) {
      console.error('获取原任务失败:', fetchError)
      throw new Error('获取原任务失败')
    }

    console.log('📋 复制任务:', { originalTitle: originalTask.title, targetDate })

    // 2. 构造新任务对象（继承关键属性，重置日期和完成状态）
    const targetDateStr = targetDate.toISOString().split('T')[0] // YYYY-MM-DD
    const newTaskData = {
      user_id: userId,
      title: originalTask.title,              // ✅ 继承标题
      description: originalTask.description,  // ✅ 继承描述
      is_completed: false,                    // ⭐ 重置为未完成
      completed: false,                       // ⭐ 重置为未完成
      date: targetDateStr,                    // ⭐ 使用新日期
      tags: originalTask.tags || [],          // ✅ 继承标签
      priority: originalTask.priority,        // ✅ 继承优先级
      estimated_duration: originalTask.estimated_duration, // ✅ 继承预估时长
      created_at: new Date().toISOString(),
      // ❌ 不继承这些字段：
      // - deadline_datetime: 截止时间不继承
      // - parent_id: 不继承父任务关系
      // - subtask_order: 不继承子任务顺序
    }

    // 3. 插入数据库
    const { data: createdTask, error: createError } = await supabase
      .from('tasks')
      .insert(newTaskData)
      .select()
      .single()

    if (createError || !createdTask) {
      console.error('创建新任务失败:', createError)
      throw new Error('创建新任务失败')
    }

    console.log('✅ 任务复制成功:', { 
      newTaskId: createdTask.id, 
      title: createdTask.title,
      date: createdTask.date 
    })

    return createdTask
  } catch (error) {
    console.error('copyTaskToDate 异常:', error)
    throw error
  }
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
    
    console.log('📊 从数据库获取的任务数据:', data)
    console.log('📊 子任务统计:', data?.filter(t => t.parent_id).length, '个子任务')
    
    // 构建任务树结构
    const tasks = buildTaskTree(data || [])
    
    console.log('🌳 构建的任务树:', tasks)
    console.log('🌳 顶级任务数:', tasks.length)
    
    return { tasks }
  } catch (error) {
    console.error('❌ 获取任务异常:', error)
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
    
    // 1. 首先验证父任务是否存在（提前验证，避免后续无效操作）
    const { data: parentTask, error: parentError } = await supabase
      .from('tasks')
      .select('id, user_id')
      .eq('id', parentId)
      .eq('user_id', userId)
      .single()
    
    if (parentError) {
      console.error('父任务验证失败 - 数据库错误:', parentError)
      return { error: `父任务查询失败: ${parentError.message || '未知错误'}` }
    }
    
    if (!parentTask) {
      console.error('父任务验证失败 - 任务不存在')
      return { error: '父任务不存在或无权限访问' }
    }
    
    console.log('✅ 父任务验证通过:', parentTask.id)
    
    // 2. 准备子任务数据
    const subtaskData = subtasks
      .filter(subtask => subtask.is_selected)
      .map((subtask, index) => ({
        user_id: userId,
        title: subtask.title.trim(),
        description: subtask.description?.trim() || null,
        priority: subtask.priority || null, // ✅ 如果是 undefined，转为 null
        parent_id: parentId,
        subtask_order: subtask.order || index + 1,
        estimated_duration: subtask.estimated_duration || null, // ⭐ 现在是number类型，不需要trim
        completed: false,
        is_expanded: false
      }))
    
    console.log('📋 准备插入的子任务数据:', subtaskData)
    
    if (subtaskData.length === 0) {
      return { error: '没有选中的子任务' }
    }
    
    // 3. 批量插入子任务
    const { data, error } = await supabase
      .from('tasks')
      .insert(subtaskData)
      .select()
    
    if (error) {
      console.error('插入子任务失败:', error)
      return { error: `插入失败: ${error.message}` }
    }
    
    console.log('✅ 子任务插入成功:', data)
    
    // 4. 更新父任务的展开状态
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

// 将所有子任务提升为独立任务（解除父子关系）
export async function promoteSubtasksToTasks(
  parentId: string,
  userId: string
): Promise<{ count?: number; tasks?: Task[]; error?: string }> {
  try {
    const supabase = createClient()
    
    console.log('🔧 开始提升子任务:', { parentId, userId })
    
    // 1. 验证父任务是否存在且属于当前用户，并获取其 description 用于构建路径
    const { data: parentTask, error: parentError } = await supabase
      .from('tasks')
      .select('id, user_id, title, description')
      .eq('id', parentId)
      .eq('user_id', userId)
      .single()
    
    if (parentError || !parentTask) {
      console.error('父任务验证失败:', parentError)
      return { error: '父任务不存在或无权限访问' }
    }
    
    // 2. 获取所有子任务（包含 description 用于追加路径）
    const { data: subtasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, description')
      .eq('parent_id', parentId)
      .eq('user_id', userId)
    
    if (fetchError) {
      console.error('获取子任务失败:', fetchError)
      return { error: `获取子任务失败: ${fetchError.message}` }
    }
    
    if (!subtasks || subtasks.length === 0) {
      return { error: '没有子任务需要提升' }
    }
    
    console.log('📋 找到子任务:', subtasks.length, '个')
    
    // 提取子任务ID列表
    const subtaskIds = subtasks.map(s => s.id)
    
    // 3. 构建父任务路径
    // 如果父任务的 description 已包含 "来自：" 说明它也是被提升过的，继承其路径
    let parentPath: string
    if (parentTask.description && parentTask.description.includes('来自：')) {
      // 提取已有路径并追加当前父任务标题
      const existingPath = parentTask.description.split('来自：')[1].trim()
      parentPath = `来自：${existingPath} > ${parentTask.title}`
    } else {
      // 第一次提升，创建新路径
      parentPath = `来自：${parentTask.title}`
    }
    
    console.log('📍 构建的父任务路径:', parentPath)
    
    // 4. 逐个更新子任务，为每个子任务添加父任务路径到 description
    for (const subtask of subtasks) {
      let newDescription: string
      
      if (subtask.description && subtask.description.trim()) {
        // 如果子任务已有描述，在末尾追加路径
        newDescription = `${subtask.description}\n\n${parentPath}`
      } else {
        // 如果没有描述，直接设置路径
        newDescription = parentPath
      }
      
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          parent_id: null,
          subtask_order: 0,
          description: newDescription
        })
        .eq('id', subtask.id)
        .eq('user_id', userId)
      
      if (updateError) {
        console.error(`更新子任务 ${subtask.id} 失败:`, updateError)
        // 继续处理其他子任务，不中断整个流程
      }
    }
    
    console.log('✅ 子任务提升成功，已添加父任务路径')
    
    // 5. 查询提升后的任务数据（用于前端局部更新）
    const { data: promotedTasks, error: fetchPromotedError } = await supabase
      .from('tasks')
      .select('*')
      .in('id', subtaskIds)
      .eq('user_id', userId)
    
    if (fetchPromotedError) {
      console.warn('获取提升后的任务失败:', fetchPromotedError)
      // 不阻止操作，返回空数组
    }
    
    console.log('📊 返回提升后的任务:', promotedTasks?.length, '个')
    
    // 6. 删除父任务（子任务已全部提升，父任务变成空壳，应该删除）
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', parentId)
      .eq('user_id', userId)
    
    if (deleteError) {
      console.warn('删除父任务失败:', deleteError)
      // 不阻止操作，子任务已经提升成功
    } else {
      console.log('🗑️ 父任务已删除')
    }
    
    return { 
      count: subtasks.length,
      tasks: promotedTasks || []
    }
  } catch (error) {
    console.error('提升子任务异常:', error)
    return { error: `提升子任务失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

// 将结构化上下文追加到任务描述中
export async function appendStructuredContextToTask(
  userId: string,
  taskId: string,
  structuredContext: {
    timeline?: string
    deadline_datetime?: string
    deadline_confidence?: 'high' | 'medium' | 'low'
    dependencies?: string[]
    expected_output?: string
    difficulty?: string
    priority_reason?: string
    estimated_duration?: number
  },
  aiSummary?: string  // ⭐ 新增：AI生成的任务概要
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const supabase = createClient()
    
    // 1. 获取当前任务
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single()
    
    if (fetchError || !currentTask) {
      return { success: false, error: '任务不存在或无权访问' }
    }
    
    console.log('📋 开始追加结构化上下文:', {
      taskId,
      taskTitle: currentTask.title,
      structuredContext,
      aiSummary
    })
    
    // 2. 优先使用 AI 生成的 summary，如果没有才手动拼接
    let contextToAppend = ''
    
    if (aiSummary && aiSummary.trim()) {
      // ⭐ 直接使用 AI 生成的 summary（去掉开头的"📋 任务概要"标题）
      const summaryContent = aiSummary.replace(/^📋\s*任务概要\s*\n+/, '').trim()
      contextToAppend = `\n\n${summaryContent}`
      console.log('✅ 使用 AI 生成的 summary')
    } else {
      // 降级方案：手动拼接结构化上下文
      const infoParts: string[] = []
      
      if (structuredContext.expected_output) {
        infoParts.push(`产出：${structuredContext.expected_output}`)
      }
      
      if (structuredContext.estimated_duration && structuredContext.estimated_duration > 0) {
        const hours = structuredContext.estimated_duration / 60
        const formatted = hours % 1 === 0 ? `${hours}小时` : `${hours}小时`
        infoParts.push(`时长：${formatted}`)
      }
      
      if (structuredContext.timeline) {
        infoParts.push(`时间：${structuredContext.timeline}`)
      }
      
      if (structuredContext.dependencies && structuredContext.dependencies.length > 0) {
        infoParts.push(`依赖：${structuredContext.dependencies.join('、')}`)
      }
      
      if (structuredContext.difficulty) {
        infoParts.push(`挑战：${structuredContext.difficulty}`)
      }
      
      if (structuredContext.priority_reason) {
        infoParts.push(`优先级：${structuredContext.priority_reason}`)
      }
      
      if (infoParts.length === 0) {
        return { success: true, task: currentTask }
      }
      
      contextToAppend = `\n\n## 📋 ${infoParts.join(' | ')}`
      console.log('⚠️ AI summary 为空，使用降级方案手动拼接')
    }
    
    // 3. 将上下文追加到现有描述中
    const currentDescription = currentTask.description || ''
    const updatedDescription = currentDescription
      ? `${currentDescription}${contextToAppend}`
      : contextToAppend.trim()
    
    console.log('📝 生成的描述内容:', {
      contextToAppend,
      currentDescription,
      updatedDescription
    })
    
    // 5. 构建更新数据对象
    const updateData: any = {
      description: updatedDescription,
      updated_at: new Date().toISOString()
    }
    
    // ⭐ 如果有预估时长，同时更新 estimated_duration 字段
    if (structuredContext.estimated_duration && structuredContext.estimated_duration > 0) {
      updateData.estimated_duration = structuredContext.estimated_duration
      console.log('✅ 同时更新任务预估时长:', structuredContext.estimated_duration, '分钟')
    }
    
    // 如果有明确的截止时间且置信度不是low，同时更新deadline字段
    if (structuredContext.deadline_datetime && 
        structuredContext.deadline_confidence && 
        structuredContext.deadline_confidence !== 'low') {
      
      // ⭐ 关键修复: AI返回的时间格式（如"2025-01-17T13:00:00"）需要正确处理时区
      // 直接使用会被当作本地时间，但可能在显示时出现偏差
      // 这里确保时间被正确解析并保存为UTC格式
      let deadlineToSave = structuredContext.deadline_datetime
      
      // 如果AI返回的时间不包含时区信息（没有'Z'或'+08:00'），需要手动处理
      if (!deadlineToSave.includes('Z') && !deadlineToSave.includes('+') && !deadlineToSave.includes('-', 10)) {
        // 将其视为本地时间，转换为ISO格式（UTC）
        const localDate = new Date(deadlineToSave)
        deadlineToSave = localDate.toISOString()
        console.log('🔄 时区转换:', structuredContext.deadline_datetime, '→', deadlineToSave)
      }
      
      updateData.deadline_datetime = deadlineToSave
      console.log('✅ 同时更新任务截止时间:', 
                  deadlineToSave, 
                  '置信度:', 
                  structuredContext.deadline_confidence)
    }
    
    // 6. 更新任务
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (updateError) {
      console.error('更新任务描述失败:', updateError)
      return { success: false, error: '更新任务失败' }
    }
    
    console.log('✅ 任务上下文已追加:', taskId)
    return { success: true, task: updatedTask }
  } catch (error) {
    console.error('追加任务上下文异常:', error)
    return { 
      success: false, 
      error: `追加上下文失败: ${error instanceof Error ? error.message : '未知错误'}` 
    }
  }
}
