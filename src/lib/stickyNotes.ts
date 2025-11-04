/**
 * 便签数据访问层
 * 提供便签的增删改查功能
 */

import { createClient } from '@/lib/supabase-client'
import type { StickyNote, CreateStickyNoteInput, UpdateStickyNoteInput } from '@/types'

// 创建 Supabase 客户端
const supabase = createClient()

/**
 * 获取用户的所有可见便签（全局显示，不受日期限制）
 * @param userId - 用户ID
 * @returns 便签数组，按层级排序（z_index升序）
 */
export async function getStickyNotes(
  userId: string
): Promise<StickyNote[]> {
  try {
    console.log(`📋 获取全局便签: userId=${userId}`)
    
    const { data, error } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_global', true)      // 只查询全局便签
      .eq('is_hidden', false)     // 只查询未隐藏的便签
      .order('z_index', { ascending: true }) // 按层级排序
    
    if (error) {
      console.error('❌ 获取便签失败:', error)
      throw new Error(`获取便签失败: ${error.message}`)
    }
    
    // 转换数据库字段名（snake_case -> camelCase）
    const stickyNotes: StickyNote[] = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      noteDate: row.note_date,
      content: row.content || '',
      positionX: row.position_x,
      positionY: row.position_y,
      width: row.width || 280,
      height: row.height || 320,
      color: row.color,
      zIndex: row.z_index,
      isHidden: row.is_hidden || false,
      isGlobal: row.is_global ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    
    console.log(`✅ 成功获取 ${stickyNotes.length} 个便签`)
    return stickyNotes
    
  } catch (error) {
    console.error('❌ getStickyNotes 异常:', error)
    return [] // 出错时返回空数组，不中断应用
  }
}

/**
 * 获取指定日期和用户的所有便签（保留旧函数名以兼容）
 * @deprecated 请使用 getStickyNotes() 代替
 */
export async function getStickyNotesByDate(
  userId: string,
  noteDate: string
): Promise<StickyNote[]> {
  // 现在返回全局便签，不再按日期过滤
  return getStickyNotes(userId)
}

/**
 * 创建新便签
 * @param userId - 用户ID
 * @param input - 创建便签的输入参数
 * @returns 创建成功的便签对象
 */
