// ============================================
// 元认知反思系统类型定义
// ============================================

/**
 * 计划快照 - 存储用户展开侧栏时的任务状态
 */
export interface PlanSnapshot {
  id: string
  userId: string
  createdAt: string
  noteDate: string
  taskCount: number
  tasksJson: TaskSnapshot[]
}

/**
 * 快照中的任务结构
 */
export interface TaskSnapshot {
  id: string
  title: string
  priority?: 'high' | 'medium' | 'low'
  estimatedDuration?: number
  deadline?: string
  isCompleted: boolean
  notePosition?: number
  depth?: number  // 任务层级：0 = 顶层任务，1 = 子任务，2 = 孙任务...
  parent_task_id?: string | null  // ⭐ 父任务ID（用于建立层级关系）
}

/**
 * 反思会话状态
 */
export type ReflectionSessionStatus = 'in_progress' | 'completed' | 'skipped'

/**
 * 反思轮次
 */
export type ReflectionRound = 'overview' | 'clarity' | 'decomposition' | 'time' | 'priority' | 'summary'

/**
 * Global Scan 结果
 */
export interface ScanResult {
  vagueTaskCount: number        // 模糊任务数量
  unestimatedTaskCount: number  // 未估时任务数量
  workloadLevel: 'light' | 'medium' | 'heavy'  // 工作负载
  crossDayTasks: string[]       // 跨天任务标题
  deadlineConflicts: string[]   // deadline 冲突任务
  noPriorityCount: number       // 未设优先级数量
  totalTaskCount: number        // 总任务数
}

/**
 * 单轮反思记录
 */
export interface RoundRecord {
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  questions: string[]           // AI 提出的问题
  userResponses: string[]       // 用户的回答
  startedAt?: string
  completedAt?: string
}

/**
 * 四轮反思记录
 */
export interface RoundsJson {
  clarity?: RoundRecord
  decomposition?: RoundRecord
  time?: RoundRecord
  priority?: RoundRecord
}

/**
 * 反思会话 - 存储完整的反思过程
 */
export interface ReflectionSession {
  id: string
  planSnapshotId: string
  userId: string
  createdAt: string
  updatedAt: string
  status: ReflectionSessionStatus
  currentRound: ReflectionRound
  scanResult?: ScanResult
  overviewSummary?: string
  roundsJson: RoundsJson
  finalSummary?: string
  executionSuggestions?: string[]
  completedAt?: string
}

/**
 * 创建计划快照的输入
 */
export interface CreatePlanSnapshotInput {
  userId: string
  noteDate: string
  tasksJson: TaskSnapshot[]
}

/**
 * 创建反思会话的输入
 */
export interface CreateReflectionSessionInput {
  planSnapshotId: string
  userId: string
}

/**
 * 更新反思会话的输入
 */
export interface UpdateReflectionSessionInput {
  status?: ReflectionSessionStatus
  currentRound?: ReflectionRound
  scanResult?: ScanResult
  overviewSummary?: string
  roundsJson?: RoundsJson
  finalSummary?: string
  executionSuggestions?: string[]
  completedAt?: string
}

