// ============================================
// 笔记任务数据访问层
// ============================================
// 功能：管理笔记编辑器中的任务（daily_tasks 表）
// ============================================

import { createClient } from '@/lib/supabase-client'
import type { DailyTask, CreateDailyTaskInput, UpdateDailyTaskInput, ParsedTask } from '@/types/daily-task'
// 🆕 导入事件记录函数
import { logTaskCreated } from '@/lib/analyticsService'

/**
 * 数据库字段映射（snake_case → camelCase）
 */
function mapDbTaskToTask(dbTask: any): DailyTask {
  return {
    id: dbTask.id,
    userId: dbTask.user_id,
    title: dbTask.title,
    completed: dbTask.completed,
    date: dbTask.date,
    deadlineDatetime: dbTask.deadline_datetime,
    estimatedDuration: dbTask.estimated_duration,
    noteDate: dbTask.note_date,
    notePosition: dbTask.note_position || 0,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
    depth: dbTask.depth ?? 0,                    // 🆕 任务层级
    parentTaskId: dbTask.parent_task_id || null, // 🆕 父任务ID
  }
}

/**
 * 获取某天的所有任务
 */
export async function getDailyTasksByDate(
  userId: string,
  date: string
): Promise<DailyTask[]> {
  try {
    const supabase = createClient()

    console.log(`📋 获取任务: userId=${userId}, date=${date}`)

    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('note_position', { ascending: true })

    if (error) {
      console.error('❌ 获取任务失败:', error)
      throw new Error(`获取任务失败: ${error.message}`)
    }

    const tasks = (data || []).map(mapDbTaskToTask)
    console.log(`✅ 找到 ${tasks.length} 个任务`)
    return tasks

  } catch (error) {
    console.error('❌ getDailyTasksByDate 异常:', error)
    return []
  }
}

/**
 * 获取某天笔记中的所有任务（按 note_date 查询）
 */
export async function getDailyTasksByNoteDate(
  userId: string,
  noteDate: string
): Promise<DailyTask[]> {
  try {
    const supabase = createClient()

    console.log(`📋 获取笔记任务: userId=${userId}, noteDate=${noteDate}`)

    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('note_date', noteDate)
      .order('note_position', { ascending: true })

    if (error) {
      console.error('❌ 获取笔记任务失败:', error)
      throw new Error(`获取笔记任务失败: ${error.message}`)
    }

    const tasks = (data || []).map(mapDbTaskToTask)
    console.log(`✅ 找到 ${tasks.length} 个笔记任务`)
    return tasks

  } catch (error) {
    console.error('❌ getDailyTasksByNoteDate 异常:', error)
    return []
  }
}

/**
 * 创建新任务
 */
export async function createDailyTask(
  userId: string,
  input: CreateDailyTaskInput
): Promise<DailyTask> {
  try {
    const supabase = createClient()

    console.log('📝 创建任务:', input.title)

    const insertData = {
      user_id: userId,
      title: input.title,
      date: input.date,
      note_date: input.noteDate,
      completed: input.completed ?? false,
      deadline_datetime: input.deadlineDatetime || null,
      estimated_duration: input.estimatedDuration || null,
      note_position: input.notePosition ?? 0,
      depth: input.depth ?? 0,                      // 🆕 任务层级
      parent_task_id: input.parentTaskId || null,   // 🆕 父任务ID
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('❌ 创建任务失败:', error)
      throw new Error(`创建任务失败: ${error.message}`)
    }

    const task = mapDbTaskToTask(data)
    console.log(`✅ 任务创建成功: ${task.id}`)
    
    // 🆕 记录任务创建事件（不阻塞返回）
    logTaskCreated(userId, task.id, task.depth ?? 0).catch(err => 
      console.warn('⚠️ 记录任务创建事件失败:', err)
    )
    
    return task

  } catch (error) {
    console.error('❌ createDailyTask 异常:', error)
    throw error
  }
}

/**
 * 更新任务
 */
