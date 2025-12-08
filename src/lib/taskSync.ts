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
    function traverseContent(node: any, position: { count: number }, depth: number = 0) {
      if (!node) return

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

          tasks.push({
            title: taskText,
            completed: node.attrs?.checked || false,
            position: position.count,
            deadlineDatetime: undefined, // TODO: 从文本中提取 @时间 标记
            estimatedDuration: duration,  // ⭐ 提取时长
            depth: depth,  // ⭐ 记录任务层级
          })
          position.count++
        }
        
        // taskItem 的子节点中如果有 taskList，那是子任务，层级 +1
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.type === 'taskList') {
              // 子任务列表，层级 +1
              traverseContent(child, position, depth + 1)
            }
          }
        }
        return  // taskItem 处理完毕，不再递归其他子节点（避免重复）
      }

      // 递归遍历子节点（非 taskItem 的情况）
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          traverseContent(child, position, depth)
        }
      }
    }

    traverseContent(contentJson, { count: 0 }, 0)

  } catch (error) {
    console.error('❌ 解析任务失败:', error)
  }

  return tasks
}

/**
 * 从节点中提取纯文本
 * 注意：跳过嵌套的 taskList，避免把子任务的文本合并到父任务标题中
 */
function extractTextFromNode(node: any): string {
  let text = ''

  if (node.type === 'text') {
    return node.text || ''
  }

  // 跳过嵌套的 taskList（子任务列表），避免把子任务文本合并到父任务
  if (node.type === 'taskList') {
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

  // 移除从📅开始的时间信息
  cleaned = cleaned.replace(/\s*📅.*$/, '')

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
    const parsedTasks = parseTasksFromNote(noteContent)
    console.log(`📋 解析到 ${parsedTasks.length} 个任务（包含子任务）`)

    // 2. 获取数据库中现有的任务
    const existingTasks = await getDailyTasksByNoteDate(userId, noteDate)
    console.log(`📊 数据库中有 ${existingTasks.length} 个任务`)

    // 3. 构建任务映射（按位置）
    const existingTaskMap = new Map<number, DailyTask>()
    for (const task of existingTasks) {
      existingTaskMap.set(task.notePosition, task)
    }

    // 🆕 4. 建立父子关系映射
    // 记录每个位置的任务ID（用于子任务查找父任务）
    const taskIdByPosition = new Map<number, string>()
    
    // 父任务栈：记录不同层级的最近任务
    // 栈结构：[{ depth: 0, taskId: 'xxx', position: 0 }, { depth: 1, taskId: 'yyy', position: 3 }]
    const parentTaskStack: Array<{ depth: number; taskId: string; position: number }> = []

    // 5. 同步任务（顺序很重要！必须按 position 顺序处理）
    const processedPositions = new Set<number>()

    for (const parsedTask of parsedTasks) {
      processedPositions.add(parsedTask.position)
      const existingTask = existingTaskMap.get(parsedTask.position)
      
      // 🆕 找到父任务ID（如果是子任务）
      let parentTaskId: string | null = null
      const taskDepth = parsedTask.depth ?? 0
      
      if (taskDepth > 0) {
        // 子任务：从栈中找到 depth = taskDepth - 1 的最近任务
        for (let i = parentTaskStack.length - 1; i >= 0; i--) {
          if (parentTaskStack[i].depth === taskDepth - 1) {
            parentTaskId = parentTaskStack[i].taskId
            console.log(`🔗 任务 "${parsedTask.title}" (depth=${taskDepth}) 的父任务是 position=${parentTaskStack[i].position}`)
            break
          }
        }
        
        if (!parentTaskId) {
          console.warn(`⚠️ 未找到 "${parsedTask.title}" 的父任务（depth=${taskDepth}），将作为顶层任务处理`)
        }
      }

      if (existingTask) {
        // 任务已存在，检查是否需要更新
        const needsUpdate = 
          existingTask.title !== parsedTask.title ||
          existingTask.completed !== parsedTask.completed ||
          existingTask.estimatedDuration !== parsedTask.estimatedDuration ||
          existingTask.parentTaskId !== parentTaskId ||   // 🆕 检查父任务变化
          existingTask.depth !== taskDepth                 // 🆕 检查层级变化

        if (needsUpdate) {
          try {
            await updateDailyTask(existingTask.id, {
              title: parsedTask.title,
              completed: parsedTask.completed,
              estimatedDuration: parsedTask.estimatedDuration,
              parentTaskId: parentTaskId,    // 🆕 更新父任务
              depth: taskDepth,               // 🆕 更新层级
            })
            result.updated++
            console.log(`✅ 更新任务: ${parsedTask.title} (depth=${taskDepth})`)
          } catch (error) {
            result.errors.push(`更新任务失败: ${parsedTask.title}`)
            console.error('❌ 更新任务失败:', error)
          }
        }
        
        // 🆕 记录任务ID（更新后的任务也要记录）
        taskIdByPosition.set(parsedTask.position, existingTask.id)
        
        // 🆕 更新父任务栈
        updateParentStack(parentTaskStack, taskDepth, existingTask.id, parsedTask.position)
        
      } else {
        // 新任务，创建
        try {
          const newTask = await createDailyTask(userId, {
            title: parsedTask.title,
            completed: parsedTask.completed,
            date: noteDate,
            noteDate: noteDate,
            notePosition: parsedTask.position,
            deadlineDatetime: parsedTask.deadlineDatetime,
            estimatedDuration: parsedTask.estimatedDuration,
            parentTaskId: parentTaskId,    // 🆕 设置父任务
            depth: taskDepth,               // 🆕 设置层级
          })

          // 为新任务创建矩阵记录（默认：待分类）
          await ensureTaskMatrix(userId, newTask.id)

          result.created++
          console.log(`✅ 创建任务: ${parsedTask.title} (depth=${taskDepth}, parent=${parentTaskId ? '有' : '无'})`)
          
          // 🆕 记录任务ID
          taskIdByPosition.set(parsedTask.position, newTask.id)
          
          // 🆕 更新父任务栈
          updateParentStack(parentTaskStack, taskDepth, newTask.id, parsedTask.position)
          
        } catch (error) {
          result.errors.push(`创建任务失败: ${parsedTask.title}`)
          console.error('❌ 创建任务失败:', error)
        }
      }
    }

    // 6. 删除数据库中多余的任务（笔记中已移除）
    for (const existingTask of existingTasks) {
      if (!processedPositions.has(existingTask.notePosition)) {
        try {
          await deleteDailyTask(existingTask.id)
          result.deleted++
          console.log(`🗑️ 删除任务: ${existingTask.title}`)
        } catch (error) {
          result.errors.push(`删除任务失败: ${existingTask.title}`)
          console.error('❌ 删除任务失败:', error)
        }
      }
    }

    const topLevelCount = parsedTasks.filter(t => (t.depth ?? 0) === 0).length
    const subtaskCount = parsedTasks.length - topLevelCount
    console.log(`✅ 任务同步完成: 创建 ${result.created}, 更新 ${result.updated}, 删除 ${result.deleted}`)
    console.log(`📊 任务结构: ${topLevelCount} 个顶层任务, ${subtaskCount} 个子任务`)

  } catch (error) {
    console.error('❌ syncTasksFromNote 异常:', error)
    result.errors.push(`同步任务异常: ${error}`)
  }

  return result
}

/**
 * 🆕 更新父任务栈
 * 维护一个栈结构，记录不同层级的最近任务
 */
function updateParentStack(
  stack: Array<{ depth: number; taskId: string; position: number }>,
  currentDepth: number,
  currentTaskId: string,
  currentPosition: number
): void {
  // 移除 depth >= currentDepth 的栈项（同层或更深层的任务）
  while (stack.length > 0 && stack[stack.length - 1].depth >= currentDepth) {
    stack.pop()
  }
  
  // 将当前任务推入栈
  stack.push({
    depth: currentDepth,
    taskId: currentTaskId,
    position: currentPosition
  })
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

