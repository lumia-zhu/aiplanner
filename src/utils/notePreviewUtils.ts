/**
 * 笔记预览工具函数
 * 用于解析 Tiptap JSONContent 并提取预览信息
 */

// 预览行类型
export interface PreviewLine {
  type: 'heading' | 'paragraph' | 'taskItem'
  text: string
  checked?: boolean // 仅用于 taskItem
  level?: number // 仅用于 heading
}

// 任务统计
export interface TaskStats {
  total: number
  completed: number
  pending: number
}

/**
 * 从 JSONContent 中提取预览行
 * @param content Tiptap JSONContent
 * @param maxLines 最大行数（默认 10）
 * @returns 预览行数组
 */
export function extractPreviewLines(content: any, maxLines: number = 10): PreviewLine[] {
  if (!content || !content.content) {
    return []
  }

  const lines: PreviewLine[] = []
  let lineCount = 0

  // 递归遍历节点
  const traverse = (node: any) => {
    // 达到最大行数，停止遍历
    if (lineCount >= maxLines) return

    // 处理标题节点
    if (node.type === 'heading') {
      const text = extractTextFromNode(node)
      if (text.trim()) {
        lines.push({
          type: 'heading',
          text: text.trim(),
          level: node.attrs?.level || 1
        })
        lineCount++
      }
      return // 不再递归处理子节点
    }

    // 处理任务项节点（优先处理，避免重复）
    if (node.type === 'taskItem') {
      const text = extractTextFromNode(node)
      if (text.trim()) {
        lines.push({
          type: 'taskItem',
          text: text.trim(),
          checked: node.attrs?.checked || false
        })
        lineCount++
      }
      return // 不再递归处理子节点（避免重复处理 paragraph）
    }

    // 处理段落节点
    if (node.type === 'paragraph') {
      const text = extractTextFromNode(node)
      if (text.trim()) {
        lines.push({
          type: 'paragraph',
          text: text.trim()
        })
        lineCount++
      }
      return // 不再递归处理子节点
    }

    // 处理任务列表节点（递归处理子节点）
    if (node.type === 'taskList' && node.content) {
      node.content.forEach(traverse)
      return
    }

    // 递归处理其他子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  // 从根节点开始遍历
  if (content.content) {
    content.content.forEach(traverse)
  }

  return lines
}

/**
 * 从节点中提取纯文本
 * @param node 节点
 * @returns 文本内容
 */
function extractTextFromNode(node: any): string {
  if (!node) return ''

  // 如果是文本节点，直接返回
  if (node.type === 'text') {
    return node.text || ''
  }

  // 如果有子节点，递归提取
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('')
  }

  return ''
}

/**
 * 统计笔记中的任务数量
 * @param content Tiptap JSONContent
 * @returns 任务统计
 */
export function extractTaskStats(content: any): TaskStats {
  const stats: TaskStats = {
    total: 0,
    completed: 0,
    pending: 0
  }

  if (!content || !content.content) {
    return stats
  }

  // 递归遍历节点
  const traverse = (node: any) => {
    if (node.type === 'taskItem') {
      stats.total++
      if (node.attrs?.checked) {
        stats.completed++
      } else {
        stats.pending++
      }
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  content.content.forEach(traverse)

  return stats
}

/**
 * 从 JSONContent 中提取纯文本
 * @param content Tiptap JSONContent
 * @returns 纯文本
 */
export function extractPlainText(content: any): string {
  if (!content || !content.content) {
    return ''
  }

  const textParts: string[] = []

  const traverse = (node: any) => {
    if (node.type === 'text') {
      textParts.push(node.text || '')
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  content.content.forEach(traverse)

  return textParts.join('').trim()
}

/**
 * 计算文本字数（中文字符和英文单词）
 * @param text 文本内容
 * @returns 字数
 */
export function countChars(text: string): number {
  if (!text) return 0
  
  // 移除多余空格
  const cleaned = text.trim().replace(/\s+/g, ' ')
  
  // 中文字符数
  const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length
  
  // 英文单词数
  const englishWords = (cleaned.match(/[a-zA-Z]+/g) || []).length
  
  return chineseChars + englishWords
}

