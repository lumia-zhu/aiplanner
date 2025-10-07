import type { SubtaskSuggestion } from '@/types'

// 修复JSON语法错误的工具函数
function fixJsonSyntax(jsonString: string): string {
  try {
    // 1. 修复缺少逗号的问题
    // 匹配 "value"\n "key" 模式，在它们之间添加逗号
    jsonString = jsonString.replace(/("\s*)\n(\s*")/g, '$1,\n$2')
    
    // 2. 移除可能存在的description字段（因为现在不需要了）
    jsonString = jsonString.replace(/"description"\s*:\s*"[^"]*",?\s*/g, '')
    
    // 3. 修复可能的字段顺序问题
    jsonString = jsonString.replace(/,\s*"estimated_duration"/g, ',"estimated_duration"')
    
    // 5. 最后检查和修复常见的语法问题
    // 修复连续的逗号
    jsonString = jsonString.replace(/,\s*,/g, ',')
    
    // 修复结尾多余的逗号
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1')
    
    return jsonString
  } catch (error) {
    console.warn('JSON语法修复失败，返回原始字符串:', error)
    return jsonString
  }
}

// 任务拆解响应的类型定义
interface DecompositionResponse {
  subtasks: Array<{
    title: string
    estimated_duration?: string
    order: number
  }>
}

// 解析AI返回的任务拆解JSON
export function parseDecompositionResponse(aiResponse: string): SubtaskSuggestion[] {
  try {
    console.log('🔍 开始解析任务拆解响应:', aiResponse.substring(0, 200) + '...')
    
    // 清理响应文本，移除可能的markdown代码块标记
    let cleanedResponse = aiResponse.trim()
    
    // 移除markdown代码块
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    // 查找JSON对象的开始和结束位置
    const startIndex = cleanedResponse.indexOf('{')
    const lastIndex = cleanedResponse.lastIndexOf('}')
    
    if (startIndex === -1 || lastIndex === -1 || startIndex >= lastIndex) {
      throw new Error('无法找到有效的JSON对象')
    }
    
    let jsonString = cleanedResponse.substring(startIndex, lastIndex + 1)
    console.log('📋 原始JSON字符串:', jsonString.substring(0, 300) + '...')
    
    // 修复常见的JSON格式错误
    jsonString = fixJsonSyntax(jsonString)
    console.log('🔧 修复后JSON字符串:', jsonString.substring(0, 300) + '...')
    
    // 解析JSON
    const parsed: DecompositionResponse = JSON.parse(jsonString)
    
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
      throw new Error('响应格式不正确：缺少subtasks数组')
    }
    
    // 转换为SubtaskSuggestion格式
    const suggestions: SubtaskSuggestion[] = parsed.subtasks.map((subtask, index) => ({
      id: `temp_${Date.now()}_${index}`, // 生成临时ID
      title: subtask.title || `子任务${index + 1}`,
      description: '', // 不再使用描述字段
      priority: undefined, // ✅ 不设置默认优先级，与快速创建任务保持一致
      estimated_duration: subtask.estimated_duration,
      is_selected: true, // 默认选中
      order: subtask.order || index + 1
    }))
    
    console.log('✅ 任务拆解解析成功:', suggestions)
    return suggestions
    
  } catch (error) {
    console.error('❌ 任务拆解解析失败:', error)
    console.error('原始响应:', aiResponse)
    
    // 尝试从文本中提取任务信息（降级处理）
    return extractSubtasksFromText(aiResponse)
  }
}

