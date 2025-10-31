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
  noteDate: string              // 任务来自哪天的笔记 (YYYY-MM-DD)
  notePosition: number          // 在笔记中的位置
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
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
  notePosition?: number         // 在笔记中的位置（默认 0）
}

/**
 * 更新任务的输入参数
 */
export interface UpdateDailyTaskInput {
  title?: string                // 任务标题
  completed?: boolean           // 是否完成
  date?: string                 // 任务所属日期
  deadlineDatetime?: string     // 截止时间
  notePosition?: number         // 在笔记中的位置
}

/**
 * 从笔记内容解析出的任务信息
 */
export interface ParsedTask {
  title: string                 // 任务标题
  completed: boolean            // 是否完成
  position: number              // 在笔记中的位置（第几个任务）
  deadlineDatetime?: string     // 截止时间（如果有 @时间 标记）
}

/**
 * 任务同步结果
 */
export interface TaskSyncResult {
  created: number               // 新建任务数
  updated: number               // 更新任务数
  deleted: number               // 删除任务数
  errors: string[]              // 错误信息
}


