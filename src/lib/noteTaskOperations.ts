/**
 * 笔记任务操作函数库
 * 
 * 提供对笔记中 taskItem 节点的 CRUD 操作
 * 用于 Agent 工具操作任务
 * 
 * Phase 5 - Step 1
 */

import type { JSONContent } from '@tiptap/core'

/**
 * 任务信息接口
 */
export interface TaskInfo {
  node: JSONContent      // 任务节点
  position: number       // 任务位置（第几个任务，从 0 开始）
  title: string          // 任务标题（纯文本，不含标签 marks）
  checked: boolean       // 是否完成
  path: number[]         // JSON 树中的路径（用于精确定位）
}

/**
 * 在笔记中查找所有 taskItem 节点
 * 
 * @param noteContent - 笔记内容（Tiptap JSON）
 * @returns 任务列表
 * 
 * @example
 * const tasks = findAllTasks(noteContent)
 * console.log(`找到 ${tasks.length} 个任务`)
 * tasks.forEach(task => {
 *   console.log(`任务 ${task.position}: ${task.title}`)
 * })
 */
export function findAllTasks(noteContent: JSONContent): TaskInfo[] {
  const tasks: TaskInfo[] = []
  let position = 0

  /**
   * 递归遍历 JSON 树
   * @param node - 当前节点
   * @param path - 当前路径
   */
  function traverse(node: any, path: number[]) {
    if (!node) return

    // 找到 taskItem 节点
    if (node.type === 'taskItem') {
      const title = extractTextFromNode(node)
      const checked = node.attrs?.checked || false

      tasks.push({
        node,
        position: position++,
        title,
        checked,
        path: [...path]  // 复制路径
      })
    }

    // 递归遍历子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child: any, index: number) => {
        traverse(child, [...path, index])
      })
    }
  }

  traverse(noteContent, [])

  console.log(`📋 findAllTasks: 找到 ${tasks.length} 个任务`)
  return tasks
}

/**
 * 从节点中提取纯文本（去除 marks 标记）
 * 
 * @param node - JSON 节点
 * @returns 纯文本内容
 */
function extractTextFromNode(node: any): string {
  let text = ''

  if (node.type === 'text') {
    return node.text || ''
  }

  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromNode(child)
    }
  }

  return text.trim()
}

/**
 * 更新笔记中的任务
 * 
 * @param noteContent - 笔记内容（Tiptap JSON）
 * @param taskPosition - 任务位置（第几个任务，从 0 开始）
 * @param updates - 更新内容
 * @returns 新的笔记内容
 * @throws {Error} 如果任务位置不存在
 * 
 * @example
 * // 标记第一个任务为完成
 * const newContent = updateTaskInNote(noteContent, 0, { checked: true })
 * 
 * // 修改任务标题
 * const newContent = updateTaskInNote(noteContent, 1, { title: '新标题 #工作' })
 */
export function updateTaskInNote(
  noteContent: JSONContent,
  taskPosition: number,
  updates: {
    checked?: boolean
    title?: string
  }
): JSONContent {
  console.log('✏️ updateTaskInNote:', { taskPosition, updates })

  // 1. 查找所有任务
  const tasks = findAllTasks(noteContent)

  if (taskPosition < 0 || taskPosition >= tasks.length) {
    throw new Error(`任务位置 ${taskPosition} 不存在（共 ${tasks.length} 个任务）`)
  }

  const targetTask = tasks[taskPosition]

  // 2. 深拷贝笔记内容（不修改原对象）
  const newContent = JSON.parse(JSON.stringify(noteContent))

  // 3. 使用 path 定位到目标节点
  let targetNode = newContent
  for (let i = 0; i < targetTask.path.length - 1; i++) {
    const index = targetTask.path[i]
    if (targetNode.content && Array.isArray(targetNode.content)) {
      targetNode = targetNode.content[index]
    }
  }

  // 获取最后一层的索引
  const lastIndex = targetTask.path[targetTask.path.length - 1]
  if (!targetNode.content || !Array.isArray(targetNode.content)) {
    throw new Error('无法定位到任务节点的父节点')
  }

  const taskNode = targetNode.content[lastIndex]

  // 4. 应用更新
  if (updates.checked !== undefined) {
    if (!taskNode.attrs) {
      taskNode.attrs = {}
    }
    taskNode.attrs.checked = updates.checked
    console.log(`  ✅ 更新 checked: ${updates.checked}`)
  }

  if (updates.title) {
    // 更新标题：解析新标题并重建 paragraph content
    const newParagraphContent = parseTitleToContent(updates.title)
    
    if (taskNode.content && taskNode.content[0]) {
      taskNode.content[0].content = newParagraphContent
    } else {
      // 如果 content 不存在，创建新的
      taskNode.content = [
        {
          type: 'paragraph',
          content: newParagraphContent
        }
      ]
    }
    console.log(`  ✅ 更新 title: ${updates.title}`)
  }

  console.log('✅ updateTaskInNote 完成')
  return newContent
}

