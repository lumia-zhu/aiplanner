// ============================================
// 笔记任务类型定义
// ============================================
// 用于笔记编辑器中的任务（Tiptap TaskList items）
// ============================================

/**
 * 笔记任务数据结构
 */
export interface DailyTask {
  id: string                    // 任务ID
  userId: string                // 用户ID
  title: string                 // 任务标题
  completed: boolean            // 是否完成
  date: string                  // 任务所属日期 (YYYY-MM-DD)
  deadlineDatetime?: string     // 截止时间 (ISO 8601)
  estimatedDuration?: number    // ⭐ 预估时长（分钟）
  noteDate: string              // 任务来自哪天的笔记 (YYYY-MM-DD)
  notePosition: number          // 在笔记中的位置
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
  tags?: string[]               // 任务标签（可选）
  priority?: 'low' | 'medium' | 'high'  // 优先级（可选）
  depth?: number                // 🆕 任务层级：0 = 主任务，1 = 子任务
  parentTaskId?: string | null  // 🆕 父任务ID（用于建立层级关系）
}

/**
 * 创建任务的输入参数
 */
export interface CreateDailyTaskInput {
  title: string                 // 任务标题（必填）
  date: string                  // 任务所属日期（必填）
  noteDate: string              // 任务来自哪天的笔记（必填）
  completed?: boolean           // 是否完成（默认 false）
  deadlineDatetime?: string     // 截止时间（可选）
  estimatedDuration?: number    // ⭐ 预估时长（分钟）
  notePosition?: number         // 在笔记中的位置（默认 0）
  depth?: number                // 🆕 任务层级（0=主任务，1=子任务）
  parentTaskId?: string | null  // 🆕 父任务ID
}

/**
 * 更新任务的输入参数
 */
export interface UpdateDailyTaskInput {
  title?: string                // 任务标题
  completed?: boolean           // 是否完成
  date?: string                 // 任务所属日期
  deadlineDatetime?: string     // 截止时间
  estimatedDuration?: number    // ⭐ 预估时长（分钟）
  notePosition?: number         // 在笔记中的位置
  depth?: number                // 🆕 任务层级深度
  parentTaskId?: string | null  // 🆕 父任务ID
}

/**
 * 从笔记内容解析出的任务信息
 */
export interface ParsedTask {
  title: string                 // 任务标题
  completed: boolean            // 是否完成
  position: number              // 在笔记中的位置（第几个任务）
  deadlineDatetime?: string     // 截止时间（如果有 @时间 标记）
  estimatedDuration?: number    // ⭐ 预估时长（分钟）
  depth?: number                // 任务层级：0 = 顶层任务，1 = 子任务，2 = 孙任务...
  parentPosition?: number       // 🆕 父任务的位置（用于后续建立父子关系）
}

/**
 * 完成状态变化的任务信息
 */
export interface TaskCompletionChange {
  taskId: string
  taskTitle: string
  newCompleted: boolean  // true = 完成, false = 取消完成
}

/**
 * 任务同步结果
 */
export interface TaskSyncResult {
  created: number               // 新建任务数
  updated: number               // 更新任务数
  deleted: number               // 删除任务数
  errors: string[]              // 错误信息
  completionChanges: TaskCompletionChange[]  // 🆕 完成状态变化的任务列表
}







