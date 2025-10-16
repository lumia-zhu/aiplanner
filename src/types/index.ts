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
  tags?: string[] // ⭐ 新增: 任务标签(可选,最多3个)
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
  tags?: string[] // ⭐ 新增: 任务标签(可选)
}

// 用户个人资料类型
export interface UserProfile {
  id: string
  user_id: string
  major?: string              // 专业
  grade?: string              // 年级
  challenges: string[]        // 挑战标签数组
  workplaces: string[]        // 工作场所标签数组
  custom_task_tags?: string[] // ⭐ 新增: 用户自定义任务标签池(可选,最多20个)
  created_at: string
  updated_at: string
}

// 用户个人资料输入类型（用于创建/更新）
export interface UserProfileInput {
  major?: string
  grade?: string
  challenges?: string[]
  workplaces?: string[]
  custom_task_tags?: string[] // ⭐ 新增: 用户自定义任务标签池
}

// 预定义的年级选项
export const GRADE_OPTIONS = {
  undergraduate: ['大一', '大二', '大三', '大四'],
  master: ['硕一', '硕二', '硕三'],
  phd: ['博一', '博二', '博三', '博四', '博五'],
} as const

// 所有年级选项（扁平化）
export const ALL_GRADES = [
  ...GRADE_OPTIONS.undergraduate,
  ...GRADE_OPTIONS.master,
  ...GRADE_OPTIONS.phd,
] as const

// 预定义的挑战标签（后续步骤会使用）
export const CHALLENGE_TAGS = [
  '拖延',
  '夜猫子',
  '容易分心',
  '完美主义',
  '时间估算不准',
  '优先级不清',
] as const

// 预定义的工作场所标签（后续步骤会使用）
export const WORKPLACE_TAGS = [
  '教室',
  '图书馆',
  '工位',
  '咖啡厅',
  '宿舍',
  '自习室',
  '家里',
] as const

// 用户认证相关类型（扩展，包含个人资料）
export interface AuthUser {
  id: string
  username: string
  profile?: UserProfile      // 用户个人资料（可选）
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

// ============================================
// 任务标签系统相关类型和常量
// ============================================

// 预设任务标签
export const PRESET_TASK_TAGS = [
  'easy',      // 简单
  'difficult', // 困难
  'important', // 重要
  'urgent',    // 紧急
] as const

// 标签显示名称映射(中英文)
export const TASK_TAG_LABELS: Record<string, string> = {
  easy: '简单',
  difficult: '困难',
  important: '重要',
  urgent: '紧急',
}

// 标签配置
export const TASK_TAG_CONFIG = {
  MAX_TAGS_PER_TASK: 3,        // 每个任务最多3个标签
  MAX_CUSTOM_TAGS: 20,          // 用户最多保存20个自定义标签
  MAX_TAG_LENGTH: 10,           // 每个标签最多10个字符
  TAG_REGEX: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,  // 只允许中文、字母、数字
} as const

// 标签颜色配置
export const TASK_TAG_COLORS: Record<string, {
  bg: string
  text: string
  border: string
  icon: string
}> = {
  easy: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    icon: '✅'
  },
  difficult: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    icon: '🔥'
  },
  important: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    icon: '⭐'
  },
  urgent: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    icon: '⚡'
  },
  // 自定义标签默认样式
  default: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
    icon: '🏷️'
  }
}

// 标签工具函数

/**
 * 获取标签的颜色配置
 * @param tag 标签名称
 * @returns 颜色配置对象
 */
export function getTagColor(tag: string) {
  return TASK_TAG_COLORS[tag] || TASK_TAG_COLORS.default
}

/**
 * 获取标签的显示名称
 * @param tag 标签名称
 * @returns 显示名称(预设标签返回中文,自定义标签返回原始值)
 */
export function getTagLabel(tag: string) {
  return TASK_TAG_LABELS[tag] || tag
}

/**
 * 验证标签名称是否合法
 * @param tag 标签名称
 * @returns 错误信息(null表示验证通过)
 */
export function validateTagName(tag: string): string | null {
  if (!tag.trim()) {
    return '标签不能为空'
  }
  if (tag.length > TASK_TAG_CONFIG.MAX_TAG_LENGTH) {
    return `标签最多${TASK_TAG_CONFIG.MAX_TAG_LENGTH}个字符`
  }
  if (!TASK_TAG_CONFIG.TAG_REGEX.test(tag)) {
    return '标签只能包含中文、字母和数字'
  }
  return null  // 验证通过
}

/**
 * 安全获取任务标签列表
 * @param task 任务对象
 * @returns 标签数组(确保不为undefined/null)
 */
export function getTaskTags(task: Task): string[] {
  return task.tags ?? []
}

/**
 * 检查任务是否有标签
 * @param task 任务对象
 * @returns 是否有标签
 */
export function hasTaskTags(task: Task): boolean {
  return (task.tags?.length ?? 0) > 0
}
