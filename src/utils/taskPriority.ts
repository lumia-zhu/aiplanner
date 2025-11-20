/**
 * 任务优先级排序工具
 */

interface TaskWithPriority {
  priority: 'high' | 'medium' | 'low'
  isCompleted: boolean
  deadline?: string
  [key: string]: any
}

/**
 * 将优先级转换为数字权重（越高越重要）
 */
const getPriorityWeight = (priority: string): number => {
  switch (priority.toLowerCase()) {
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
    default: return 0
  }
}

/**
 * 对任务列表进行智能排序
 * 
 * 排序规则：
 * 1. 完成状态：未完成 > 已完成
 * 2. 优先级：High > Medium > Low
 * 3. 截止日期：有截止日期且较近 > 有截止日期且较远 > 无截止日期
 */
export function sortTasksByPriority<T extends TaskWithPriority>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    // 1. 完成状态 (未完成在前)
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1
    }

    // 2. 优先级 (High > Medium > Low)
    const weightA = getPriorityWeight(a.priority)
    const weightB = getPriorityWeight(b.priority)
    if (weightA !== weightB) {
      return weightB - weightA // 降序
    }

    // 3. 截止日期 (较早的在前)
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }
    // 有截止日期的排在无截止日期之前
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1

    return 0
  })
}
