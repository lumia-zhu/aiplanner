// 用户类型
export interface User {
  id: string
  username: string
  created_at: string
}

// 任务类型
export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  deadline_datetime?: string // 完整的日期时间（当天+具体时间）
  priority?: 'low' | 'medium' | 'high' // 可选：不是所有任务都有优先级
  completed: boolean
  created_at: string
  updated_at: string
  
  // 任务拆解相关字段
  parent_id?: string // 父任务ID，NULL表示顶级任务
  subtask_order?: number // 子任务排序序号
  estimated_duration?: string // 预估执行时长，如"2小时"、"30分钟"
  is_expanded?: boolean // 任务是否展开显示子任务（UI状态）
  
  // 前端计算字段（不存储在数据库）
  subtasks?: Task[] // 子任务数组
  level?: number // 任务层级深度（用于显示缩进）
}

// 任务创建/更新的输入类型
export interface TaskInput {
  title: string
  description?: string
  deadline_time?: string // 用户输入的时间（如 "14:00"）
  priority?: 'low' | 'medium' | 'high' // 可选：不是所有任务都有优先级
  completed?: boolean
}

// 用户认证相关类型
export interface AuthUser {
  id: string
  username: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterCredentials {
  username: string
  password: string
}

// 任务拆解相关类型
export interface SubtaskSuggestion {
  id: string // 临时ID，用于前端编辑
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  estimated_duration?: string // 预估时长，如"30分钟"、"2小时"
  is_selected: boolean // 是否被用户选中
  order: number // 排序序号
}

// 任务拆解状态
export interface TaskDecompositionState {
  parentTask: Task
  suggestions: SubtaskSuggestion[]
  isGenerating: boolean
  isEditing: boolean
}

// 任务树节点（用于层级显示）
export interface TaskTreeNode extends Task {
  children: TaskTreeNode[]
  depth: number
}