// 降级处理：从文本中提取子任务信息
function extractSubtasksFromText(text: string): SubtaskSuggestion[] {
  console.log('🔄 尝试从文本中提取子任务...')
  
  const suggestions: SubtaskSuggestion[] = []
  const lines = text.split('\n')
  
  let currentOrder = 1
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // 查找看起来像任务的行（以数字开头，或包含常见任务关键词）
    if (
      trimmedLine.match(/^\d+\.?\s+/) || // 以数字开头
      trimmedLine.match(/^[一二三四五六七八九十]+[、．]\s+/) || // 中文数字开头
      trimmedLine.match(/^[•·▪▫◦‣⁃]\s+/) || // 列表符号开头
      (trimmedLine.length > 5 && (
        trimmedLine.includes('准备') || 
        trimmedLine.includes('完成') || 
        trimmedLine.includes('制作') ||
        trimmedLine.includes('整理') ||
        trimmedLine.includes('检查')
      ))
    ) {
      // 清理任务标题
      let title = trimmedLine
        .replace(/^\d+\.?\s+/, '') // 移除数字前缀
        .replace(/^[一二三四五六七八九十]+[、．]\s+/, '') // 移除中文数字前缀
        .replace(/^[•·▪▫◦‣⁃]\s+/, '') // 移除列表符号
        .trim()
      
      if (title.length > 2 && title.length < 100) {
        suggestions.push({
          id: `extracted_${Date.now()}_${currentOrder}`,
          title: title,
          description: '从AI响应中提取的任务',
          priority: undefined, // ✅ 不设置默认优先级
          estimated_duration: undefined,
          is_selected: true,
          order: currentOrder++
        })
      }
    }
  }
  
  // 如果没有提取到任何任务，创建一个默认的子任务
  if (suggestions.length === 0) {
    suggestions.push({
      id: `fallback_${Date.now()}`,
      title: '分解原任务',
      description: 'AI无法自动拆解此任务，请手动编辑子任务',
      priority: undefined, // ✅ 不设置默认优先级
      estimated_duration: undefined,
      is_selected: true,
      order: 1
    })
  }
  
  console.log(`📝 从文本中提取了 ${suggestions.length} 个子任务:`, suggestions)
  return suggestions.slice(0, 5) // 最多返回5个子任务
}

// 验证子任务建议的有效性
export function validateSubtaskSuggestions(suggestions: SubtaskSuggestion[]): {
  isValid: boolean
  errors: string[]
  validSuggestions: SubtaskSuggestion[]
} {
  const errors: string[] = []
  const validSuggestions: SubtaskSuggestion[] = []
  
  if (!Array.isArray(suggestions)) {
    errors.push('子任务建议必须是数组')
    return { isValid: false, errors, validSuggestions: [] }
  }
  
  if (suggestions.length === 0) {
    errors.push('至少需要一个子任务建议')
    return { isValid: false, errors, validSuggestions: [] }
  }
  
  if (suggestions.length > 10) {
    errors.push('子任务数量不能超过10个')
  }
  
  suggestions.forEach((suggestion, index) => {
    const suggestionErrors: string[] = []
    
    if (!suggestion.title || suggestion.title.trim().length === 0) {
      suggestionErrors.push(`第${index + 1}个子任务缺少标题`)
    }
    
    if (suggestion.title && suggestion.title.length > 100) {
      suggestionErrors.push(`第${index + 1}个子任务标题过长`)
    }
    
    // 优先级验证已移除，所有子任务默认为medium优先级
    
    if (typeof suggestion.order !== 'number' || suggestion.order < 1) {
      suggestionErrors.push(`第${index + 1}个子任务排序无效`)
    }
    
    if (suggestionErrors.length === 0) {
      validSuggestions.push(suggestion)
    } else {
      errors.push(...suggestionErrors)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors,
    validSuggestions
  }
}

// 生成子任务的默认描述
export function generateDefaultDescription(title: string): string {
  const templates = {
    '准备': '收集相关资料，制定详细计划，确保所有必要条件都已具备',
    '制作': '根据要求创建相应的内容或物品，注意质量和细节',
    '完成': '按照既定标准执行任务，确保达到预期目标',
    '检查': '仔细核对相关内容，确保准确性和完整性',
    '整理': '分类归纳相关材料，建立清晰的组织结构',
    '联系': '与相关人员进行沟通协调，确保信息传达准确',
    '提交': '按时将完成的工作成果提交给相关方',
    '学习': '深入了解相关知识和技能，提升自身能力'
  }
  
  for (const [keyword, description] of Object.entries(templates)) {
    if (title.includes(keyword)) {
      return description
    }
  }
  
  return '按照要求执行此项任务，确保达到预期效果'
}
