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

// ============================================
// 优先级反思矩阵上下文
// ============================================

/**
 * 矩阵轴信息
 */
export interface MatrixAxisInfo {
  id: string           // 'urgent' | 'important' | 'impact' | 'effort' | 'interesting' | 'exciting'
  name: string         // '紧急性' | '重要性' | ...
  highLabel: string    // '紧急' | '重要' | ...
  lowLabel: string     // '不紧急' | '不重要' | ...
}

/**
 * 象限信息（包含标签和任务列表）
 */
export interface QuadrantInfo {
  label: string        // 象限名称，如 "重要且紧急"
  tasks: string[]      // 该象限中的任务标题
}

/**
 * 优先级反思的矩阵上下文
 * 用于生成更有针对性的优先级反思问题
 */
export interface MatrixContextForPriority {
  // 当前矩阵的X轴和Y轴配置
  axes: {
    xAxis: MatrixAxisInfo
    yAxis: MatrixAxisInfo
  }
  // 四个象限及其任务分布
  quadrants: {
    topLeft: QuadrantInfo      // 高Y低X（如：重要不紧急）
    topRight: QuadrantInfo     // 高Y高X（如：重要且紧急）
    bottomLeft: QuadrantInfo   // 低Y低X（如：不重要不紧急）
    bottomRight: QuadrantInfo  // 低Y高X（如：不重要但紧急）
  }
  // 待分类的任务（用户正在反思的）
  unclassifiedTasks: string[]
}

