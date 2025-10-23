/**
 * AI澄清结果格式化工具
 * 用于在显示格式和编辑格式之间转换
 */

/**
 * 将 AI summary 转换为可编辑的纯文本
 * @param summary AI生成的格式化总结
 * @returns 可编辑的纯文本
 */
export function formatSummaryForEdit(summary: string): string {
  // 移除开头的emoji和标题
  let text = summary.replace(/^📋 任务概要\n+/, '')
  
  // 移除多余的空行，保持可读性
  text = text.replace(/\n{3,}/g, '\n\n')
  
  return text.trim()
}

/**
 * 将编辑后的文本转换回 summary 格式
 * @param text 用户编辑后的文本
 * @returns 带标题的 summary 格式
 */
export function formatEditToSummary(text: string): string {
  // 清理文本
  const cleanText = text.trim()
  
  // 如果已经有标题，直接返回
  if (cleanText.startsWith('📋 任务概要')) {
    return cleanText
  }
  
  // 添加标题
  return `📋 任务概要\n\n${cleanText}`
}

