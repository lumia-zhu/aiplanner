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

// 标签颜色配置 - ADHD友好设计：统一灰色调，无图标，降低视觉干扰
export const TASK_TAG_COLORS: Record<string, {
  bg: string
  text: string
  border: string
  icon: string
}> = {
  easy: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '' // 移除图标
  },
  difficult: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '' // 移除图标
  },
  important: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '' // 移除图标
  },
  urgent: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '' // 移除图标
  },
  // 自定义标签默认样式
  default: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '' // 移除图标
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

// ============================================
// AI工作流辅助相关类型
// ============================================

/**
 * AI辅助完善计划的流程阶段
 */
export type WorkflowMode = 
  | 'initial'            // 初始状态:展示任务列表和推荐
  | 'single-task'        // 完善单个任务模式
  | 'single-task-action' // 选择单个任务操作
  | 'task-selection'     // 选择要拆解的任务
  | 'task-context-input' // 等待用户输入任务上下文（拆解前收集背景信息）
  | 'priority-sort'      // 优先级排序模式(总入口)
  | 'priority-feeling'   // 询问感觉阶段
  | 'priority-matrix'    // 显示矩阵阶段
  | 'ended'              // 已结束

/**
 * AI推荐类型
 */
export interface AIRecommendation {
  mode: 'single-task' | 'priority-sort'  // 推荐的模式
  reason: string                          // 推荐理由
  confidence: 'high' | 'medium' | 'low'   // 推荐置信度
}

/**
 * 工作流选项配置
 */
export interface WorkflowOption {
  id: 'A' | 'B' | 'C'      // 选项ID
  label: string             // 选项标签
  description: string       // 选项描述
  icon: string              // 选项图标(emoji)
}

/**
 * 优先级排序的感觉选项类型
 */
export type PrioritySortFeeling = 'urgent' | 'overwhelmed' | 'blank' | 'back'

/**
 * 感觉选项配置
 */
export interface FeelingOption {
  id: PrioritySortFeeling  // 选项ID
  emoji: string             // 选项Emoji
  label: string             // 选项标签
  description: string       // 选项描述
}

/**
 * 单个任务操作类型
 */
export type SingleTaskAction = 'clarify' | 'decompose' | 'estimate' | 'back'

/**
 * 单个任务操作选项配置
 */
export interface SingleTaskActionOption {
  id: SingleTaskAction  // 操作ID
  emoji: string         // 操作Emoji
  label: string         // 操作标签
  description: string   // 操作描述
}

// ============================================
// 优先级矩阵相关类型
// ============================================

/**
 * 矩阵类型
 */
export type MatrixType = 
  | 'eisenhower'        // 艾森豪威尔矩阵 (紧急/重要)
  | 'effort-impact'     // 努力/影响矩阵
  | 'fun-stimulation'   // 趣味/刺激矩阵

/**
 * 矩阵象限配置
 */
export interface QuadrantConfig {
  label: string       // 象限标签
  color: string       // 象限颜色(hex)
  description: string // 象限描述
}

/**
 * 矩阵配置接口
 */
export interface MatrixConfig {
  type: MatrixType                           // 矩阵类型
  title: string                              // 矩阵标题
  xAxis: { min: string; max: string }        // 横轴标签
  yAxis: { min: string; max: string }        // 纵轴标签
  quadrants: {                               // 四个象限配置
    q1: QuadrantConfig  // 右上象限
    q2: QuadrantConfig  // 左上象限
    q3: QuadrantConfig  // 左下象限
    q4: QuadrantConfig  // 右下象限
  }
}

/**
 * 矩阵显示状态
 */
export interface MatrixState {
  isOpen: boolean           // 是否打开
  type: MatrixType | null   // 当前矩阵类型
  config: MatrixConfig | null  // 当前矩阵配置
}

// ============================================
// 矩阵配置常量
// ============================================