/**
 * 删除笔记中的任务
 * 
 * @param noteContent - 笔记内容
 * @param taskPosition - 任务位置
 * @returns 新的笔记内容
 * @throws {Error} 如果任务位置不存在
 * 
 * @example
 * const newContent = deleteTaskFromNote(noteContent, 0)  // 删除第一个任务
 */
export function deleteTaskFromNote(
  noteContent: JSONContent,
  taskPosition: number
): JSONContent {
  console.log('🗑️ deleteTaskFromNote:', { taskPosition })

  // 1. 查找所有任务
  const tasks = findAllTasks(noteContent)

  if (taskPosition < 0 || taskPosition >= tasks.length) {
    throw new Error(`任务位置 ${taskPosition} 不存在（共 ${tasks.length} 个任务）`)
  }

  const targetTask = tasks[taskPosition]

  // 2. 深拷贝笔记内容
  const newContent = JSON.parse(JSON.stringify(noteContent))

  // 3. 使用 path 定位到父节点
  let parentNode = newContent
  for (let i = 0; i < targetTask.path.length - 1; i++) {
    const index = targetTask.path[i]
    if (parentNode.content && Array.isArray(parentNode.content)) {
      parentNode = parentNode.content[index]
    }
  }

  // 4. 从父节点的 content 数组中移除任务
  const taskIndex = targetTask.path[targetTask.path.length - 1]
  if (parentNode.content && Array.isArray(parentNode.content)) {
    parentNode.content.splice(taskIndex, 1)
    console.log(`  ✅ 从父节点移除任务（索引 ${taskIndex}）`)

    // 5. 如果父节点（通常是 taskList）变空了，移除整个 taskList
    if (parentNode.content.length === 0 && parentNode.type === 'taskList') {
      console.log('  ⚠️ taskList 已空，需要从上级移除')
      
      // 再往上一层，移除空的 taskList
      if (targetTask.path.length >= 2) {
        let grandparentNode = newContent
        for (let i = 0; i < targetTask.path.length - 2; i++) {
          const index = targetTask.path[i]
          if (grandparentNode.content && Array.isArray(grandparentNode.content)) {
            grandparentNode = grandparentNode.content[index]
          }
        }
        
        const parentIndex = targetTask.path[targetTask.path.length - 2]
        if (grandparentNode.content && Array.isArray(grandparentNode.content)) {
          grandparentNode.content.splice(parentIndex, 1)
          console.log(`  ✅ 移除空的 taskList（索引 ${parentIndex}）`)
        }
      }
    }
  }

  console.log('✅ deleteTaskFromNote 完成')
  return newContent
}

/**
 * 解析任务标题为 Tiptap content 数组
 * 支持标签解析（#标签）
 * 
 * @param title - 任务标题
 * @returns Tiptap content 数组
 * 
 * @example
 * parseTitleToContent("完成报告 #工作")
 * // 返回：[
 * //   { type: 'text', text: '完成报告 ' },
 * //   { type: 'text', text: '工作', marks: [{ type: 'taskTag', ... }] },
 * //   { type: 'text', text: ' ' }
 * // ]
 */
function parseTitleToContent(title: string): JSONContent[] {
  const content: JSONContent[] = []

  // 正则提取标签（#xxx）
  const tagRegex = /#\s*([^\s#@]+)/g
  const tags: Array<{ label: string; position: number }> = []
  let match

  while ((match = tagRegex.exec(title)) !== null) {
    tags.push({
      label: match[1],
      position: match.index
    })
  }

  if (tags.length === 0) {
    // 没有标签，直接返回文本节点
    content.push({
      type: 'text',
      text: title
    })
  } else {
    // 有标签，需要分段创建节点
    let lastIndex = 0

    tags.forEach(tag => {
      // 添加标签前的文本
      if (tag.position > lastIndex) {
        const beforeText = title.substring(lastIndex, tag.position).trim()
        if (beforeText) {
          content.push({
            type: 'text',
            text: beforeText + ' '
          })
        }
      }

      // 添加标签节点（使用 taskTag mark）
      content.push({
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

      // 在标签后添加一个普通空格
      content.push({
        type: 'text',
        text: ' '
      })

      // 更新位置（跳过 # 和标签文本）
      lastIndex = tag.position + tag.label.length + 1
    })

    // 添加标签后的文本（如果有）
    if (lastIndex < title.length) {
      const afterText = title.substring(lastIndex).trim()
      if (afterText) {
        content.push({
          type: 'text',
          text: afterText
        })
      }
    }
  }

  return content
}





