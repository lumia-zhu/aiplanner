/**
 * 任务矩阵数据访问层
 * 提供任务矩阵相关的数据库操作
 */

import { createClient } from '@/lib/supabase-client'
import type { 
  TaskMatrix, 
  QuadrantType, 
  CreateTaskMatrixInput, 
  UpdateTaskMatrixInput 
} from '@/types/task-matrix'

// ============================================
// 查询操作
// ============================================

/**
 * 获取用户某天的任务矩阵信息
 * 
 * @param userId - 用户ID
 * @param date - 日期字符串 (YYYY-MM-DD)
 * @returns 任务矩阵信息数组
 * 
 * @example
 * const matrix = await getTaskMatrixByDate(userId, '2025-10-31')
 */
export async function getTaskMatrixByDate(
  userId: string,
  date: string
): Promise<TaskMatrix[]> {
  try {
    console.log(`📊 获取任务矩阵: userId=${userId}, date=${date}`)
    
    const supabase = createClient()
    
    // 1. 先获取该日期的所有笔记任务ID（从 daily_tasks 表）
    const { data: tasks, error: tasksError } = await supabase
      .from('daily_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
    
    if (tasksError) {
      console.error('❌ 获取笔记任务失败:', tasksError)
      throw new Error(`获取笔记任务失败: ${tasksError.message}`)
    }
    
    if (!tasks || tasks.length === 0) {
      console.log('ℹ️ 该日期没有任务')
      return []
    }
    
    const taskIds = tasks.map(t => t.id)
    console.log(`📝 找到 ${taskIds.length} 个笔记任务`)
    
    // 2. 获取这些任务的矩阵信息
    const { data, error } = await supabase
      .from('task_matrix')
      .select('*')
      .eq('user_id', userId)
      .in('task_id', taskIds)
      .order('position', { ascending: true })
    
    if (error) {
      console.error('❌ 获取任务矩阵失败:', error)
      throw new Error(`获取任务矩阵失败: ${error.message}`)
    }
    
    // 3. 转换为 camelCase
    const matrixData: TaskMatrix[] = (data || []).map(row => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      quadrant: row.quadrant as QuadrantType,
      position: row.position || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    
    console.log(`✅ 成功获取 ${matrixData.length} 条任务矩阵记录`)
    return matrixData
    
  } catch (error) {
    console.error('❌ getTaskMatrixByDate 异常:', error)
    throw error
  }
}

/**
 * 获取单个任务的矩阵信息
 * 
 * @param taskId - 任务ID
 * @returns 任务矩阵信息（如果不存在返回 null）
 */
export async function getTaskMatrix(taskId: string): Promise<TaskMatrix | null> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('task_matrix')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle()
    
    if (error) {
      console.error('❌ 获取任务矩阵失败:', error)
      throw new Error(`获取任务矩阵失败: ${error.message}`)
    }
    
    if (!data) {
      return null
    }
    
    return {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      quadrant: data.quadrant as QuadrantType,
      position: data.position || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('❌ getTaskMatrix 异常:', error)
    throw error
  }
}

// ============================================
// 创建操作
// ============================================

/**
 * 初始化任务的矩阵信息（设为待分类）
 * 当新任务创建时调用
 * 
 * @param userId - 用户ID
 * @param taskId - 任务ID
 * @returns 创建的任务矩阵信息
 * 
 * @example
 * const matrix = await initTaskMatrix(userId, newTaskId)
 */
export async function initTaskMatrix(
  userId: string,
  taskId: string
): Promise<TaskMatrix> {
  try {
    console.log(`📥 初始化任务矩阵: taskId=${taskId}`)
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('task_matrix')
      .insert({
        user_id: userId,
        task_id: taskId,
        quadrant: 'unclassified',  // 默认为待分类
        position: 0,
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ 初始化任务矩阵失败:', error)
      throw new Error(`初始化任务矩阵失败: ${error.message}`)
    }
    
    const matrix: TaskMatrix = {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      quadrant: data.quadrant as QuadrantType,
      position: data.position || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    
    console.log('✅ 任务矩阵初始化成功')
    return matrix
  } catch (error) {
    console.error('❌ initTaskMatrix 异常:', error)
    throw error
  }
}

/**
 * 创建任务矩阵信息（可指定象限）
 * 
 * @param userId - 用户ID
 * @param input - 创建输入
 * @returns 创建的任务矩阵信息
 */
export async function createTaskMatrix(
  userId: string,
  input: CreateTaskMatrixInput
): Promise<TaskMatrix> {
  try {
    console.log('📝 创建任务矩阵:', input)
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('task_matrix')
      .insert({
        user_id: userId,
        task_id: input.taskId,
        quadrant: input.quadrant || 'unclassified',
        position: input.position ?? 0,
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ 创建任务矩阵失败:', error)
      throw new Error(`创建任务矩阵失败: ${error.message}`)
    }
    
    const matrix: TaskMatrix = {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      quadrant: data.quadrant as QuadrantType,
      position: data.position || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    
    console.log('✅ 任务矩阵创建成功:', matrix.id)
    return matrix
  } catch (error) {
    console.error('❌ createTaskMatrix 异常:', error)
    throw error
  }
}

// ============================================
// 更新操作
// ============================================

/**
 * 更新任务的象限
 * 最常用的操作：拖拽任务到新象限
 * 
 * @param taskId - 任务ID
 * @param quadrant - 目标象限
 * @param position - 可选：在象限内的位置
 * 
 * @example
 * await updateTaskQuadrant(taskId, 'urgent-important', 1)
 */
export async function updateTaskQuadrant(
  taskId: string,
  quadrant: QuadrantType,
  position?: number
): Promise<void> {
  try {
    console.log(`🔄 更新任务象限: taskId=${taskId}, quadrant=${quadrant}`)
    
    const supabase = createClient()
    
    const updateData: any = {
      quadrant,
      updated_at: new Date().toISOString(),
    }
    
    if (position !== undefined) {
      updateData.position = position
    }
    
    const { error } = await supabase
      .from('task_matrix')
      .update(updateData)
      .eq('task_id', taskId)
    
    if (error) {
      console.error('❌ 更新任务象限失败:', error)
      throw new Error(`更新任务象限失败: ${error.message}`)
    }
    
    console.log('✅ 任务象限更新成功')
  } catch (error) {
    console.error('❌ updateTaskQuadrant 异常:', error)
    throw error
  }
}

/**
 * 更新任务矩阵信息（通用更新）
 * 
 * @param taskId - 任务ID
 * @param updates - 更新数据
 */
export async function updateTaskMatrix(
  taskId: string,
  updates: UpdateTaskMatrixInput
): Promise<void> {
  try {
    console.log(`🔄 更新任务矩阵: taskId=${taskId}`, updates)
    
    const supabase = createClient()
    
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    
    const { error } = await supabase
      .from('task_matrix')
      .update(updateData)
      .eq('task_id', taskId)
    
    if (error) {
      console.error('❌ 更新任务矩阵失败:', error)
      throw new Error(`更新任务矩阵失败: ${error.message}`)
    }
    
    console.log('✅ 任务矩阵更新成功')
  } catch (error) {
    console.error('❌ updateTaskMatrix 异常:', error)
    throw error
  }
}

// ============================================
// 删除操作
// ============================================

/**
 * 删除任务的矩阵信息
 * 当任务被删除时自动级联删除，通常不需要手动调用
 * 
 * @param taskId - 任务ID
 */
export async function deleteTaskMatrix(taskId: string): Promise<void> {
  try {
    console.log(`🗑️ 删除任务矩阵: taskId=${taskId}`)
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('task_matrix')
      .delete()
      .eq('task_id', taskId)
    
    if (error) {
      console.error('❌ 删除任务矩阵失败:', error)
      throw new Error(`删除任务矩阵失败: ${error.message}`)
    }
    
    console.log('✅ 任务矩阵删除成功')
  } catch (error) {
    console.error('❌ deleteTaskMatrix 异常:', error)
    throw error
  }
}

// ============================================
// 辅助工具函数
// ============================================

/**
 * 获取象限内的最大 position 值
 * 用于在象限末尾添加新任务
 * 
 * @param userId - 用户ID
 * @param quadrant - 象限类型
 * @returns 最大 position 值
 */
export async function getMaxPositionInQuadrant(
  userId: string,
  quadrant: QuadrantType
): Promise<number> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('task_matrix')
      .select('position')
      .eq('user_id', userId)
      .eq('quadrant', quadrant)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (error) {
      console.error('❌ 获取最大position失败:', error)
      return 0
    }
    
    return data?.position ?? 0
  } catch (error) {
    console.error('❌ getMaxPositionInQuadrant 异常:', error)
    return 0
  }
}

/**
 * 批量更新任务的 position（用于拖拽排序）
 * 
 * @param updates - 更新数组 [{ taskId, position }, ...]
 */
export async function batchUpdatePositions(
  updates: Array<{ taskId: string; position: number }>
): Promise<void> {
  try {
    console.log(`🔄 批量更新position: ${updates.length} 条记录`)
    
    const supabase = createClient()
    
    // 逐个更新（Supabase 不支持批量 UPDATE）
    const promises = updates.map(({ taskId, position }) =>
      supabase
        .from('task_matrix')
        .update({ position, updated_at: new Date().toISOString() })
        .eq('task_id', taskId)
    )
    
    const results = await Promise.all(promises)
    
    // 检查是否有错误
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('❌ 批量更新部分失败:', errors)
      throw new Error(`批量更新失败: ${errors.length} 条记录`)
    }
    
    console.log('✅ 批量更新position成功')
  } catch (error) {
    console.error('❌ batchUpdatePositions 异常:', error)
    throw error
  }
}

/**
 * 检查任务是否已初始化矩阵信息
 * 
 * @param taskId - 任务ID
 * @returns 是否已初始化
 */
export async function hasTaskMatrix(taskId: string): Promise<boolean> {
  try {
    const matrix = await getTaskMatrix(taskId)
    return matrix !== null
  } catch (error) {
    console.error('❌ hasTaskMatrix 异常:', error)
    return false
  }
}

/**
 * 确保任务有矩阵信息（如果没有则创建）
 * 
 * @param userId - 用户ID
 * @param taskId - 任务ID
 * @returns 任务矩阵信息
 */
export async function ensureTaskMatrix(
  userId: string,
  taskId: string
): Promise<TaskMatrix> {
  try {
    // 先尝试获取
    let matrix = await getTaskMatrix(taskId)
    
    // 如果不存在，则创建
    if (!matrix) {
      console.log('📥 任务矩阵不存在，自动创建')
      matrix = await initTaskMatrix(userId, taskId)
    }
    
    return matrix
  } catch (error) {
    console.error('❌ ensureTaskMatrix 异常:', error)
    throw error
  }
}

