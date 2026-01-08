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
 * 在笔记中追加一个任务项（用于从历史快速添加任务）
 * @param userId - 用户ID
 * @param date - 目标日期
 * @param taskTitle - 任务标题（可能包含标签等）
 */
export async function appendTaskToNote(
  userId: string,
  date: Date,
  taskTitle: string
): Promise<Note> {
  try {
    const supabase = createClient()
    const dateStr = formatNoteDate(date)
    
    console.log('📝 追加任务到笔记:', { dateStr, taskTitle })
    
    // 1. 获取当前日期的笔记（如果存在）
    const existingNote = await getNoteByDate(userId, date)
    
    // 2. 创建新的 taskItem 节点（Tiptap 格式）
    // 解析标题中的标签和优先级，创建对应的 mark 节点
    const paragraphContent: JSONContent[] = []
    
    // 正则提取标签（#xxx）
    const tagRegex = /#\s*([^\s#@]+)/g
    const tags: Array<{ label: string; position: number }> = []
    let match
    while ((match = tagRegex.exec(taskTitle)) !== null) {
      tags.push({
        label: match[1],
        position: match.index
      })
    }
    
    if (tags.length === 0) {
      // 没有标签，直接创建文本节点
      paragraphContent.push({
        type: 'text',
        text: taskTitle
      })
    } else {
      // 有标签，需要分段创建节点
      let lastIndex = 0
      
      tags.forEach(tag => {
        // 添加标签前的文本
        if (tag.position > lastIndex) {
          const beforeText = taskTitle.substring(lastIndex, tag.position).trim()
          if (beforeText) {
            paragraphContent.push({
              type: 'text',
              text: beforeText + ' '
            })
          }
        }
        
        // 添加标签节点（使用 taskTag mark）
        paragraphContent.push({
          type: 'text',
          text: tag.label,
          marks: [
            {
              type: 'taskTag',
              attrs: {
                label: tag.label,
                color: '#7FA1C3',  // 默认蓝色
                emoji: '🏷️'
              }
            }
          ]
        })
        
        // 🔑 关键：在标签后添加一个普通空格（没有 mark），防止继续输入时继承标签样式
        paragraphContent.push({
          type: 'text',
          text: ' '
        })
        
        // 更新位置（跳过 # 和标签文本）
        lastIndex = tag.position + tag.label.length + 1
      })
      
      // 添加标签后的文本（如果有）
      if (lastIndex < taskTitle.length) {
        const afterText = taskTitle.substring(lastIndex).trim()
        if (afterText) {
          paragraphContent.push({
            type: 'text',
            text: afterText  // 不需要前导空格，因为已经在标签后添加了
          })
        }
      }
    }
    
    const newTaskItem: JSONContent = {
      type: 'taskItem',
      attrs: { checked: false },
      content: [
        {
          type: 'paragraph',
          content: paragraphContent
        }
      ]
    }
    
    let updatedContent: JSONContent
    
    if (existingNote && existingNote.content) {
      // 3a. 如果笔记已存在，查找或创建 taskList
      const content = existingNote.content
      
      // 确保有顶层 doc 结构
      if (!content.content || !Array.isArray(content.content)) {
        // 如果没有 content 数组，创建基本结构
        updatedContent = {
          type: 'doc',
          content: [
            {
              type: 'taskList',
              content: [newTaskItem]
            }
          ]
        }
      } else {
        // 查找现有的 taskList
        let taskListFound = false
        const newContent = content.content.map((node: any) => {
          if (node.type === 'taskList') {
            taskListFound = true
            // 在现有 taskList 末尾追加新任务
            return {
              ...node,
              content: [...(node.content || []), newTaskItem]
            }
          }
          return node
        })
        
        // 如果没有找到 taskList，在末尾添加一个
        if (!taskListFound) {
          newContent.push({
            type: 'taskList',
            content: [newTaskItem]
          })
        }
        
        updatedContent = {
          ...content,
          content: newContent
        }
      }
    } else {
      // 3b. 如果笔记不存在，创建新的笔记结构
      updatedContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [newTaskItem]
          }
        ]
      }
    }
    
    console.log('📄 更新后的笔记结构:', JSON.stringify(updatedContent, null, 2))
    
    // 4. 使用 saveNote 保存（自动处理 upsert 和元数据）
    const savedNote = await saveNote(userId, date, updatedContent)
    
    console.log('✅ 任务已追加到笔记:', savedNote.id)
    return savedNote
    
  } catch (error) {
    console.error('❌ 追加任务到笔记失败:', error)
    throw error
  }
}