export async function updateDailyTask(
  taskId: string,
  updates: UpdateDailyTaskInput
): Promise<DailyTask> {
  try {
    const supabase = createClient()

    console.log(`📝 更新任务: ${taskId}`, updates)

    const updateData: any = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.completed !== undefined) updateData.completed = updates.completed
    if (updates.date !== undefined) updateData.date = updates.date
    if (updates.deadlineDatetime !== undefined) updateData.deadline_datetime = updates.deadlineDatetime
    if (updates.estimatedDuration !== undefined) updateData.estimated_duration = updates.estimatedDuration
    if (updates.notePosition !== undefined) updateData.note_position = updates.notePosition
    // 🆕 层级字段
    if (updates.depth !== undefined) updateData.depth = updates.depth
    if (updates.parentTaskId !== undefined) updateData.parent_task_id = updates.parentTaskId

    const { data, error } = await supabase
      .from('daily_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      console.error('❌ 更新任务失败:', error)
      throw new Error(`更新任务失败: ${error.message}`)
    }

    const task = mapDbTaskToTask(data)
    console.log(`✅ 任务更新成功: ${task.id}`)
    return task

  } catch (error) {
    console.error('❌ updateDailyTask 异常:', error)
    throw error
  }
}

/**
 * 删除任务
 */
export async function deleteDailyTask(taskId: string): Promise<void> {
  try {
    const supabase = createClient()

    console.log(`🗑️ 删除任务: ${taskId}`)

    const { error } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('❌ 删除任务失败:', error)
      throw new Error(`删除任务失败: ${error.message}`)
    }

    console.log(`✅ 任务删除成功: ${taskId}`)

  } catch (error) {
    console.error('❌ deleteDailyTask 异常:', error)
    throw error
  }
}

/**
 * 批量删除任务（按笔记日期）
 */
export async function deleteDailyTasksByNoteDate(
  userId: string,
  noteDate: string
): Promise<void> {
  try {
    const supabase = createClient()

    console.log(`🗑️ 批量删除任务: noteDate=${noteDate}`)

    const { error } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('note_date', noteDate)

    if (error) {
      console.error('❌ 批量删除任务失败:', error)
      throw new Error(`批量删除任务失败: ${error.message}`)
    }

    console.log(`✅ 批量删除成功: noteDate=${noteDate}`)

  } catch (error) {
    console.error('❌ deleteDailyTasksByNoteDate 异常:', error)
    throw error
  }
}

// ============================================
// 🔧 性能优化：批量操作函数
// ============================================

/**
 * 批量创建任务（一次数据库调用）
 * @param userId 用户ID
 * @param tasks 任务数组
 * @returns 创建成功的任务数组
 */
export async function batchCreateDailyTasks(
  userId: string,
  tasks: CreateDailyTaskInput[]
): Promise<DailyTask[]> {
  if (tasks.length === 0) return []
  
  try {
    const supabase = createClient()
    console.log(`📦 批量创建任务: ${tasks.length} 个`)

    const insertData = tasks.map(input => ({
      user_id: userId,
      title: input.title,
      date: input.date,
      note_date: input.noteDate,
      completed: input.completed ?? false,
      deadline_datetime: input.deadlineDatetime || null,
      estimated_duration: input.estimatedDuration || null,
      note_position: input.notePosition ?? 0,
      depth: input.depth ?? 0,
      parent_task_id: input.parentTaskId || null,
    }))

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert(insertData)
      .select()

    if (error) {
      console.error('❌ 批量创建任务失败:', error)
      throw new Error(`批量创建任务失败: ${error.message}`)
    }

    const createdTasks = (data || []).map(mapDbTaskToTask)
    console.log(`✅ 批量创建成功: ${createdTasks.length} 个任务`)
    
    // 🆕 批量记录任务创建事件（不阻塞返回）
    Promise.all(createdTasks.map(task => 
      logTaskCreated(userId, task.id, task.depth ?? 0)
    )).catch(err => console.warn('⚠️ 批量记录任务创建事件失败:', err))

    return createdTasks
  } catch (error) {
    console.error('❌ batchCreateDailyTasks 异常:', error)
    throw error
  }
}

/**
 * 批量更新任务（并行执行多个更新）
 * @param updates 更新数组 [{ taskId, updates }, ...]
 * @returns 更新成功的数量
 */
