// ============================================
// 任务同步工具
// ============================================
// 功能：从笔记内容中提取任务并同步到 daily_tasks 表
// ============================================

import { createDailyTask, updateDailyTask, deleteDailyTask, getDailyTasksByNoteDate } from './dailyTasks'
import { ensureTaskMatrix } from './taskMatrix'
import type { ParsedTask, TaskSyncResult, DailyTask } from '@/types'

/**
 * 从 Tiptap JSON 内容中提取任务
 * 
 * Tiptap TaskList 结构示例：
 * {
 *   "type": "taskList",
 *   "content": [
 *     {
 *       "type": "taskItem",
 *       "attrs": { "checked": false },
 *       "content": [
 *         { "type": "paragraph", "content": [{ "type": "text", "text": "任务标题" }] }
 *       ]
 *     }
 *   ]
 * }
 */
export function parseTasksFromNote(noteContent: string | any): ParsedTask[] {
  const tasks: ParsedTask[] = []

  try {
    // 如果内容为空，返回空数组
    if (!noteContent) {
      return tasks
    }

    // 如果是字符串，尝试解析为 JSON
    let contentJson: any
    if (typeof noteContent === 'string') {
      if (noteContent.trim() === '') {
        return tasks
      }
      try {
        contentJson = JSON.parse(noteContent)
      } catch {
        // 如果解析失败，可能是 HTML 格式
        return parseTasksFromHtml(noteContent)
      }
    } else {
      // 直接使用 JSON 对象
      contentJson = noteContent
    }

    // 递归遍历 JSON 结构，查找 taskItem 节点
    // depth: 当前任务的层级（0 = 顶层，1 = 子任务，2 = 孙任务...）
    // parentPosition: 父任务在列表中的位置（用于建立父子关系）
    // 🆕 最大支持4级任务（depth 0-3）
    const MAX_TASK_DEPTH = 3
    
    function traverseContent(node: any, position: { count: number }, depth: number = 0, parentPosition?: number) {
      if (!node) return
      
      // 🆕 超过最大深度的任务不再解析（但仍会显示在编辑器中）
      if (depth > MAX_TASK_DEPTH) {
        console.warn(`⚠️ 任务层级超过限制（${depth} > ${MAX_TASK_DEPTH}），跳过解析`)
        return
      }

      // 找到 taskItem 节点
      if (node.type === 'taskItem') {
        const taskText = sanitizeTaskTitle(extractTextFromNode(node))
        if (taskText) {
          // 提取 estimatedDuration
          // 注意：HTML attribute 是 'data-estimated-duration', 但 Tiptap JSON attrs 可能是 'estimatedDuration'
          // 这取决于 extension 的 addAttributes 配置
          const duration = node.attrs?.estimatedDuration 
            ? Number(node.attrs.estimatedDuration) 
            : undefined

          // 提取 deadlineTime
          // Tiptap node attrs 中的字段名是 deadlineTime
          const deadlineTime = node.attrs?.deadlineTime || undefined
          
          const currentPosition = position.count
          tasks.push({
            title: taskText,
            completed: node.attrs?.checked || false,
            position: currentPosition,
            deadlineDatetime: deadlineTime,  // ⭐ 从 node.attrs 提取截止时间
            estimatedDuration: duration,  // ⭐ 提取时长
            depth: depth,  // ⭐ 记录任务层级
            parentPosition: depth > 0 ? parentPosition : undefined,  // 🆕 记录父任务位置
          })
          position.count++
        
          // taskItem 的子节点中如果有 taskList，那是子任务，层级 +1
          // 🆕 传递当前任务位置作为子任务的 parentPosition
          if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
              if (child.type === 'taskList') {
                // 子任务列表，层级 +1，传递当前位置作为父位置
                traverseContent(child, position, depth + 1, currentPosition)
              }
            }
          }
        }
        return  // taskItem 处理完毕，不再递归其他子节点（避免重复）
      }

      // 递归遍历子节点（非 taskItem 的情况）
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          traverseContent(child, position, depth, parentPosition)
        }
      }
    }

    traverseContent(contentJson, { count: 0 }, 0, undefined)

  } catch (error) {
    console.error('❌ 解析任务失败:', error)
  }

  return tasks
}

/**
 * 从节点中提取纯文本
 * 注意：跳过嵌套的 taskList、contextInfo 和带 taskTag mark 的文本，
 * 避免把子任务、上下文信息和标签的文本合并到父任务标题中
 */
