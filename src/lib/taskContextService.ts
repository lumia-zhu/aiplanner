// ============================================
// 任务上下文信息服务层
// ============================================
// 功能：管理从反思问答中提取的任务上下文信息
// ============================================

import { createClient } from '@/lib/supabase-client'
import type {
  TaskContextInfo,
  AddContextInfoRequest,
  UpdateContextInfoRequest
} from '@/types/task-context'

// ============================================
// 数据库字段映射
// ============================================

/**
 * 数据库记录 → TaskContextInfo
 */
function mapDbToTaskContextInfo(dbRecord: any): TaskContextInfo {
  return {
    id: dbRecord.id,
    task_id: dbRecord.task_id,
    content: dbRecord.content,
    source: dbRecord.source,
    source_question: dbRecord.source_question || undefined,
    source_answer: dbRecord.source_answer || undefined,
    display_order: dbRecord.display_order || 0,
    created_at: dbRecord.created_at,
    updated_at: dbRecord.updated_at
  }
}

/**
 * AddContextInfoRequest → 数据库插入格式
 */
function mapRequestToDb(request: AddContextInfoRequest) {
  return {
    task_id: request.task_id,
    content: request.content,
    source: request.source,
    source_question: request.source_question || null,
    source_answer: request.source_answer || null,
    display_order: request.display_order ?? 0
  }
}

// ============================================
// CRUD 操作
// ============================================

/**
 * 创建上下文信息
 */
export async function createContextInfo(
  request: AddContextInfoRequest
): Promise<TaskContextInfo> {
  const supabase = createClient()
  
  const dbData = mapRequestToDb(request)
  
  const { data, error } = await supabase
    .from('task_context_info')
    .insert(dbData)
    .select()
    .single()
  
  if (error) {
    console.error('❌ 创建上下文信息失败:', error)
    console.error('详细错误信息:', JSON.stringify(error, null, 2))
    console.error('尝试插入的数据:', dbData)
    throw new Error(`创建上下文信息失败: ${error.message || error.code || JSON.stringify(error)}`)
  }
  
  console.log('✅ 上下文信息已创建:', data.id)
  return mapDbToTaskContextInfo(data)
}

/**
 * 批量创建上下文信息
 */
export async function batchCreateContextInfo(
  requests: AddContextInfoRequest[]
): Promise<TaskContextInfo[]> {
  const supabase = createClient()
  
  const dbDataList = requests.map(mapRequestToDb)
  
  const { data, error } = await supabase
    .from('task_context_info')
    .insert(dbDataList)
    .select()
  
  if (error) {
    console.error('❌ 批量创建上下文信息失败:', error)
    throw new Error(`批量创建上下文信息失败: ${error.message}`)
  }
  
  console.log('✅ 批量创建上下文信息成功:', data.length, '条')
  return data.map(mapDbToTaskContextInfo)
}

/**
 * 获取任务的所有上下文信息
 */
export async function getContextInfoByTaskId(
  taskId: string
): Promise<TaskContextInfo[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('task_context_info')
    .select('*')
    .eq('task_id', taskId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('❌ 获取上下文信息失败:', error)
    throw new Error(`获取上下文信息失败: ${error.message}`)
  }
  
  return (data || []).map(mapDbToTaskContextInfo)
}

/**
 * 获取多个任务的上下文信息（批量查询）
 */
export async function getContextInfoByTaskIds(
  taskIds: string[]
): Promise<Map<string, TaskContextInfo[]>> {
  if (taskIds.length === 0) {
    return new Map()
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('task_context_info')
    .select('*')
    .in('task_id', taskIds)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('❌ 批量获取上下文信息失败:', error)
    throw new Error(`批量获取上下文信息失败: ${error.message}`)
  }
  
  // 按 task_id 分组
  const result = new Map<string, TaskContextInfo[]>()
  for (const record of data || []) {
    const contextInfo = mapDbToTaskContextInfo(record)
    const existing = result.get(contextInfo.task_id) || []
    existing.push(contextInfo)
    result.set(contextInfo.task_id, existing)
  }
  
  return result
}

/**
 * 更新上下文信息
 */
export async function updateContextInfo(
  id: string,
  updates: UpdateContextInfoRequest
): Promise<TaskContextInfo> {
  const supabase = createClient()
  
  const dbUpdates: any = {}
  if (updates.content !== undefined) {
    dbUpdates.content = updates.content
  }
  if (updates.display_order !== undefined) {
    dbUpdates.display_order = updates.display_order
  }
  
  const { data, error } = await supabase
    .from('task_context_info')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('❌ 更新上下文信息失败:', error)
    throw new Error(`更新上下文信息失败: ${error.message}`)
  }
  
  console.log('✅ 上下文信息已更新:', id)
  return mapDbToTaskContextInfo(data)
}

/**
 * 删除上下文信息
 */
export async function deleteContextInfo(id: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('task_context_info')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('❌ 删除上下文信息失败:', error)
    throw new Error(`删除上下文信息失败: ${error.message}`)
  }
  
  console.log('✅ 上下文信息已删除:', id)
}

/**
 * 删除任务的所有上下文信息
 */
export async function deleteContextInfoByTaskId(taskId: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('task_context_info')
    .delete()
    .eq('task_id', taskId)
  
  if (error) {
    console.error('❌ 删除任务的上下文信息失败:', error)
    throw new Error(`删除任务的上下文信息失败: ${error.message}`)
  }
  
  console.log('✅ 任务的所有上下文信息已删除:', taskId)
}