export async function batchUpdateDailyTasks(
  updates: Array<{ taskId: string; updates: UpdateDailyTaskInput }>
): Promise<number> {
  if (updates.length === 0) return 0
  
  try {
    const supabase = createClient()
    console.log(`📦 批量更新任务: ${updates.length} 个`)

    // 并行执行所有更新
    const promises = updates.map(({ taskId, updates: u }) => {
      const updateData: any = {}
      if (u.title !== undefined) updateData.title = u.title
      if (u.completed !== undefined) updateData.completed = u.completed
      if (u.date !== undefined) updateData.date = u.date
      if (u.deadlineDatetime !== undefined) updateData.deadline_datetime = u.deadlineDatetime
      if (u.estimatedDuration !== undefined) updateData.estimated_duration = u.estimatedDuration
      if (u.notePosition !== undefined) updateData.note_position = u.notePosition
      if (u.depth !== undefined) updateData.depth = u.depth
      if (u.parentTaskId !== undefined) updateData.parent_task_id = u.parentTaskId

      return supabase
        .from('daily_tasks')
        .update(updateData)
        .eq('id', taskId)
    })

    const results = await Promise.all(promises)
    
    // 统计成功数量
    const successCount = results.filter(r => !r.error).length
    const errorCount = results.filter(r => r.error).length
    
    if (errorCount > 0) {
      console.warn(`⚠️ 批量更新部分失败: ${errorCount} 个`)
    }
    
    console.log(`✅ 批量更新成功: ${successCount} 个任务`)
    return successCount
  } catch (error) {
    console.error('❌ batchUpdateDailyTasks 异常:', error)
    throw error
  }
}

/**
 * 批量删除任务（按任务ID数组）
 * @param taskIds 任务ID数组
 * @returns 删除成功的数量
 */
export async function batchDeleteDailyTasks(taskIds: string[]): Promise<number> {
  if (taskIds.length === 0) return 0
  
  try {
    const supabase = createClient()
    console.log(`🗑️ 批量删除任务: ${taskIds.length} 个`)

    const { error, count } = await supabase
      .from('daily_tasks')
      .delete()
      .in('id', taskIds)

    if (error) {
      console.error('❌ 批量删除任务失败:', error)
      throw new Error(`批量删除任务失败: ${error.message}`)
    }

    console.log(`✅ 批量删除成功: ${count ?? taskIds.length} 个任务`)
    return count ?? taskIds.length
  } catch (error) {
    console.error('❌ batchDeleteDailyTasks 异常:', error)
    throw error
  }
}

/**
 * 切换任务完成状态
 */
export async function toggleDailyTaskComplete(taskId: string): Promise<DailyTask> {
  try {
    const supabase = createClient()

    console.log(`🔄 切换任务完成状态: ${taskId}`)

    // 先获取当前状态
    const { data: currentTask, error: fetchError } = await supabase
      .from('daily_tasks')
      .select('completed')
      .eq('id', taskId)
      .single()

    if (fetchError) {
      console.error('❌ 获取任务状态失败:', fetchError)
      throw new Error(`获取任务状态失败: ${fetchError.message}`)
    }

    // 切换状态
    const newCompleted = !currentTask.completed

    const { data, error } = await supabase
      .from('daily_tasks')
      .update({ completed: newCompleted })
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      console.error('❌ 切换任务状态失败:', error)
      throw new Error(`切换任务状态失败: ${error.message}`)
    }

    const task = mapDbTaskToTask(data)
    console.log(`✅ 任务状态已切换: ${taskId} → ${newCompleted}`)
    return task

  } catch (error) {
    console.error('❌ toggleDailyTaskComplete 异常:', error)
    throw error
  }
}

/**
 * 直接设置任务完成状态（不切换，用于批量更新子任务）
 */
export async function updateDailyTaskComplete(taskId: string, completed: boolean): Promise<DailyTask> {
  try {
    const supabase = createClient()

    console.log(`🔄 设置任务完成状态: ${taskId} → ${completed}`)

    const { data, error } = await supabase
      .from('daily_tasks')
      .update({ completed })
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      console.error('❌ 设置任务状态失败:', error)
      throw new Error(`设置任务状态失败: ${error.message}`)
    }

    const task = mapDbTaskToTask(data)
    console.log(`✅ 任务状态已设置: ${taskId} → ${completed}`)
    return task

  } catch (error) {
    console.error('❌ updateDailyTaskComplete 异常:', error)
    throw error
  }
}

/**
 * 获取所有未完成的任务（跨天）
 */
export async function getIncompleteDailyTasks(userId: string): Promise<DailyTask[]> {
  try {
    const supabase = createClient()

    console.log(`📋 获取未完成任务: userId=${userId}`)

    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('date', { ascending: true })
      .order('note_position', { ascending: true })

    if (error) {
      console.error('❌ 获取未完成任务失败:', error)
      throw new Error(`获取未完成任务失败: ${error.message}`)
    }

    const tasks = (data || []).map(mapDbTaskToTask)
    console.log(`✅ 找到 ${tasks.length} 个未完成任务`)
    return tasks

  } catch (error) {
    console.error('❌ getIncompleteDailyTasks 异常:', error)
    return []
  }
}

// ============================================
// 🆕 历史上下文获取函数（用于元认知反思）
// ============================================

/**
 * 近期任务历史记录（用于反思上下文）
 */
