// ============================================
// 任务同步工具
// ============================================
// 功能：从笔记内容中提取任务并同步到 daily_tasks 表
// ============================================

import { 
  createDailyTask, 
  updateDailyTask, 
  deleteDailyTask, 
  getDailyTasksByNoteDate,
  batchCreateDailyTasks,
  batchUpdateDailyTasks,
  batchDeleteDailyTasks
} from './dailyTasks'
import { ensureTaskMatrix, batchInitTaskMatrix } from './taskMatrix'
import type { ParsedTask, TaskSyncResult, DailyTask, CreateDailyTaskInput, UpdateDailyTaskInput } from '@/types'

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
 * 🔧 性能优化版：使用批量数据库操作
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
    console.log(`🔄 开始同步任务（批量优化版）: noteDate=${noteDate}`)

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

    // 3. 🔧 构建任务映射（按 标题+父任务标题 匹配）
    const existingTaskMap = new Map<string, DailyTask>()
    const existingTaskById = new Map<string, DailyTask>()
    
    for (const task of existingTasks) {
      existingTaskById.set(task.id, task)
    }
    
    for (const task of existingTasks) {
      const parentTitle = task.parentTaskId 
        ? existingTaskById.get(task.parentTaskId)?.title?.toLowerCase().trim() || 'unknown'
        : 'root'
      const key = `${task.title.toLowerCase().trim()}|${parentTitle}`
      existingTaskMap.set(key, task)
    }

    // 4. 🔧 分类任务：待创建、待更新、待删除
    const processedTaskKeys = new Set<string>()
    const positionToTaskId = new Map<number, string>()
    const positionToTitle = new Map<number, string>()
    
    // 收集批量操作数据
    const tasksToCreate: Array<{ input: CreateDailyTaskInput; position: number; depth: number }> = []
    const tasksToUpdate: Array<{ taskId: string; updates: UpdateDailyTaskInput }> = []
    const newTaskIds: string[] = []  // 新创建的任务ID（用于批量初始化矩阵）

    // 按层级排序（先处理父任务，再处理子任务）
    const sortedTasks = [...parsedTasks].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0))

    // 5. 遍历任务，分类到创建/更新队列
    for (const parsedTask of sortedTasks) {
      const taskDepth = parsedTask.depth ?? 0
      
      // 计算匹配键
      let parentTitle = 'root'
      if (taskDepth > 0 && parsedTask.parentPosition !== undefined) {
        parentTitle = positionToTitle.get(parsedTask.parentPosition) || 'unknown'
      }
      const matchKey = `${parsedTask.title.toLowerCase().trim()}|${parentTitle}`
      processedTaskKeys.add(matchKey)
      positionToTitle.set(parsedTask.position, parsedTask.title.toLowerCase().trim())
      
      const existingTask = existingTaskMap.get(matchKey)
      
      // 确定父任务ID
      let parentTaskId: string | null = null
      if (taskDepth > 0 && parsedTask.parentPosition !== undefined) {
        parentTaskId = positionToTaskId.get(parsedTask.parentPosition) || null
        if (!parentTaskId) {
          console.warn(`⚠️ 子任务 "${parsedTask.title}" 的父任务未找到，作为孤立任务处理`)
        }
      }

      if (existingTask) {
        // 已存在，记录ID映射
        positionToTaskId.set(parsedTask.position, existingTask.id)
        
        // 检查是否需要更新
        const needsUpdate = 
          existingTask.title !== parsedTask.title ||
          existingTask.completed !== parsedTask.completed ||
          existingTask.estimatedDuration !== parsedTask.estimatedDuration ||
          (existingTask.depth ?? 0) !== taskDepth ||
          existingTask.parentTaskId !== parentTaskId

        if (needsUpdate) {
          tasksToUpdate.push({
            taskId: existingTask.id,
            updates: {
              title: parsedTask.title,
              completed: parsedTask.completed,
              estimatedDuration: parsedTask.estimatedDuration,
              depth: taskDepth,
              parentTaskId: parentTaskId,
            }
          })
        }
      } else {
        // 新任务，加入创建队列
        tasksToCreate.push({
          input: {
            title: parsedTask.title,
            completed: parsedTask.completed,
            date: noteDate,
            noteDate: noteDate,
            notePosition: parsedTask.position,
            deadlineDatetime: parsedTask.deadlineDatetime,
            estimatedDuration: parsedTask.estimatedDuration,
            depth: taskDepth,
            parentTaskId: parentTaskId,
          },
          position: parsedTask.position,
          depth: taskDepth,
        })
      }
    }

    // 6. 🔧 批量创建任务（按层级分批，确保父子关系正确）
    // 获取所有层级
    const depths = [...new Set(tasksToCreate.map(t => t.depth))].sort((a, b) => a - b)
    
    for (const depth of depths) {
      const tasksAtDepth = tasksToCreate.filter(t => t.depth === depth)
      if (tasksAtDepth.length === 0) continue
      
      // 更新 parentTaskId（使用已创建的父任务ID）
      const inputsToCreate: CreateDailyTaskInput[] = tasksAtDepth.map(t => {
        if (depth > 0) {
          // 从 positionToTaskId 查找实际的父任务ID
          const parsedTask = sortedTasks.find(p => p.position === t.position)
          if (parsedTask?.parentPosition !== undefined) {
            const actualParentId = positionToTaskId.get(parsedTask.parentPosition)
            if (actualParentId) {
              return { ...t.input, parentTaskId: actualParentId }
            }
          }
        }
        return t.input
      })
      
      console.log(`📦 批量创建 depth=${depth} 的任务: ${inputsToCreate.length} 个`)
      
      try {
        const createdTasks = await batchCreateDailyTasks(userId, inputsToCreate)
        
        // 记录新创建的任务ID映射
        createdTasks.forEach((newTask, index) => {
          const originalTask = tasksAtDepth[index]
          positionToTaskId.set(originalTask.position, newTask.id)
          newTaskIds.push(newTask.id)
        })
        
        result.created += createdTasks.length
        console.log(`✅ 批量创建成功: ${createdTasks.length} 个任务 (depth=${depth})`)
      } catch (error) {
        result.errors.push(`批量创建 depth=${depth} 任务失败`)
        console.error(`❌ 批量创建失败 (depth=${depth}):`, error)
        
        // 降级为逐个创建
        for (const taskData of tasksAtDepth) {
          try {
            const newTask = await createDailyTask(userId, taskData.input)
            positionToTaskId.set(taskData.position, newTask.id)
            newTaskIds.push(newTask.id)
            result.created++
          } catch (err) {
            result.errors.push(`创建任务失败: ${taskData.input.title}`)
          }
        }
      }
    }

    // 7. 🔧 批量更新任务
    if (tasksToUpdate.length > 0) {
      console.log(`📦 批量更新任务: ${tasksToUpdate.length} 个`)
      try {
        const updatedCount = await batchUpdateDailyTasks(tasksToUpdate)
        result.updated = updatedCount
        console.log(`✅ 批量更新成功: ${updatedCount} 个任务`)
      } catch (error) {
        result.errors.push('批量更新任务失败')
        console.error('❌ 批量更新失败:', error)
        
        // 降级为逐个更新
        for (const { taskId, updates } of tasksToUpdate) {
          try {
            await updateDailyTask(taskId, updates)
            result.updated++
          } catch (err) {
            result.errors.push(`更新任务失败: ${taskId}`)
          }
        }
      }
    }

    // 8. 🔧 批量删除任务
    const tasksToDelete: string[] = []
    for (const existingTask of existingTasks) {
      const parentTitle = existingTask.parentTaskId 
        ? existingTaskById.get(existingTask.parentTaskId)?.title?.toLowerCase().trim() || 'unknown'
        : 'root'
      const taskKey = `${existingTask.title.toLowerCase().trim()}|${parentTitle}`
      
      if (!processedTaskKeys.has(taskKey)) {
        tasksToDelete.push(existingTask.id)
      }
    }
    
    if (tasksToDelete.length > 0) {
      console.log(`🗑️ 批量删除任务: ${tasksToDelete.length} 个`)
      try {
        const deletedCount = await batchDeleteDailyTasks(tasksToDelete)
        result.deleted = deletedCount
        console.log(`✅ 批量删除成功: ${deletedCount} 个任务`)
      } catch (error) {
        result.errors.push('批量删除任务失败')
        console.error('❌ 批量删除失败:', error)
        
        // 降级为逐个删除
        for (const taskId of tasksToDelete) {
          try {
            await deleteDailyTask(taskId)
            result.deleted++
          } catch (err) {
            result.errors.push(`删除任务失败: ${taskId}`)
          }
        }
      }
    }

    // 9. 🔧 批量初始化新任务的矩阵
    if (newTaskIds.length > 0) {
      console.log(`📦 批量初始化矩阵: ${newTaskIds.length} 个新任务`)
      try {
        await batchInitTaskMatrix(userId, newTaskIds)
        console.log(`✅ 批量初始化矩阵成功`)
      } catch (error) {
        console.error('❌ 批量初始化矩阵失败:', error)
        // 矩阵初始化失败不影响任务同步结果
      }
    }

    console.log(`✅ 任务同步完成（批量优化版）: 创建 ${result.created}, 更新 ${result.updated}, 删除 ${result.deleted}`)

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

