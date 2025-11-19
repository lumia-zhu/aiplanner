/**
 * 任务优先级排序工具
 * 
 * 用于 Agent 查询任务时的智能排序
 */

export interface TaskForSorting {
  id: string
  title: string
  isCompleted: boolean
  deadline?: string
  estimatedMinutes?: number
  createdAt?: string
  noteDate?: string
}

/**
 * 多维度任务优先级排序
 * 
 * 排序逻辑（优先级从高到低）：
 * 1. 未完成任务 > 已完成任务
 * 2. 有截止日期 > 无截止日期
 * 3. 截止日期越近 > 越远
 * 4. 有时间估算 > 无时间估算
 * 5. 按任务所在笔记日期倒序（越新越前）
 */
export function sortTasksByPriority(tasks: TaskForSorting[]): TaskForSorting[] {
  return [...tasks].sort((a, b) => {
    // 1️⃣ 第一优先级：未完成 > 已完成
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1
    }

    // 2️⃣ 第二优先级：有截止日期 > 无截止日期
    const aHasDeadline = !!a.deadline
    const bHasDeadline = !!b.deadline
    
    if (aHasDeadline !== bHasDeadline) {
      return aHasDeadline ? -1 : 1
    }

    // 3️⃣ 第三优先级：如果都有截止日期，越近越优先
    if (aHasDeadline && bHasDeadline) {
      const aDeadlineTime = new Date(a.deadline!).getTime()
      const bDeadlineTime = new Date(b.deadline!).getTime()
      
      if (aDeadlineTime !== bDeadlineTime) {
        return aDeadlineTime - bDeadlineTime // 升序：越早越优先
      }
    }

    // 4️⃣ 第四优先级：有时间估算 > 无时间估算
    const aHasEstimation = !!a.estimatedMinutes
    const bHasEstimation = !!b.estimatedMinutes
    
    if (aHasEstimation !== bHasEstimation) {
      return aHasEstimation ? -1 : 1
    }

    // 5️⃣ 最后：按笔记日期倒序（越新越前）
    if (a.noteDate && b.noteDate) {
      return b.noteDate.localeCompare(a.noteDate)
    }

    // 兜底：保持原有顺序
    return 0
  })
}

/**
 * 获取任务的优先级描述（用于调试）
 */
export function getTaskPriorityLabel(task: TaskForSorting): string {
  const labels: string[] = []
  
  if (!task.isCompleted) labels.push('未完成')
  if (task.deadline) labels.push(`截止:${task.deadline}`)
  if (task.estimatedMinutes) labels.push(`预计:${task.estimatedMinutes}分钟`)
  
  return labels.join(' | ') || '普通任务'
}