/**
 * 艾森豪威尔矩阵配置 (紧急/重要)
 */
export const EISENHOWER_MATRIX_CONFIG: MatrixConfig = {
  type: 'eisenhower',
  title: '艾森豪威尔矩阵',
  xAxis: { min: '不紧急', max: '紧急' },
  yAxis: { min: '不重要', max: '重要' },
  quadrants: {
    q1: {
      label: '重要且紧急',
      color: '#EF4444',  // 红色
      description: '必须马上做'
    },
    q2: {
      label: '重要不紧急',
      color: '#3B82F6',  // 蓝色
      description: '应该计划做'
    },
    q3: {
      label: '不重要但紧急',
      color: '#F59E0B',  // 橙色
      description: '可以委托做'
    },
    q4: {
      label: '不重要不紧急',
      color: '#10B981',  // 绿色
      description: '有空再做'
    }
  }
}

/**
 * 努力/影响矩阵配置
 */
export const EFFORT_IMPACT_MATRIX_CONFIG: MatrixConfig = {
  type: 'effort-impact',
  title: '努力/影响矩阵',
  xAxis: { min: 'Low Effort', max: 'High Effort' },
  yAxis: { min: 'Low Impact', max: 'High Impact' },
  quadrants: {
    q1: {
      label: 'High Impact, High Effort',
      color: '#EF4444',  // 红色
      description: '重大项目 - 需要规划'
    },
    q2: {
      label: 'High Impact, Low Effort',
      color: '#3B82F6',  // 蓝色
      description: '快速胜利 - 优先做'
    },
    q3: {
      label: 'Low Impact, High Effort',
      color: '#6B7280',  // 灰色
      description: '费力不讨好 - 避免'
    },
    q4: {
      label: 'Low Impact, Low Effort',
      color: '#10B981',  // 绿色
      description: '填充任务 - 有空做'
    }
  }
}

/**
 * 趣味/刺激矩阵配置
 */
export const FUN_STIMULATION_MATRIX_CONFIG: MatrixConfig = {
  type: 'fun-stimulation',
  title: '趣味/刺激矩阵',
  xAxis: { min: 'Not Fun', max: 'Fun' },
  yAxis: { min: 'Not Stimulating', max: 'Stimulating' },
  quadrants: {
    q1: {
      label: 'Stimulating & Fun',
      color: '#8B5CF6',  // 紫色
      description: '充满动力 - 尽情享受'
    },
    q2: {
      label: 'Stimulating, Not Fun',
      color: '#EF4444',  // 红色
      description: '挑战任务 - 短时冲刺'
    },
    q3: {
      label: 'Not Stimulating, Not Fun',
      color: '#6B7280',  // 灰色
      description: '枯燥任务 - 批量处理'
    },
    q4: {
      label: 'Fun, Not Stimulating',
      color: '#10B981',  // 绿色
      description: '放松任务 - 疲惫时做'
    }
  }
}

/**
 * 根据矩阵类型获取对应配置
 * @param type 矩阵类型
 * @returns 矩阵配置
 */
export function getMatrixConfig(type: MatrixType): MatrixConfig {
  switch (type) {
    case 'eisenhower':
      return EISENHOWER_MATRIX_CONFIG
    case 'effort-impact':
      return EFFORT_IMPACT_MATRIX_CONFIG
    case 'fun-stimulation':
      return FUN_STIMULATION_MATRIX_CONFIG
  }
}

/**
 * 根据感觉类型映射到对应的矩阵类型
 * @param feeling 感觉类型
 * @returns 矩阵类型 (如果是'back'则返回null)
 */
export function getMatrixTypeByFeeling(feeling: PrioritySortFeeling): MatrixType | null {
  const map: Record<PrioritySortFeeling, MatrixType | null> = {
    'urgent': 'eisenhower',
    'overwhelmed': 'effort-impact',
    'blank': 'fun-stimulation',
    'back': null
  }
  return map[feeling]
}