/**
 * 追加完整的任务节点到笔记（保留上下文信息和子任务）
 * 
 * @param userId - 用户ID
 * @param date - 目标日期
 * @param taskNode - 完整的 taskItem 节点（Tiptap JSON 格式）
 */
/**
 * 任务树节点接口（Agent 返回的格式）
 */
export interface TaskTreeNode {
  id?: string
  title: string
  isCompleted?: boolean
  children?: TaskTreeNode[]
}

/**
 * 将任务树转换为 Tiptap taskItem 节点
 * 递归处理子任务，生成正确的嵌套结构
 * 
 * @param task - 任务树节点（带 children 的树形结构）
 * @returns Tiptap JSONContent 格式的 taskItem 节点
 */
export function taskTreeToTiptapNode(task: TaskTreeNode): JSONContent {
  // 创建任务标题的段落内容
  const paragraphContent: JSONContent[] = []
  
  // 解析标题中的标签
  const tagRegex = /#\s*([^\s#@]+)/g
  const tags: Array<{ label: string; position: number }> = []
  let match
  while ((match = tagRegex.exec(task.title)) !== null) {
    tags.push({
      label: match[1],
      position: match.index
    })
  }
  
  if (tags.length === 0) {
    paragraphContent.push({
      type: 'text',
      text: task.title
    })
  } else {
    let lastIndex = 0
    tags.forEach(tag => {
      if (tag.position > lastIndex) {
        const beforeText = task.title.substring(lastIndex, tag.position).trim()
        if (beforeText) {
          paragraphContent.push({
            type: 'text',
            text: beforeText + ' '
          })
        }
      }
      paragraphContent.push({
        type: 'text',
        text: tag.label,
        marks: [{
          type: 'taskTag',
          attrs: {
            label: tag.label,
            color: '#7FA1C3',
            emoji: '🏷️'
          }
        }]
      })
      paragraphContent.push({
        type: 'text',
        text: ' '
      })
      lastIndex = tag.position + tag.label.length + 1
    })
    if (lastIndex < task.title.length) {
      const afterText = task.title.substring(lastIndex).trim()
      if (afterText) {
        paragraphContent.push({
          type: 'text',
          text: afterText
        })
      }
    }
  }
  
  // 构建 taskItem 节点的内容
  const taskItemContent: JSONContent[] = [
    {
      type: 'paragraph',
      content: paragraphContent
    }
  ]
  
  // 🆕 如果有子任务，递归创建嵌套的 taskList
  if (task.children && task.children.length > 0) {
    const childTaskItems = task.children.map(child => taskTreeToTiptapNode(child))
    taskItemContent.push({
      type: 'taskList',
      content: childTaskItems
    })
  }
  
  return {
    type: 'taskItem',
    attrs: { checked: task.isCompleted || false },
    content: taskItemContent
  }
}

/**
 * 批量追加任务树到笔记（保留层级结构）
 * 
 * @param userId - 用户ID
 * @param date - 目标日期
 * @param tasks - 任务树数组（带 children 的树形结构）
 */
export async function appendTaskTreeToNote(
  userId: string,
  date: Date,
  tasks: TaskTreeNode[]
): Promise<Note> {
  try {
    const dateStr = formatNoteDate(date)
    console.log('📝 批量追加任务树到笔记:', { dateStr, taskCount: tasks.length })
    
    // 1. 获取当前日期的笔记
    const existingNote = await getNoteByDate(userId, date)
    
    // 2. 将任务树转换为 Tiptap 节点数组
    const taskNodes = tasks.map(task => taskTreeToTiptapNode(task))
    
    let updatedContent: JSONContent
    
    if (existingNote && existingNote.content) {
      const content = existingNote.content
      
      if (!content.content || !Array.isArray(content.content)) {
        updatedContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: taskNodes
          }]
        }
      } else {
        let taskListFound = false
        const newContent = content.content.map((node: any) => {
          if (node.type === 'taskList') {
            taskListFound = true
            return {
              ...node,
              content: [...(node.content || []), ...taskNodes]
            }
          }
          return node
        })
        
        if (!taskListFound) {
          newContent.push({
            type: 'taskList',
            content: taskNodes
          })
        }
        
        updatedContent = {
          ...content,
          content: newContent
        }
      }
    } else {
      updatedContent = {
        type: 'doc',
        content: [{
          type: 'taskList',
          content: taskNodes
        }]
      }
    }
    
    // 3. 保存笔记
    const savedNote = await saveNote(userId, date, updatedContent)
    console.log('✅ 任务树已追加到笔记:', savedNote.id)
    return savedNote
    
  } catch (error) {
    console.error('❌ 追加任务树失败:', error)
    throw error
  }
}

