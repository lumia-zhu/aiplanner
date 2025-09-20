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
  deadline_time?: string // 改为截止时间（当天的具体时间）
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  created_at: string
  updated_at: string
}

// 任务创建/更新的输入类型
export interface TaskInput {
  title: string
  description?: string
  deadline_time?: string // 改为截止时间
  priority: 'low' | 'medium' | 'high'
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
