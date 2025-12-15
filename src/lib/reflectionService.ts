// ============================================
// 元认知反思系统数据访问层
// ============================================
// 功能：管理计划快照和反思会话
// ============================================

import { createClient } from '@/lib/supabase-client'
import type {
  PlanSnapshot,
  TaskSnapshot,
  ReflectionSession,
  CreatePlanSnapshotInput,
  CreateReflectionSessionInput,
  UpdateReflectionSessionInput,
  ScanResult,
  RoundsJson,
  ReflectionRound,
  ReflectionSessionStatus
} from '@/types/reflection'

// ============================================
// 数据库字段映射
// ============================================

/**
 * 数据库记录 → PlanSnapshot
 */
function mapDbToPlanSnapshot(dbRecord: any): PlanSnapshot {
  return {
    id: dbRecord.id,
    userId: dbRecord.user_id,
    createdAt: dbRecord.created_at,
    noteDate: dbRecord.note_date,
    taskCount: dbRecord.task_count,
    tasksJson: dbRecord.tasks_json || []
  }
}

/**
 * 数据库记录 → ReflectionSession
 */
function mapDbToReflectionSession(dbRecord: any): ReflectionSession {
  return {
    id: dbRecord.id,
    planSnapshotId: dbRecord.plan_snapshot_id,
    userId: dbRecord.user_id,
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at,
    status: dbRecord.status as ReflectionSessionStatus,
    currentRound: dbRecord.current_round as ReflectionRound,
    scanResult: dbRecord.scan_result as ScanResult | undefined,
    overviewSummary: dbRecord.overview_summary,
    roundsJson: (dbRecord.rounds_json || {}) as RoundsJson,
    finalSummary: dbRecord.final_summary,
    executionSuggestions: dbRecord.execution_suggestions,
    completedAt: dbRecord.completed_at
  }
}

// ============================================
// 计划快照 (PlanSnapshot) CRUD
// ============================================

/**
 * 创建计划快照
 */
export async function createPlanSnapshot(
  input: CreatePlanSnapshotInput
): Promise<PlanSnapshot | null> {
  try {
    const supabase = createClient()

    console.log('📸 创建计划快照:', {
      userId: input.userId,
      noteDate: input.noteDate,
      taskCount: input.tasksJson.length
    })

    const insertData = {
      user_id: input.userId,
      note_date: input.noteDate,
      tasks_json: input.tasksJson,
      task_count: input.tasksJson.length
    }

    const { data, error } = await supabase
      .from('plan_snapshots')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ 创建计划快照失败:', error)
      throw new Error(`创建计划快照失败: ${error.message}`)
    }

    console.log('✅ 计划快照创建成功:', data.id)
    return mapDbToPlanSnapshot(data)

  } catch (error) {
    console.error('❌ createPlanSnapshot 异常:', error)
    return null
  }
}

/**
 * 获取计划快照
 */
export async function getPlanSnapshot(
  snapshotId: string
): Promise<PlanSnapshot | null> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('plan_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single()

    if (error) {
      console.error('❌ 获取计划快照失败:', error)
      return null
    }

    return mapDbToPlanSnapshot(data)

  } catch (error) {
    console.error('❌ getPlanSnapshot 异常:', error)
    return null
  }
}

/**
 * 获取用户某天的最新计划快照
 */
export async function getLatestPlanSnapshot(
  userId: string,
  noteDate: string
): Promise<PlanSnapshot | null> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('plan_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('note_date', noteDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // 没有找到记录不算错误
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('❌ 获取最新计划快照失败:', error)
      return null
    }

    return mapDbToPlanSnapshot(data)

  } catch (error) {
    console.error('❌ getLatestPlanSnapshot 异常:', error)
    return null
  }
}

// ============================================
// 反思会话 (ReflectionSession) CRUD
// ============================================

/**
 * 创建反思会话
 */
export async function createReflectionSession(
  input: CreateReflectionSessionInput
): Promise<ReflectionSession | null> {
  try {
    const supabase = createClient()

    console.log('🧠 创建反思会话:', {
      planSnapshotId: input.planSnapshotId,
      userId: input.userId
    })

    const insertData = {
      plan_snapshot_id: input.planSnapshotId,
      user_id: input.userId,
      status: 'in_progress',
      current_round: 'overview',
      rounds_json: {}
    }

    const { data, error } = await supabase
      .from('reflection_sessions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ 创建反思会话失败:', error)
      throw new Error(`创建反思会话失败: ${error.message}`)
    }

    console.log('✅ 反思会话创建成功:', data.id)
    return mapDbToReflectionSession(data)

  } catch (error) {
    console.error('❌ createReflectionSession 异常:', error)
    return null
  }
}

/**
 * 获取反思会话
 */
export async function getReflectionSession(
  sessionId: string
): Promise<ReflectionSession | null> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('reflection_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('❌ 获取反思会话失败:', error)
      return null
    }

    return mapDbToReflectionSession(data)

  } catch (error) {
    console.error('❌ getReflectionSession 异常:', error)
    return null
  }
}

/**
 * 获取用户未完成的反思会话（用于恢复）
 */
