/**
 * AI 工具系统类型定义
 * 
 * 本文件定义了工具注册系统相关的类型，包括：
 * - 工具配置
 * - 工具执行结果
 * - 工具权限
 */

import type { Task } from '@/types'
import type { TaskAnalysis, SuggestionChip, ToolType, TaskComplexity } from './index'

/**
 * AI 工具配置
 * 
 * 每个工具的基本配置信息
 */
export interface AIToolConfig {
  /** 工具唯一 ID */
  id: string
  
  /** 工具名称 */
  name: string
  
  /** 工具图标（Emoji） */
  icon: string
  
  /** 工具描述 */
  description: string
  
  /** 显示优先级（1 最高） */
  priority: number
  
  /** 是否启用 */
  enabled: boolean
  
  /** 工具类别 */
  category?: 'basic' | 'advanced' | 'experimental'
  
  /** 是否需要认证（VIP 功能等） */
  requiresAuth?: boolean
  
  /** 最小权限等级（0 = 所有用户，1 = VIP） */
  minPermissionLevel?: number
  
  /** 工具标签（用于筛选） */
  tags?: string[]
}

/**
 * 工具执行结果
 * 
 * 工具执行后的统一返回格式
 */
export interface ToolExecutionResult<T = any> {
  /** 是否成功 */
  success: boolean
  
  /** 返回数据 */
  data?: T
  
  /** 错误信息 */
  error?: string
  
  /** 错误代码 */
  errorCode?: string
  
  /** 执行耗时（毫秒） */
  duration: number
  
  /** 是否使用了缓存 */
  cached?: boolean
  
  /** 扩展元数据 */
  metadata?: Record<string, any>
}

/**
 * 工具执行上下文
 * 
 * 传递给工具执行函数的上下文信息
 */
export interface ToolExecutionContext {
  /** 当前任务 */
  task: Task
  
  /** 任务分析结果 */
  analysis?: TaskAnalysis
  
  /** 用户输入（可选，如补充信息） */
  userInput?: string
  
  /** 所有任务（用于上下文理解） */
  allTasks?: Task[]
  
  /** 用户 ID */
  userId?: string
  
  /** 扩展参数 */
  params?: Record<string, any>
}

/**
 * AI 工具接口
 * 
 * 所有 AI 工具都需要实现这个接口
 */
export interface IAITool {
  /** 工具配置 */
  readonly config: AIToolConfig
  
  /**
   * 判断工具是否适用于当前任务
   * 
   * @param task - 任务对象
   * @param analysis - 任务分析结果
   * @returns 是否显示此工具的晶片
   */
  isApplicable(task: Task, analysis: TaskAnalysis): boolean | Promise<boolean>
  
  /**
   * 生成建议晶片
   * 
   * @param task - 任务对象
   * @returns 晶片对象
   */
  generateChip(task: Task): SuggestionChip
  
  /**
   * 执行工具
   * 
   * @param context - 执行上下文
   * @returns 执行结果
   */
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult>
  
  /**
   * 验证工具输入
   * 
   * @param context - 执行上下文
   * @returns 是否通过验证，失败返回错误信息
   */
  validate?(context: ToolExecutionContext): { valid: boolean; error?: string }
  
  /**
   * 获取工具帮助信息
   * 
   * @returns 帮助文本
   */
  getHelp?(): string
}

/**
 * 工具注册表项
 * 
 * 工具在注册表中的存储格式
 */
export interface ToolRegistryEntry {
  /** 工具实例 */
  tool: IAITool
  
  /** 注册时间 */
  registeredAt: Date
  
  /** 使用次数 */
  usageCount: number
  
  /** 最后使用时间 */
  lastUsedAt?: Date
  
  /** 平均执行时间（ms） */
  averageExecutionTime?: number
  
  /** 成功率（0-1） */
  successRate?: number
}

/**
 * 工具统计信息
 */
export interface ToolStatistics {
  /** 工具 ID */
  toolId: string
  
  /** 总调用次数 */
  totalCalls: number
  
  /** 成功次数 */
  successCalls: number
  
  /** 失败次数 */
  failedCalls: number
  
  /** 平均执行时间（ms） */
  averageExecutionTime: number
  
  /** 最后调用时间 */
  lastCallAt?: Date
  
  /** 最常使用的任务类型 */
  mostUsedForComplexity?: TaskComplexity
}

/**
 * 任务拆解结果
 */
export interface DecomposeResult {
  /** 子任务列表 */
  subtasks: Array<{
    title: string
    description?: string
    estimated_duration: string
    order: number
  }>
}

/**
 * 时间估算结果
 */
export interface TimeEstimationResult {
  /** 预估工作时间（分钟） */
  estimatedMinutes: number
  
  /** 缓冲时间（分钟） */
  bufferMinutes: number
  
  /** 总时间（分钟） */
  totalMinutes: number
  
  /** 估算说明 */
  explanation: string
  
  /** 置信度（0-1） */
  confidence?: number
}

/**
 * 优先级排序结果
 */
export interface PrioritizeResult {
  /** 排序后的任务 ID 列表 */
  orderedTaskIds: string[]
  
  /** 排序依据的矩阵类型 */
  matrixType: 'eisenhower' | 'impact-effort' | 'energy'
  
  /** 排序说明 */
  explanation: string
  
  /** 每个任务的象限分配 */
  quadrants?: Record<string, number>
}

/**
 * 任务澄清结果
 */
export interface ClarifyResult {
  /** 澄清后的任务标题 */
  clarifiedTitle?: string
  
  /** 澄清后的描述 */
  clarifiedDescription: string
  
  /** 建议的补充问题 */
  suggestedQuestions?: string[]
  
  /** 识别出的关键信息 */
  keyPoints?: string[]
}

/**
 * 检查清单结果
 */
export interface ChecklistResult {
  /** 检查项列表 */
  items: Array<{
    text: string
    completed: boolean
    order: number
  }>
  
  /** 清单说明 */
  description?: string
}