export async function createStickyNote(
  userId: string,
  input: CreateStickyNoteInput
): Promise<StickyNote> {
  try {
    console.log('📝 创建便签:', input)
    
    // 准备插入数据（使用snake_case字段名）
    const insertData = {
      user_id: userId,
      note_date: input.noteDate,
      content: input.content || '',
      position_x: input.positionX ?? 100,
      position_y: input.positionY ?? 100,
      width: input.width ?? 280,
      height: input.height ?? 320,
      color: input.color || 'yellow',
      z_index: input.zIndex ?? 1,
      is_global: true,   // 默认全局显示
      is_hidden: false,  // 默认未隐藏
    }
    
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert(insertData)
      .select()
      .single()
    
    if (error) {
      console.error('❌ 创建便签失败:', error)
      throw new Error(`创建便签失败: ${error.message}`)
    }
    
    // 转换为 camelCase
    const stickyNote: StickyNote = {
      id: data.id,
      userId: data.user_id,
      noteDate: data.note_date,
      content: data.content || '',
      positionX: data.position_x,
      positionY: data.position_y,
      width: data.width || 280,
      height: data.height || 320,
      color: data.color,
      zIndex: data.z_index,
      isHidden: data.is_hidden || false,
      isGlobal: data.is_global ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    
    console.log('✅ 便签创建成功:', stickyNote.id)
    return stickyNote
    
  } catch (error) {
    console.error('❌ createStickyNote 异常:', error)
    throw error // 创建失败时抛出异常
  }
}

/**
 * 更新便签
 * @param noteId - 便签ID
 * @param input - 更新的字段
 * @returns 更新后的便签对象
 */
export async function updateStickyNote(
  noteId: string,
  input: UpdateStickyNoteInput
): Promise<StickyNote> {
  try {
    console.log(`🔄 更新便签: id=${noteId}`, input)
    
    // 准备更新数据（只更新提供的字段）
    const updateData: Record<string, any> = {}
    
    if (input.content !== undefined) {
      updateData.content = input.content
    }
    if (input.positionX !== undefined) {
      updateData.position_x = input.positionX
    }
    if (input.positionY !== undefined) {
      updateData.position_y = input.positionY
    }
    if (input.width !== undefined) {
      updateData.width = input.width
    }
    if (input.height !== undefined) {
      updateData.height = input.height
    }
    if (input.color !== undefined) {
      updateData.color = input.color
    }
    if (input.zIndex !== undefined) {
      updateData.z_index = input.zIndex
    }
    
    // 如果没有要更新的字段，直接返回
    if (Object.keys(updateData).length === 0) {
      console.log('⚠️ 没有需要更新的字段')
      // 查询当前数据并返回
      const { data, error } = await supabase
        .from('sticky_notes')
        .select('*')
        .eq('id', noteId)
        .single()
      
      if (error) throw new Error(`查询便签失败: ${error.message}`)
      
      return {
        id: data.id,
        userId: data.user_id,
        noteDate: data.note_date,
        content: data.content || '',
        positionX: data.position_x,
        positionY: data.position_y,
        width: data.width || 280,
        height: data.height || 320,
        color: data.color,
        zIndex: data.z_index,
        isHidden: data.is_hidden || false,
        isGlobal: data.is_global ?? true,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    }
    
    const { data, error } = await supabase
      .from('sticky_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single()
    
    if (error) {
      console.error('❌ 更新便签失败:', error)
      throw new Error(`更新便签失败: ${error.message}`)
    }
    
    // 转换为 camelCase
    const stickyNote: StickyNote = {
      id: data.id,
      userId: data.user_id,
      noteDate: data.note_date,
      content: data.content || '',
      positionX: data.position_x,
      positionY: data.position_y,
      width: data.width || 280,
      height: data.height || 320,
      color: data.color,
      zIndex: data.z_index,
      isHidden: data.is_hidden || false,
      isGlobal: data.is_global ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    
    console.log('✅ 便签更新成功:', stickyNote.id)
    return stickyNote
    
  } catch (error) {
    console.error('❌ updateStickyNote 异常:', error)
    throw error // 更新失败时抛出异常
  }
}

/**
 * 删除便签
 * @param noteId - 便签ID
 * @returns 删除是否成功
 */
export async function deleteStickyNote(noteId: string): Promise<boolean> {
  try {
    console.log(`🗑️ 删除便签: id=${noteId}`)
    
    const { error } = await supabase
      .from('sticky_notes')
      .delete()
      .eq('id', noteId)
    
    if (error) {
      console.error('❌ 删除便签失败:', error)
      throw new Error(`删除便签失败: ${error.message}`)
    }
    
    console.log('✅ 便签删除成功:', noteId)
    return true
    
  } catch (error) {
    console.error('❌ deleteStickyNote 异常:', error)
    throw error // 删除失败时抛出异常
  }
}

/**
 * 批量更新便签的层级（用于重新排序）
 * @param updates - 便签ID和新层级的映射数组
 * @returns 更新是否成功
 */
export async function batchUpdateZIndex(
  updates: Array<{ id: string; zIndex: number }>
): Promise<boolean> {
  try {
    console.log(`🔄 批量更新层级: ${updates.length} 个便签`)
    
    // 逐个更新（Supabase 不支持批量更新不同值）
    const promises = updates.map(({ id, zIndex }) =>
      supabase
        .from('sticky_notes')
        .update({ z_index: zIndex })
        .eq('id', id)
    )
    
    const results = await Promise.all(promises)
    
    // 检查是否有错误
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('❌ 部分层级更新失败:', errors)
      throw new Error(`${errors.length} 个便签层级更新失败`)
    }
    
    console.log('✅ 批量层级更新成功')
    return true
    
  } catch (error) {
    console.error('❌ batchUpdateZIndex 异常:', error)
    throw error
  }
}

/**
 * 获取指定日期便签的最大层级值
 * @param userId - 用户ID
 * @param noteDate - 笔记日期
 * @returns 最大层级值（如果没有便签则返回0）
 */
export async function getMaxZIndex(
  userId: string,
  noteDate: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('sticky_notes')
      .select('z_index')
      .eq('user_id', userId)
      .eq('note_date', noteDate)
      .order('z_index', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      // 如果没有数据，返回0
      if (error.code === 'PGRST116') {
        return 0
      }
      throw new Error(`获取最大层级失败: ${error.message}`)
    }
    
    return data?.z_index || 0
    
  } catch (error) {
    console.error('❌ getMaxZIndex 异常:', error)
    return 0 // 出错时返回0
  }
}

/**
 * 隐藏便签（不删除，可恢复）
 * @param noteId - 便签ID
 * @returns 更新是否成功
 */
export async function hideStickyNote(noteId: string): Promise<boolean> {
  try {
    console.log(`👁️ 隐藏便签: id=${noteId}`)
    
    const { error } = await supabase
      .from('sticky_notes')
      .update({ is_hidden: true })
      .eq('id', noteId)
    
    if (error) {
      console.error('❌ 隐藏便签失败:', error)
      throw new Error(`隐藏便签失败: ${error.message}`)
    }
    
    console.log('✅ 便签隐藏成功:', noteId)
    return true
    
  } catch (error) {
    console.error('❌ hideStickyNote 异常:', error)
    throw error
  }
}

/**
 * 恢复隐藏的便签
 * @param noteId - 便签ID
 * @param position - 可选的新位置（如果不提供则使用原位置）
 * @returns 恢复后的便签对象
 */
export async function restoreStickyNote(
  noteId: string,
  position?: { x: number; y: number }
): Promise<StickyNote> {
  try {
    console.log(`🔄 恢复便签: id=${noteId}`, position)
    
    const updateData: Record<string, any> = { is_hidden: false }
    
    // 如果提供了新位置，则更新位置
    if (position) {
      updateData.position_x = position.x
      updateData.position_y = position.y
    }
    
    const { data, error } = await supabase
      .from('sticky_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single()
    
    if (error) {
      console.error('❌ 恢复便签失败:', error)
      throw new Error(`恢复便签失败: ${error.message}`)
    }
    
    // 转换为 camelCase
    const stickyNote: StickyNote = {
      id: data.id,
      userId: data.user_id,
      noteDate: data.note_date,
      content: data.content || '',
      positionX: data.position_x,
      positionY: data.position_y,
      width: data.width || 280,
      height: data.height || 320,
      color: data.color,
      zIndex: data.z_index,
      isHidden: data.is_hidden || false,
      isGlobal: data.is_global ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    
    console.log('✅ 便签恢复成功:', stickyNote.id)
    return stickyNote
    
  } catch (error) {
    console.error('❌ restoreStickyNote 异常:', error)
    throw error
  }
}

/**
 * 获取用户的所有隐藏便签
 * @param userId - 用户ID
 * @returns 隐藏便签数组，按更新时间降序排序（最新的在前）
 */
export async function getHiddenStickyNotes(userId: string): Promise<StickyNote[]> {
  try {
    console.log(`📋 获取隐藏便签: userId=${userId}`)
    
    const { data, error } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_hidden', true)
      .order('updated_at', { ascending: false }) // 按更新时间降序
    
    if (error) {
      console.error('❌ 获取隐藏便签失败:', error)
      throw new Error(`获取隐藏便签失败: ${error.message}`)
    }
    
    // 转换数据库字段名（snake_case -> camelCase）
    const stickyNotes: StickyNote[] = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      noteDate: row.note_date,
      content: row.content || '',
      positionX: row.position_x,
      positionY: row.position_y,
      width: row.width || 280,
      height: row.height || 320,
      color: row.color,
      zIndex: row.z_index,
      isHidden: row.is_hidden || false,
      isGlobal: row.is_global ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    
    console.log(`✅ 成功获取 ${stickyNotes.length} 个隐藏便签`)
    return stickyNotes
    
  } catch (error) {
    console.error('❌ getHiddenStickyNotes 异常:', error)
    return [] // 出错时返回空数组
  }
}