/**
 * 追加完整的任务节点到笔记（保留上下文信息和子任务）
 * 
 * @param userId - 用户ID
 * @param date - 目标日期
 * @param taskNode - 完整的 taskItem 节点（Tiptap JSON 格式）
 */
export async function appendTaskNodeToNote(
  userId: string,
  date: Date,
  taskNode: JSONContent
): Promise<Note> {
  try {
    const supabase = createClient()
    const dateStr = formatNoteDate(date)
    
    console.log('📝 追加完整任务节点到笔记:', { dateStr, nodeType: taskNode.type })
    
    // 1. 获取当前日期的笔记（如果存在）
    const existingNote = await getNoteByDate(userId, date)
    
    // 2. 确保是 taskItem 节点
    if (taskNode.type !== 'taskItem') {
      throw new Error('只能追加 taskItem 节点')
    }
    
    // 3. 克隆节点并重置 checked 状态为 false（新添加的任务应该是未完成状态）
    const clonedNode: JSONContent = JSON.parse(JSON.stringify(taskNode))
    if (clonedNode.attrs) {
      clonedNode.attrs.checked = false
    }
    
    let updatedContent: JSONContent
    
    if (existingNote && existingNote.content) {
      // 4a. 如果笔记已存在，查找或创建 taskList
      const content = existingNote.content
      
      if (!content.content || !Array.isArray(content.content)) {
        updatedContent = {
          type: 'doc',
          content: [
            {
              type: 'taskList',
              content: [clonedNode]
            }
          ]
        }
      } else {
        let taskListFound = false
        const newContent = content.content.map((node: any) => {
          if (node.type === 'taskList') {
            taskListFound = true
            return {
              ...node,
              content: [...(node.content || []), clonedNode]
            }
          }
          return node
        })
        
        if (!taskListFound) {
          newContent.push({
            type: 'taskList',
            content: [clonedNode]
          })
        }
        
        updatedContent = {
          ...content,
          content: newContent
        }
      }
    } else {
      // 4b. 如果笔记不存在，创建新的笔记结构
      updatedContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [clonedNode]
          }
        ]
      }
    }
    
    console.log('📄 更新后的笔记结构（含完整任务节点）')
    
    // 5. 使用 saveNote 保存
    const savedNote = await saveNote(userId, date, updatedContent)
    
    console.log('✅ 完整任务节点已追加到笔记:', savedNote.id)
    return savedNote
    
  } catch (error) {
    console.error('❌ 追加完整任务节点失败:', error)
    throw error
  }
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
 * 同时自动记录版本到 note_versions 表
 */
export async function saveNote(
  userId: string,
  date: Date,
  content: JSONContent,
  versionSource: 'auto_save' | 'manual_save' | 'initial' = 'auto_save'
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

  console.log('🔍 准备保存笔记:', { dateStr, userId, metadata })
  
  const { data, error } = await supabase
    .from('notes')
    .upsert(noteData, {
      onConflict: 'user_id,note_date'
    })
    .select()
    .single()

  if (error) {
    console.error('❌ 保存笔记失败:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      noteData
    })
    throw error
  }

  console.log('✅ 笔记保存成功:', data)
  
  // 📝 异步记录版本历史（不阻塞主流程）
  saveNoteVersion(supabase, data.id, userId, dateStr, content, metadata, versionSource)
    .catch(err => console.error('⚠️ 保存版本历史失败（不影响主流程）:', err))
  
  return data
}

/**
 * 保存笔记版本到 note_versions 表
 * 内部函数，不导出
 */
async function saveNoteVersion(
  supabase: ReturnType<typeof createClient>,
  noteId: string,
  userId: string,
  noteDate: string,
  content: JSONContent,
  metadata: NoteMetadata,
  versionSource: string
): Promise<void> {
  const { error } = await supabase
    .from('note_versions')
    .insert({
      note_id: noteId,
      user_id: userId,
      note_date: noteDate,
      content: content,
      plain_text: metadata.plain_text,
      version_source: versionSource,
      content_length: metadata.plain_text.length,
      task_count: metadata.pending_tasks_count + metadata.completed_tasks_count
    })
  
  if (error) {
    console.error('❌ 保存版本历史失败:', error)
    throw error
  }
  
  console.log('📚 版本历史已记录')
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
    console.error('获取笔记列表失败:', error.message || error.code || JSON.stringify(error))
    throw new Error(error.message || '获取笔记列表失败')
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