function extractTextFromNode(node: any): string {
  let text = ''

  if (node.type === 'text') {
    // 🔧 跳过带有 taskTag mark 的文本（标签）
    if (node.marks && Array.isArray(node.marks)) {
      const hasTaskTag = node.marks.some((mark: any) => mark.type === 'taskTag')
      if (hasTaskTag) {
        return ''
      }
    }
    return node.text || ''
  }

  // 跳过嵌套的 taskList（子任务列表），避免把子任务文本合并到父任务
  if (node.type === 'taskList') {
    return ''
  }
  
  // 🔧 跳过 contextInfo（上下文信息），避免把上下文内容合并到任务标题
  if (node.type === 'contextInfo') {
    return ''
  }

  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromNode(child)
    }
  }

  return text.trim()
}

/**
 * 清理任务标题，只保留用户输入的纯文本部分
 *  - 移除 "📅 10/31 18:00" 等时间标记
 *  - 移除多余空白
 */
export function sanitizeTaskTitle(rawTitle: string): string {
  if (!rawTitle) return ''

  let cleaned = rawTitle

  // 移除从📅开始的时间信息（截止时间）
  cleaned = cleaned.replace(/\s*📅.*$/, '')

  // 移除从⏳开始的时长信息
  cleaned = cleaned.replace(/\s*⏳\s*\d+[mh分时]?\s*/gi, '')

  // 移除从⌛开始的时长信息（备用格式）
  cleaned = cleaned.replace(/\s*⌛\s*\d+[mh分时]?\s*/gi, '')

  // 移除 #标签 或 @tag 之类的标记
  cleaned = cleaned.replace(/[#@][^\s#@]+/g, '')

  // 将多个空格压缩为单个空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * 从 HTML 格式中提取任务（备用方案）
 */
function parseTasksFromHtml(htmlContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = []

  try {
    // 使用正则表达式匹配任务列表项
    // 格式: <li data-type="taskItem" data-checked="true/false">任务文本</li>
    const taskItemRegex = /<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>(.*?)<\/li>/gi
    
    let match
    let position = 0
    while ((match = taskItemRegex.exec(htmlContent)) !== null) {
      const checked = match[1] === 'true'
      const taskHtml = match[2]
      
      // 提取纯文本（移除 HTML 标签）
      const taskText = sanitizeTaskTitle(taskHtml.replace(/<[^>]+>/g, '').trim())
      
      if (taskText) {
        tasks.push({
          title: taskText,
          completed: checked,
          position: position,
          deadlineDatetime: undefined,
        })
        position++
      }
    }

  } catch (error) {
    console.error('❌ 从 HTML 解析任务失败:', error)
  }

  return tasks
}

/**
 * 同步笔记任务到数据库
 * 
 * @param userId 用户ID
 * @param noteDate 笔记日期 (YYYY-MM-DD)
 * @param noteContent 笔记内容（JSON 对象、JSON 字符串或 HTML）
 * @returns 同步结果统计
 */
export async function syncTasksFromNote(
  userId: string,
  noteDate: string,
  noteContent: string | any
): Promise<TaskSyncResult> {
  const result: TaskSyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    console.log(`🔄 开始同步任务: noteDate=${noteDate}`)

    // 1. 从笔记内容中解析任务
    const rawParsedTasks = parseTasksFromNote(noteContent)
    console.log(`📋 解析到 ${rawParsedTasks.length} 个任务（原始）`)
    
    // 🔧 去重：按标题去重，保留第一个出现的
    const seenTitles = new Set<string>()
    const parsedTasks = rawParsedTasks.filter(task => {
      const cleanTitle = task.title.toLowerCase().trim()
      if (seenTitles.has(cleanTitle)) {
        console.log(`⚠️ 发现重复任务，跳过: ${task.title}`)
        return false
      }
      seenTitles.add(cleanTitle)
      return true
    })
    console.log(`📋 去重后剩余 ${parsedTasks.length} 个任务`)

    // 2. 获取数据库中现有的任务
    const existingTasks = await getDailyTasksByNoteDate(userId, noteDate)
    console.log(`📊 数据库中有 ${existingTasks.length} 个任务`)

    // 3. 🔧 构建任务映射（按 标题+父任务标题 匹配，而非位置）
    // 这样即使任务位置变化，也能正确匹配到已有任务
    const existingTaskMap = new Map<string, DailyTask>()
    const existingTaskById = new Map<string, DailyTask>()
    
    for (const task of existingTasks) {
      existingTaskById.set(task.id, task)
    }
    
    for (const task of existingTasks) {
      // 生成唯一键：标题 + 父任务标题（如果有）
      const parentTitle = task.parentTaskId 
        ? existingTaskById.get(task.parentTaskId)?.title?.toLowerCase().trim() || 'unknown'
        : 'root'
      const key = `${task.title.toLowerCase().trim()}|${parentTitle}`
      existingTaskMap.set(key, task)
      console.log(`📌 已有任务映射: "${task.title}" -> key: ${key}`)
    }

    // 4. 同步任务（分两轮：先父任务，再子任务）
    const processedTaskKeys = new Set<string>()
    
    // 🆕 position → taskId 映射（用于建立父子关系）
    // ⚠️ 注意：这里的 position 是当前解析的位置（parsedTask.position），不是数据库中的 notePosition
    // 因为用户编辑笔记后任务位置可能变化，必须使用当前解析的位置来建立父子关系
    const positionToTaskId = new Map<number, string>()
    // 🆕 position → title 映射（用于生成子任务的匹配键）
    const positionToTitle = new Map<number, string>()

    // 🆕 第一轮：处理父任务（depth = 0）和更新已有任务
    for (const parsedTask of parsedTasks.filter(t => (t.depth ?? 0) === 0)) {
      // 🔧 使用 标题+root 作为匹配键（父任务没有父级）
      const matchKey = `${parsedTask.title.toLowerCase().trim()}|root`
      processedTaskKeys.add(matchKey)
      const existingTask = existingTaskMap.get(matchKey)
      
      // 记录 position → title 映射
      positionToTitle.set(parsedTask.position, parsedTask.title.toLowerCase().trim())
      
      // 父任务没有 parentTaskId
      const parentTaskId: string | null = null

      if (existingTask) {
        // 任务已存在，检查是否需要更新
        const taskDepth = parsedTask.depth ?? 0
        const needsUpdate = 
          existingTask.title !== parsedTask.title ||
          existingTask.completed !== parsedTask.completed ||
          existingTask.estimatedDuration !== parsedTask.estimatedDuration ||
          (existingTask.depth ?? 0) !== taskDepth ||
          existingTask.parentTaskId !== parentTaskId

        if (needsUpdate) {
          try {
            await updateDailyTask(existingTask.id, {
              title: parsedTask.title,
              completed: parsedTask.completed,
              estimatedDuration: parsedTask.estimatedDuration,
              depth: taskDepth,               // 🆕 更新层级
              parentTaskId: parentTaskId,     // 🆕 更新父任务ID
            })
            result.updated++
            console.log(`✅ 更新任务: ${parsedTask.title} (depth=${taskDepth}, parentId=${parentTaskId})`)
          } catch (error) {
            result.errors.push(`更新任务失败: ${parsedTask.title}`)
            console.error('❌ 更新任务失败:', error)
          }
        }
        // 记录已存在任务的 ID 映射
        positionToTaskId.set(parsedTask.position, existingTask.id)
      } else {
        // 新任务，创建
        try {
          const newTask = await createDailyTask(userId, {
            title: parsedTask.title,
            completed: parsedTask.completed,
            date: noteDate, // 默认任务属于笔记的当天
            noteDate: noteDate,
            notePosition: parsedTask.position,
            deadlineDatetime: parsedTask.deadlineDatetime,
            estimatedDuration: parsedTask.estimatedDuration,
            depth: parsedTask.depth ?? 0,           // 🆕 保存层级
            parentTaskId: parentTaskId,              // 🆕 保存父任务ID
          })
          
          // 🆕 记录新建任务的 ID 映射（供后续子任务使用）
          positionToTaskId.set(parsedTask.position, newTask.id)

          // 为新任务创建矩阵记录（默认：待分类）
          await ensureTaskMatrix(userId, newTask.id)

          result.created++
          console.log(`✅ 创建任务: ${parsedTask.title} (depth=${parsedTask.depth}, parentId=${parentTaskId})`)
        } catch (error) {
          result.errors.push(`创建任务失败: ${parsedTask.title}`)
          console.error('❌ 创建任务失败:', error)
        }
      }
    }

    // 🆕 第二轮：处理子任务（depth > 0）
    for (const parsedTask of parsedTasks.filter(t => (t.depth ?? 0) > 0)) {
      // 查找父任务标题（用于生成匹配键）
      const parentTitle = parsedTask.parentPosition !== undefined 
        ? positionToTitle.get(parsedTask.parentPosition) || 'unknown'
        : 'root'
      
      // 🔧 使用 标题+父任务标题 作为匹配键
      const matchKey = `${parsedTask.title.toLowerCase().trim()}|${parentTitle}`
      processedTaskKeys.add(matchKey)
      const existingTask = existingTaskMap.get(matchKey)
      
      // 记录 position → title 映射
      positionToTitle.set(parsedTask.position, parsedTask.title.toLowerCase().trim())
      
      // 查找父任务ID
      let parentTaskId: string | null = null
      if (parsedTask.parentPosition !== undefined) {
        parentTaskId = positionToTaskId.get(parsedTask.parentPosition) || null
        if (!parentTaskId) {
          // 🔧 不再跳过，继续处理（parentTaskId 保持为 null）
          // 这样可以确保任务被创建，并且它的后代任务也能被处理
          console.warn(`⚠️ 子任务 "${parsedTask.title}" 的父任务(position=${parsedTask.parentPosition})未找到，将作为孤立任务处理`)
        }
      }

      if (existingTask) {
        // 任务已存在，检查是否需要更新
        const taskDepth = parsedTask.depth ?? 0
        const needsUpdate = 
          existingTask.title !== parsedTask.title ||
          existingTask.completed !== parsedTask.completed ||
          existingTask.estimatedDuration !== parsedTask.estimatedDuration ||
          (existingTask.depth ?? 0) !== taskDepth ||
          existingTask.parentTaskId !== parentTaskId

        if (needsUpdate) {
          try {
            await updateDailyTask(existingTask.id, {
              title: parsedTask.title,
              completed: parsedTask.completed,
              estimatedDuration: parsedTask.estimatedDuration,
              depth: taskDepth,
              parentTaskId: parentTaskId,
            })
            result.updated++
            console.log(`✅ 更新子任务: ${parsedTask.title} (depth=${taskDepth}, parentId=${parentTaskId})`)
          } catch (error) {
            result.errors.push(`更新子任务失败: ${parsedTask.title}`)
            console.error('❌ 更新子任务失败:', error)
          }
        }
        positionToTaskId.set(parsedTask.position, existingTask.id)
      } else {
        // 新子任务，创建
        try {
          const newTask = await createDailyTask(userId, {
            title: parsedTask.title,
            completed: parsedTask.completed,
            date: noteDate,
            noteDate: noteDate,
            notePosition: parsedTask.position,
            deadlineDatetime: parsedTask.deadlineDatetime,
            estimatedDuration: parsedTask.estimatedDuration,
            depth: parsedTask.depth ?? 0,
            parentTaskId: parentTaskId,
          })
          
          positionToTaskId.set(parsedTask.position, newTask.id)
          await ensureTaskMatrix(userId, newTask.id)
          
          result.created++
          console.log(`✅ 创建子任务: ${parsedTask.title} (depth=${parsedTask.depth}, parentId=${parentTaskId})`)
        } catch (error) {
          result.errors.push(`创建子任务失败: ${parsedTask.title}`)
          console.error('❌ 创建子任务失败:', error)
        }
      }
    }

    // 5. 删除数据库中多余的任务（笔记中已移除）
    // 🔧 使用任务键（标题+父标题）来判断，而不是位置
    for (const existingTask of existingTasks) {
      const parentTitle = existingTask.parentTaskId 
        ? existingTaskById.get(existingTask.parentTaskId)?.title?.toLowerCase().trim() || 'unknown'
        : 'root'
      const taskKey = `${existingTask.title.toLowerCase().trim()}|${parentTitle}`
      
      if (!processedTaskKeys.has(taskKey)) {
        try {
          await deleteDailyTask(existingTask.id)
          result.deleted++
          console.log(`🗑️ 删除任务: ${existingTask.title} (key: ${taskKey})`)
        } catch (error) {
          result.errors.push(`删除任务失败: ${existingTask.title}`)
          console.error('❌ 删除任务失败:', error)
        }
      }
    }

    console.log(`✅ 任务同步完成: 创建 ${result.created}, 更新 ${result.updated}, 删除 ${result.deleted}`)

  } catch (error) {
    console.error('❌ syncTasksFromNote 异常:', error)
    result.errors.push(`同步任务异常: ${error}`)
  }

  return result
}

/**
 * 批量同步多天的笔记任务
 */
export async function batchSyncTasks(
  userId: string,
  notes: Array<{ date: string; content: string }>
): Promise<Record<string, TaskSyncResult>> {
  const results: Record<string, TaskSyncResult> = {}

  for (const note of notes) {
    try {
      results[note.date] = await syncTasksFromNote(userId, note.date, note.content)
    } catch (error) {
      console.error(`❌ 同步 ${note.date} 的任务失败:`, error)
      results[note.date] = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [`同步失败: ${error}`],
      }
    }
  }

  return results
}

