import type { Task } from '@/types'

// 任务排序函数
export function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    // 首先按优先级排序
    const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 }
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // 然后按截止时间排序
    if (!a.deadline_datetime && !b.deadline_datetime) return 0
    if (!a.deadline_datetime) return 1
    if (!b.deadline_datetime) return -1
    
    return new Date(a.deadline_datetime).getTime() - new Date(b.deadline_datetime).getTime()
  })
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 任务操作的乐观更新辅助函数
export const taskOperations = {
  // 添加任务
  addTask: (tasks: Task[], newTask: Task): Task[] => {
    return sortTasks([...tasks, newTask])
  },
  
  // 更新任务
  updateTask: (tasks: Task[], updatedTask: Task): Task[] => {
    const updated = tasks.map(task =>
      task.id === updatedTask.id ? updatedTask : task
    )
    return sortTasks(updated)
  },
  
  // 删除任务
  removeTask: (tasks: Task[], taskId: string): Task[] => {
    return tasks.filter(task => task.id !== taskId)
  },
  
  // 切换完成状态（支持嵌套子任务）
  toggleComplete: (tasks: Task[], taskId: string, completed: boolean): Task[] => {
    return tasks.map(task => {
      // 如果是目标任务，更新其完成状态
      if (task.id === taskId) {
        return { ...task, completed }
      }
      
      // 如果任务有子任务，递归检查并更新子任务
      if (task.subtasks && task.subtasks.length > 0) {
        const updatedSubtasks = taskOperations.toggleComplete(task.subtasks, taskId, completed)
        // 只有当子任务真的发生了变化时才返回新对象
        if (updatedSubtasks !== task.subtasks) {
          return { ...task, subtasks: updatedSubtasks }
        }
      }
      
      return task
    })
  }
}

