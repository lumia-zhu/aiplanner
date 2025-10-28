/**
 * 笔记管理 API
 * 用于 Notion-lite 风格的笔记系统
 */

import { createClient } from '@/lib/supabase-client'
import type { JSONContent } from '@tiptap/core'

export interface Note {
  id: string
  user_id: string
  title?: string
  content: JSONContent
  plain_text: string
  note_date: string  // YYYY-MM-DD 格式
  tags: string[]
  has_pending_tasks: boolean
  pending_tasks_count: number
  completed_tasks_count: number
  created_at: string
  updated_at: string
}

export interface NoteMetadata {
  tags: string[]
  pending_tasks_count: number
  completed_tasks_count: number
  has_pending_tasks: boolean
  plain_text: string
}

/**
 * 从 Tiptap JSON 内容中提取元数据
 * 包括：标签、待办数量、纯文本
 */
export function extractMetadata(content: JSONContent): NoteMetadata {
  const tags = new Set<string>()
  let pendingTasks = 0
  let completedTasks = 0
  let plainText = ''

  /**
   * 递归遍历 JSON 内容树
   */
  function traverse(node: any) {
    // 提取标签（未来会有自定义标签节点）
    if (node.type === 'tag' && node.attrs?.label) {
      tags.add(node.attrs.label)
    }

    // 统计待办任务
    if (node.type === 'taskItem') {
      if (node.attrs?.checked) {
        completedTasks++
      } else {
        pendingTasks++
      }
    }

    // 提取纯文本
    if (node.type === 'text' && node.text) {
      plainText += node.text + ' '
    }

    // 递归处理子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  traverse(content)

  return {
    tags: Array.from(tags),
    pending_tasks_count: pendingTasks,
    completed_tasks_count: completedTasks,
    has_pending_tasks: pendingTasks > 0,
    plain_text: plainText.trim().slice(0, 1000)  // 限制长度，避免过大
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatNoteDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取指定日期的笔记
 */
export async function getNoteByDate(userId: string, date: Date): Promise<Note | null> {
  const supabase = createClient()
  const dateStr = formatNoteDate(date)

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('note_date', dateStr)
    .single()

  if (error) {
    // PGRST116 表示没有找到记录，这是正常情况
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('获取笔记失败:', error)
    throw error
  }

  return data
}

/**
 * 保存或更新笔记
 * 如果该日期已有笔记则更新，否则创建新笔记
 */
export async function saveNote(
  userId: string,
  date: Date,
  content: JSONContent
): Promise<Note> {
  const supabase = createClient()
  const dateStr = formatNoteDate(date)
  const metadata = extractMetadata(content)

  const noteData = {
    user_id: userId,
    note_date: dateStr,
    content,
    ...metadata
  }

  const { data, error } = await supabase
    .from('notes')
    .upsert(noteData, {
      onConflict: 'user_id,note_date'
    })
    .select()
    .single()

  if (error) {
    console.error('保存笔记失败:', error)
    throw error
  }

  return data
}

/**
 * 获取日期范围内的笔记
 */
export async function getNotesByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Note[]> {
  const supabase = createClient()
  const startStr = formatNoteDate(startDate)
  const endStr = formatNoteDate(endDate)

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .gte('note_date', startStr)
    .lte('note_date', endStr)
    .order('note_date', { ascending: false })

  if (error) {
    console.error('获取笔记列表失败:', error)
    throw error
  }

  return data || []
}

/**
 * 删除指定日期的笔记
 */
export async function deleteNote(userId: string, date: Date): Promise<void> {
  const supabase = createClient()
  const dateStr = formatNoteDate(date)

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .eq('note_date', dateStr)

  if (error) {
    console.error('删除笔记失败:', error)
    throw error
  }
}

/**
 * 搜索笔记（按纯文本内容）
 */
export async function searchNotes(
  userId: string,
  query: string,
  limit: number = 20
): Promise<Note[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .ilike('plain_text', `%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('搜索笔记失败:', error)
    throw error
  }

  return data || []
}

/**
 * 按标签筛选笔记
 */
export async function getNotesByTag(
  userId: string,
  tag: string
): Promise<Note[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .contains('tags', [tag])
    .order('note_date', { ascending: false })

  if (error) {
    console.error('按标签筛选笔记失败:', error)
    throw error
  }

  return data || []
}

/**
 * 获取所有包含待办的笔记
 */
export async function getNotesWithPendingTasks(userId: string): Promise<Note[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('has_pending_tasks', true)
    .order('note_date', { ascending: true })

  if (error) {
    console.error('获取待办笔记失败:', error)
    throw error
  }

  return data || []
}

/**
 * 获取用户的所有标签（去重）
 */
export async function getAllTags(userId: string): Promise<string[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('tags')
    .eq('user_id', userId)

  if (error) {
    console.error('获取标签列表失败:', error)
    throw error
  }

  // 合并所有标签并去重
  const allTags = new Set<string>()
  data?.forEach(note => {
    note.tags?.forEach((tag: string) => allTags.add(tag))
  })

  return Array.from(allTags).sort()
}

/**
 * 获取笔记统计信息
 */
export async function getNoteStats(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('has_pending_tasks, pending_tasks_count, completed_tasks_count')
    .eq('user_id', userId)

  if (error) {
    console.error('获取笔记统计失败:', error)
    throw error
  }

  const totalNotes = data?.length || 0
  const notesWithTasks = data?.filter(n => n.has_pending_tasks).length || 0
  const totalPending = data?.reduce((sum, n) => sum + (n.pending_tasks_count || 0), 0) || 0
  const totalCompleted = data?.reduce((sum, n) => sum + (n.completed_tasks_count || 0), 0) || 0

  return {
    totalNotes,
    notesWithTasks,
    totalPending,
    totalCompleted,
    totalTasks: totalPending + totalCompleted
  }
}