export async function getInProgressReflectionSession(
  userId: string,
  noteDate: string
): Promise<ReflectionSession | null> {
  try {
    const supabase = createClient()

    console.log('🔍 查找未完成的反思会话:', { userId, noteDate })

    // 先找到该日期的快照
    const { data: snapshots, error: snapshotError } = await supabase
      .from('plan_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('note_date', noteDate)

    if (snapshotError || !snapshots || snapshots.length === 0) {
      return null
    }

    const snapshotIds = snapshots.map(s => s.id)

    // 查找这些快照对应的未完成会话
    const { data, error } = await supabase
      .from('reflection_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .in('plan_snapshot_id', snapshotIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // 没有找到记录不算错误
      if (error.code === 'PGRST116') {
        console.log('📭 没有未完成的反思会话')
        return null
      }
      console.error('❌ 获取未完成反思会话失败:', error)
      return null
    }

    console.log('✅ 找到未完成的反思会话:', data.id)
    return mapDbToReflectionSession(data)

  } catch (error) {
    console.error('❌ getInProgressReflectionSession 异常:', error)
    return null
  }
}

/**
 * 更新反思会话
 */
export async function updateReflectionSession(
  sessionId: string,
  updates: UpdateReflectionSessionInput
): Promise<ReflectionSession | null> {
  try {
    const supabase = createClient()

    console.log('📝 更新反思会话:', { sessionId, updates })

    // 构建更新数据（snake_case）
    const updateData: any = {}
    
    if (updates.status !== undefined) {
      updateData.status = updates.status
    }
    if (updates.currentRound !== undefined) {
      updateData.current_round = updates.currentRound
    }
    if (updates.scanResult !== undefined) {
      updateData.scan_result = updates.scanResult
    }
    if (updates.overviewSummary !== undefined) {
      updateData.overview_summary = updates.overviewSummary
    }
    if (updates.roundsJson !== undefined) {
      updateData.rounds_json = updates.roundsJson
    }
    if (updates.finalSummary !== undefined) {
      updateData.final_summary = updates.finalSummary
    }
    if (updates.executionSuggestions !== undefined) {
      updateData.execution_suggestions = updates.executionSuggestions
    }
    if (updates.completedAt !== undefined) {
      updateData.completed_at = updates.completedAt
    }

    const { data, error } = await supabase
      .from('reflection_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()

    if (error) {
      console.error('❌ 更新反思会话失败:', error)
      throw new Error(`更新反思会话失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ 未找到要更新的反思会话:', sessionId)
      return null
    }

    console.log('✅ 反思会话更新成功')
    return mapDbToReflectionSession(data[0])

  } catch (error) {
    console.error('❌ updateReflectionSession 异常:', error)
    return null
  }
}

/**
 * 获取用户在特定日期已完成的反思会话
 */
export async function getCompletedReflectionSession(
  userId: string,
  noteDate: string
): Promise<ReflectionSession | null> {
  try {
    console.log('🔍 查找已完成的反思会话:', { userId, noteDate })
    const supabase = createClient()

    // 1. 获取该日期最新的 plan_snapshot
    const { data: snapshots, error: snapshotError } = await supabase
      .from('plan_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('note_date', noteDate)
      .order('created_at', { ascending: false })
      .limit(1)

    if (snapshotError || !snapshots || snapshots.length === 0) {
      return null
    }

    const snapshotId = snapshots[0].id

    // 2. 查找与该 snapshot 关联的 completed 会话
    const { data, error } = await supabase
      .from('reflection_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_snapshot_id', snapshotId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // 未找到
      console.error('❌ 查找已完成会话失败:', error)
      return null
    }

    return mapDbToReflectionSession(data)

  } catch (error) {
    console.error('❌ getCompletedReflectionSession 异常:', error)
    return null
  }
}

/**
 * 获取用户的反思历史（用于 RQ3 分析）
 */
export async function getReflectionHistory(
  userId: string,
  limit: number = 30
): Promise<ReflectionSession[]> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('reflection_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ 获取反思历史失败:', error)
      return []
    }

    return (data || []).map(mapDbToReflectionSession)

  } catch (error) {
    console.error('❌ getReflectionHistory 异常:', error)
    return []
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 从 DailyTask 列表创建 TaskSnapshot 列表
 * ⭐ 根据 depth（层级）建立父子关系
 */
export function createTaskSnapshots(tasks: any[]): TaskSnapshot[] {
  const snapshots: TaskSnapshot[] = []
  const parentStack: string[] = [] // 存储各层级的父任务ID
  
  tasks.forEach((task, index) => {
    const depth = task.depth ?? 0
    const taskId = task.id || `task-${task.position ?? index}-${task.title.substring(0, 10)}`
    
    // 根据 depth 确定 parent_task_id
    let parent_task_id: string | null = null
    if (depth > 0 && parentStack[depth - 1]) {
      parent_task_id = parentStack[depth - 1]
    }
    
    // 创建快照
    const snapshot: TaskSnapshot = {
      id: taskId,
      title: task.title,
      priority: task.priority,
      estimatedDuration: task.estimatedDuration,
      deadline: task.deadlineDatetime || task.deadline,
      isCompleted: task.completed || task.isCompleted || false,
      notePosition: task.notePosition || task.position,
      depth: depth,
      parent_task_id: parent_task_id  // ⭐ 设置父任务ID
    }
    
    snapshots.push(snapshot)
    
    // 更新 parentStack：当前任务可能是下一个任务的父任务
    parentStack[depth] = taskId
    // 清除更深层级的记录（因为已经返回到当前层级）
    parentStack.splice(depth + 1)
  })
  
  return snapshots
}

