// ============================================
// 笔记任务数据访问层
// ============================================
// 功能：管理笔记编辑器中的任务（daily_tasks 表）
// ============================================

import { createClient } from '@/lib/supabase-client'
import type { DailyTask, CreateDailyTaskInput, UpdateDailyTaskInput, ParsedTask } from '@/types/daily-task'

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
    parentTaskId: dbTask.parent_task_id,      // 🆕 父任务ID
    depth: dbTask.depth ?? 0,                  // 🆕 任务层级（默认0）
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
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
      parent_task_id: input.parentTaskId ?? null,  // 🆕 父任务ID
      depth: input.depth ?? 0,                      // 🆕 任务层级
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
    if (updates.parentTaskId !== undefined) updateData.parent_task_id = updates.parentTaskId  // 🆕
    if (updates.depth !== undefined) updateData.depth = updates.depth  // 🆕

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







