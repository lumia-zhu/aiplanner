/**
 * 用户个人资料管理模块
 * 提供用户个人资料的 CRUD 操作
 */

import { createClient } from '@/lib/supabase-client'
import type { UserProfile, UserProfileInput } from '@/types'

/**
 * 获取用户个人资料
 * @param userId 用户ID
 * @returns 用户个人资料，如果不存在则返回 null
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      // 如果是找不到记录的错误，返回 null（用户首次使用）
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('获取用户个人资料失败:', error)
      throw error
    }
    
    return data as UserProfile
  } catch (error) {
    console.error('获取用户个人资料异常:', error)
    return null
  }
}

/**
 * 创建用户个人资料
 * @param userId 用户ID
 * @param profileInput 个人资料输入数据
 * @returns 创建的个人资料
 */
export async function createUserProfile(
  userId: string,
  profileInput: UserProfileInput
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const supabase = createClient()
    
    // 准备插入数据
    const insertData = {
      user_id: userId,
      major: profileInput.major || null,
      grade: profileInput.grade || null,
      challenges: profileInput.challenges || [],
      workplaces: profileInput.workplaces || [],
      custom_task_tags: profileInput.custom_task_tags || [],
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(insertData)
      .select()
      .single()
    
    if (error) {
      console.error('创建用户个人资料失败:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data: data as UserProfile }
  } catch (error) {
    console.error('创建用户个人资料异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 更新用户个人资料
 * @param userId 用户ID
 * @param profileInput 要更新的个人资料数据
 * @returns 更新后的个人资料
 */
export async function updateUserProfile(
  userId: string,
  profileInput: UserProfileInput
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const supabase = createClient()
    
    // 准备更新数据（只更新提供的字段）
    const updateData: Record<string, any> = {}
    
    if (profileInput.major !== undefined) {
      updateData.major = profileInput.major || null
    }
    if (profileInput.grade !== undefined) {
      updateData.grade = profileInput.grade || null
    }
    if (profileInput.challenges !== undefined) {
      updateData.challenges = profileInput.challenges
    }
    if (profileInput.workplaces !== undefined) {
      updateData.workplaces = profileInput.workplaces
    }
    if (profileInput.custom_task_tags !== undefined) {
      updateData.custom_task_tags = profileInput.custom_task_tags
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('更新用户个人资料失败:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data: data as UserProfile }
  } catch (error) {
    console.error('更新用户个人资料异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 创建或更新用户个人资料（upsert 操作）
 * @param userId 用户ID
 * @param profileInput 个人资料输入数据
 * @returns 创建或更新后的个人资料
 */
export async function upsertUserProfile(
  userId: string,
  profileInput: UserProfileInput
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const supabase = createClient()
    
    // 准备 upsert 数据
    const upsertData = {
      user_id: userId,
      major: profileInput.major || null,
      grade: profileInput.grade || null,
      challenges: profileInput.challenges || [],
      workplaces: profileInput.workplaces || [],
      custom_task_tags: profileInput.custom_task_tags || [],
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(upsertData, {
        onConflict: 'user_id',  // 基于 user_id 的唯一约束
      })
      .select()
      .single()
    
    if (error) {
      console.error('保存用户个人资料失败:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, data: data as UserProfile }
  } catch (error) {
    console.error('保存用户个人资料异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 删除用户个人资料
 * @param userId 用户ID
 * @returns 是否删除成功
 */
export async function deleteUserProfile(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId)
    
    if (error) {
      console.error('删除用户个人资料失败:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('删除用户个人资料异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

// ============================================
// 任务标签池管理功能
// ============================================

/**
 * 获取用户的自定义任务标签池
 * @param userId 用户ID
 * @returns 自定义标签数组
 */
export async function getUserCustomTaskTags(userId: string): Promise<string[]> {
  try {
    const profile = await getUserProfile(userId)
    return profile?.custom_task_tags ?? []
  } catch (error) {
    console.error('获取用户自定义标签失败:', error)
    return []
  }
}

/**
 * 添加自定义任务标签到用户标签池
 * 会自动去重,不会添加重复标签
 * @param userId 用户ID
 * @param tag 要添加的标签
 * @returns 更新后的标签数组
 */
export async function addCustomTaskTag(
  userId: string,
  tag: string
): Promise<{ success: boolean; tags?: string[]; error?: string }> {
  try {
    const supabase = createClient()
    
    // 获取当前标签池
    const currentTags = await getUserCustomTaskTags(userId)
    
    // 检查是否已存在
    if (currentTags.includes(tag)) {
      return { success: true, tags: currentTags }
    }
    
    // 添加新标签(去重)
    const updatedTags = Array.from(new Set([...currentTags, tag]))
    
    // 更新数据库
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ custom_task_tags: updatedTags })
      .eq('user_id', userId)
      .select('custom_task_tags')
      .single()
    
    if (error) {
      console.error('添加自定义标签失败:', error)
      return { success: false, error: error.message }
    }
    
    return { 
      success: true, 
      tags: data?.custom_task_tags ?? updatedTags 
    }
  } catch (error) {
    console.error('添加自定义标签异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 批量添加自定义任务标签到用户标签池
 * @param userId 用户ID
 * @param tags 要添加的标签数组
 * @returns 更新后的标签数组
 */
export async function addCustomTaskTags(
  userId: string,
  tags: string[]
): Promise<{ success: boolean; tags?: string[]; error?: string }> {
  try {
    const supabase = createClient()
    
    // 获取当前标签池
    const currentTags = await getUserCustomTaskTags(userId)
    
    // 合并并去重
    const updatedTags = Array.from(new Set([...currentTags, ...tags]))
    
    // 更新数据库
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ custom_task_tags: updatedTags })
      .eq('user_id', userId)
      .select('custom_task_tags')
      .single()
    
    if (error) {
      console.error('批量添加自定义标签失败:', error)
      return { success: false, error: error.message }
    }
    
    return { 
      success: true, 
      tags: data?.custom_task_tags ?? updatedTags 
    }
  } catch (error) {
    console.error('批量添加自定义标签异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 从用户标签池中删除自定义任务标签
 * @param userId 用户ID
 * @param tag 要删除的标签
 * @returns 更新后的标签数组
 */
export async function removeCustomTaskTag(
  userId: string,
  tag: string
): Promise<{ success: boolean; tags?: string[]; error?: string }> {
  try {
    const supabase = createClient()
    
    // 获取当前标签池
    const currentTags = await getUserCustomTaskTags(userId)
    
    // 过滤掉要删除的标签
    const updatedTags = currentTags.filter(t => t !== tag)
    
    // 更新数据库
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ custom_task_tags: updatedTags })
      .eq('user_id', userId)
      .select('custom_task_tags')
      .single()
    
    if (error) {
      console.error('删除自定义标签失败:', error)
      return { success: false, error: error.message }
    }
    
    return { 
      success: true, 
      tags: data?.custom_task_tags ?? updatedTags 
    }
  } catch (error) {
    console.error('删除自定义标签异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

/**
 * 清空用户的自定义任务标签池
 * @param userId 用户ID
 * @returns 是否成功
 */
export async function clearCustomTaskTags(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ custom_task_tags: [] })
      .eq('user_id', userId)
    
    if (error) {
      console.error('清空自定义标签失败:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    console.error('清空自定义标签异常:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }
  }
}