export interface RecentTaskHistoryItem {
  date: string              // "2026-01-11"
  dayLabel: string          // "昨天" | "前天" | "3天前"
  tasks: {
    id: string
    title: string
    completed: boolean
    depth: number           // 0=父任务, 1=子任务
    parentTaskId: string | null
    parentTitle: string | null  // 父任务标题（方便显示）
    estimatedDuration: number | null
  }[]
}

/**
 * 获取过去N天的任务历史
 * @param userId 用户ID
 * @param days 获取天数（默认3天）
 * @param currentDate 当前日期（默认今天）
 * @returns 按日期分组的任务历史
 */
export async function getRecentTaskHistory(
  userId: string,
  days: number = 3,
  currentDate?: string
): Promise<RecentTaskHistoryItem[]> {
  try {
    const supabase = createClient()
    
    // 计算日期范围
    const today = currentDate || new Date().toISOString().split('T')[0]
    const dates: string[] = []
    const dayLabels: string[] = ['昨天', '前天', '3天前', '4天前', '5天前']
    
    for (let i = 1; i <= days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    console.log(`📅 获取近期任务历史: userId=${userId}, 日期范围=${dates.join(', ')}`)
    
    // 一次性查询所有日期的任务
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .in('note_date', dates)
      .order('note_date', { ascending: false })
      .order('note_position', { ascending: true })
    
    if (error) {
      console.error('❌ 获取近期任务历史失败:', error)
      return []
    }
    
    const allTasks = (data || []).map(mapDbTaskToTask)
    
    // 构建任务ID到任务的映射（用于查找父任务标题）
    const taskById = new Map<string, DailyTask>()
    allTasks.forEach(task => taskById.set(task.id, task))
    
    // 按日期分组
    const historyByDate = new Map<string, RecentTaskHistoryItem>()
    
    dates.forEach((date, index) => {
      historyByDate.set(date, {
        date,
        dayLabel: dayLabels[index] || `${index + 1}天前`,
        tasks: []
      })
    })
    
    // 填充任务数据
    allTasks.forEach(task => {
      const history = historyByDate.get(task.noteDate)
      if (history) {
        // 查找父任务标题
        let parentTitle: string | null = null
        if (task.parentTaskId) {
          const parentTask = taskById.get(task.parentTaskId)
          parentTitle = parentTask?.title || null
        }
        
        history.tasks.push({
          id: task.id,
          title: task.title,
          completed: task.completed,
          depth: task.depth ?? 0,
          parentTaskId: task.parentTaskId || null,
          parentTitle,
          estimatedDuration: task.estimatedDuration || null
        })
      }
    })
    
    // 转换为数组并过滤空日期
    const result = dates
      .map(date => historyByDate.get(date)!)
      .filter(h => h.tasks.length > 0)
    
    console.log(`✅ 获取到 ${result.length} 天的任务历史，共 ${allTasks.length} 个任务`)
    
    return result
    
  } catch (error) {
    console.error('❌ getRecentTaskHistory 异常:', error)
    return []
  }
}

/**
 * 构建任务家族上下文（父任务 + 兄弟任务）
 * @param task 当前任务
 * @param allTasks 所有任务（同一天）
 * @returns 任务家族上下文
 */
export interface TaskFamilyContext {
  hasParent: boolean
  parent: {
    id: string
    title: string
    completed: boolean
    childrenCount: number
  } | null
  siblings: {
    id: string
    title: string
    completed: boolean
  }[]
}

export function buildTaskFamilyContext(
  task: DailyTask,
  allTasks: DailyTask[]
): TaskFamilyContext {
  // 如果不是子任务，返回空上下文
  if (!task.parentTaskId || task.depth === 0) {
    return {
      hasParent: false,
      parent: null,
      siblings: []
    }
  }
  
  // 查找父任务
  const parentTask = allTasks.find(t => t.id === task.parentTaskId)
  
  // 查找兄弟任务（同一父任务下的其他子任务）
  const siblings = allTasks
    .filter(t => t.parentTaskId === task.parentTaskId && t.id !== task.id)
    .map(t => ({
      id: t.id,
      title: t.title,
      completed: t.completed
    }))
  
  // 计算父任务下的子任务总数
  const childrenCount = allTasks.filter(t => t.parentTaskId === task.parentTaskId).length
  
  return {
    hasParent: true,
    parent: parentTask ? {
      id: parentTask.id,
      title: parentTask.title,
      completed: parentTask.completed,
      childrenCount
    } : null,
    siblings
  }
}



