/**
 * 工作流核心类型定义
 * 
 * 本文件定义了整个工作流系统的核心类型，包括：
 * - 工作流阶段
 * - 任务分析结果
 * - 建议晶片
 * - 计划版本
 * - 工作流上下文
 */

import type { Task } from '@/types'

/**
 * 工作流阶段
 * 
 * - planning: 独立规划阶段（用户自由输入任务，AI 不介入）
 * - review: AI 复盘阶段（AI 自动分析任务，显示加载动画）
 * - optimizing: 任务优化阶段（显示任务卡片和建议晶片，用户可选择工具）
 * - execution: 执行模式（锁定任务顺序，专注完成）
 */
export type WorkflowPhase = 'planning' | 'review' | 'optimizing' | 'execution'

/**
 * 任务复杂度
 * 
 * - simple: 简单任务（直接可执行，无需拆解）
 * - medium: 中等任务（需要一定计划）
 * - complex: 复杂任务（建议拆解为子任务）
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex'

/**
 * AI 工具类型
 * 
 * - decompose: 任务拆解（将复杂任务分解为子任务）
 * - estimate_time: 时间估算（AI 预估任务耗时，含 buffer）
 * - prioritize: 优先级排序（使用矩阵进行优先级分析）
 * - clarify: 任务澄清（帮助用户明确任务目标）
 * - add_checklist: 添加检查清单（生成任务检查项）
 */
export type ToolType = 
  | 'decompose' 
  | 'estimate_time' 
  | 'prioritize' 
  | 'clarify' 
  | 'add_checklist'

/**
 * 任务分析结果
 * 
 * AI 对单个任务的分析结果，包含复杂度评估、见解和建议的工具
 */
export interface TaskAnalysis {
  /** 任务 ID */
  taskId: string
  
  /** 任务复杂度 */
  complexity: TaskComplexity
  
  /** AI 的分析见解（1-3 条简短建议） */
  insights: string[]
  
  /** 建议使用的工具列表 */
  suggestedTools: ToolType[]
  
  /** AI 的信心度（0-1，越高表示 AI 越确定） */
  confidence: number
  
  /** 分析时间戳 */
  timestamp: Date
  
  /** 扩展元数据（用于未来功能） */
  metadata?: Record<string, any>
}

/**
 * 建议晶片（Suggestion Chip）
 * 
 * 显示在任务卡片上的药丸状建议按钮，非侵入式设计
 */
export interface SuggestionChip {
  /** 晶片唯一 ID */
  id: string
  
  /** 工具类型 */
  type: ToolType
  
  /** 显示文本（如："❓ 让任务更具体"） */
  label: string
  
  /** Emoji 图标 */
  icon: string
  
  /** 显示优先级（1 最高，数字越小越靠前） */
  priority: number
  
  /** 关联的任务 ID */
  taskId: string
  
  /** 晶片是否已使用 */
  used?: boolean
  
  /** 扩展元数据 */
  metadata?: Record<string, any>
}

/**
 * 计划变更记录
 * 
 * 记录从 Plan A 到 Plan B 的每一个变更
 */
export interface PlanChange {
  /** 变更类型 */
  type: 'decomposed' | 'reordered' | 'time_estimated' | 'prioritized' | 'edited' | 'added' | 'deleted'
  
  /** 变更的任务 ID */
  taskId: string
  
  /** 变更描述（如："将任务拆解为 3 个子任务"） */
  description: string
  
  /** 变更前的状态（可选） */
  before?: any
  
  /** 变更后的状态（可选） */
  after?: any
  
  /** 变更时间 */
  timestamp: Date
}

/**
 * 计划版本
 * 
 * Plan A: 用户的原始计划
 * Plan B: AI 辅助优化后的计划
 */
export interface PlanVersion {
  /** 版本标识 */
  version: 'A' | 'B'
  
  /** 任务列表 */
  tasks: Task[]
  
  /** 创建时间 */
  createdAt: Date
  
  /** 变更记录列表 */
  changes: PlanChange[]
  
  /** 版本描述（可选） */
  description?: string
}

/**
 * 工作流上下文
 * 
 * 整个工作流程中共享的数据上下文
 */
export interface WorkflowContext {
  /** 当前工作流阶段 */
  phase: WorkflowPhase
  
  /** 当前任务列表 */
  tasks: Task[]
  
  /** Plan A（原始计划） */
  planA?: PlanVersion
  
  /** Plan B（优化后的计划） */
  planB?: PlanVersion
  
  /** 任务分析结果（taskId -> TaskAnalysis） */
  analyses: Map<string, TaskAnalysis>
  
  /** 建议晶片列表 */
  chips: SuggestionChip[]
  
  /** 推荐操作列表（新增：用于Badge标签） */
  recommendations?: Array<{
    type: 'clarify' | 'decompose' | 'estimate' | 'prioritize' | 'checklist';
    label: string;
    icon: string;
    taskIds: string[];
    count: number;
    description: string;
  }>
  
  /** 是否正在加载 */
  isLoading: boolean
  
  /** 错误信息（如果有） */
  error?: string
  
  /** 扩展元数据 */
  metadata: Record<string, any>
}

/**
 * 工作流步骤定义
 * 
 * 定义工作流中的单个步骤
 */
export interface WorkflowStep {
  /** 步骤 ID */
  id: string
  
  /** 步骤名称 */
  name: string
  
  /** 步骤描述（可选） */
  description?: string
  
  /** 执行函数 */
  execute: (context: WorkflowContext) => Promise<WorkflowContext>
  
  /** 是否可以跳过（失败时） */
  canSkip?: boolean
  
  /** 执行条件（返回 true 才执行） */
  condition?: (context: WorkflowContext) => boolean
  
  /** 成功回调 */
  onSuccess?: (context: WorkflowContext) => void
  
  /** 失败回调 */
  onError?: (error: Error, context: WorkflowContext) => void
  
  /** 预计耗时（ms，用于进度显示） */
  estimatedDuration?: number
}

/**
 * 工作流阶段配置
 */
export interface WorkflowPhaseConfig {
  /** 阶段 ID */
  id: WorkflowPhase
  
  /** 阶段名称 */
  name: string
  
  /** 阶段描述 */
  description: string
  
  /** 阶段图标 */
  icon: string
  
  /** 步骤列表 */
  steps: WorkflowStep[]
}

/**
 * 工作流配置
 * 
 * 完整的工作流定义，包含所有阶段
 */
export interface WorkflowConfig {
  /** 配置 ID */
  id: string
  
  /** 配置名称 */
  name: string
  
  /** 配置描述 */
  description?: string
  
  /** 阶段列表 */
  phases: WorkflowPhaseConfig[]
  
  /** 是否为默认配置 */
  isDefault?: boolean
}



