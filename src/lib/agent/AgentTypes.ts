/**
 * Agent 核心类型定义
 * 
 * 这个文件定义了 Agent 系统中所有核心类型，包括：
 * - 工具接口（AgentTool）
 * - 工具执行结果（ToolResult）
 * - Agent 上下文（AgentContext）
 * - Agent 响应（AgentResponse）
 * - Long-term Memory（任务上下文缓存）
 */

import type { Task, UserProfile, DateScope } from '@/types'

// ==================== 工具相关类型 ====================

/**
 * 工具执行结果
 * 
 * 支持三种类型：
 * 1. success: 执行成功，返回数据
 * 2. need_input: 需要用户输入（暂停 ReAct 循环）
 * 3. error: 执行失败
 */
export type ToolResult = 
  | {
      type: 'success'
      data: any
    }
  | {
      type: 'need_input'
      prompt: string      // 要询问用户的问题
      context: any        // 上下文信息（用于恢复流程）
    }
  | {
      type: 'error'
      message: string
    }

/**
 * 工具参数定义
 */
export interface ParameterSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    required?: boolean
  }>
  required?: string[]
}

/**
 * Agent 工具接口
 * 
 * 所有工具必须实现这个接口
 */
export interface AgentTool {
  /** 工具名称（唯一标识） */
  name: string
  
  /** 工具描述（供 LLM 理解工具用途） */
  description: string
  
  /** 参数定义 */
  parameters: ParameterSchema
  
  /** 执行工具 */
  execute(params: any): Promise<ToolResult>
}

// ==================== Long-term Memory 相关类型 ====================

/**
 * 任务上下文缓存（Long-term Memory）
 * 
 * 包含近3个月（当前月+前后各1个月）的任务信息
 */
export interface TaskContext {
  /** 最后更新时间 */
  lastUpdated: Date
  
  /** 今天的任务详情 */
  todayTasks: Task[]
  
  /** 近3个月的任务摘要 */
  recentTasksSummary: {
    /** 总任务数 */
    totalCount: number
    
    /** 已完成任务数 */
    completedCount: number
    
    /** 紧急任务数（截止日期在7天内） */
    urgentCount: number
    
    /** 缺少时间估算的任务数 */
    missingEstimationCount: number
    
    /** 缺少描述的任务数 */
    missingDescriptionCount: number
    
    /** 按优先级分组 */
    byPriority: {
      high: number
      medium: number
      low: number
    }
    
    /** 按月份分组的任务数 */
    byMonth: {
      previousMonth: {
        date: string
        total: number
        completed: number
      }
      currentMonth: {
        date: string
        total: number
        completed: number
      }
      nextMonth: {
        date: string
        total: number
        completed: number
      }
    }
  }
  
  /** 近3个月的任务列表（简化版，用于快速查询） */
  recentTasks: Array<{
    id: string
    title: string
    priority: string
    deadline: string | null
    hasEstimation: boolean
    hasDescription: boolean
    completed: boolean
    month: string  // 'previous' | 'current' | 'next'
  }>
}

// ==================== Agent 相关类型 ====================

/**
 * Agent 上下文
 * 
 * 包含 Agent 运行所需的所有上下文信息
 */
export interface AgentContext {
  /** 用户 ID */
  userId: string
  
  /** 用户资料 */
  userProfile: UserProfile | null
  
  /** 日期范围 */
  dateScope: DateScope
  
  /** 任务上下文缓存（Long-term Memory） */
  taskContext?: TaskContext
}

/**
 * Agent 响应类型
 */
export type AgentResponse = 
  | {
      type: 'text'
      content: string
      metadata?: {
        iterations: number
        thoughts: string[]
        usedTools?: string[]  // 使用了哪些工具
      }
    }
  | {
      type: 'need_user_input'
      prompt: string
      context: any
      metadata?: {
        iterations: number
        pendingTool: string
        toolInput: any
      }
    }
  | {
      type: 'error'
      content: string
      metadata?: {
        iterations?: number
        error?: Error
      }
    }

// ==================== ReAct 相关类型 ====================

/**
 * 对话消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Thought: Agent 的思考过程
 */
export interface Thought {
  content: string
  timestamp: Date
}

/**
 * Action: Agent 的行动
 */
export interface Action {
  tool: string
  input: any
  timestamp: Date
}

/**
 * Observation: 工具执行的观察结果
 */
export interface Observation {
  result: ToolResult
  timestamp: Date
}

/**
 * ReAct 循环的一个步骤
 */
export interface ReActStep {
  thought: Thought
  action: Action
  observation: Observation
}

/**
 * 解析后的 LLM 输出
 */
export type ParsedOutput = 
  | {
      type: 'response'
      thought: string
      response: string
    }
  | {
      type: 'action'
      thought: string
      action: string
      actionInput: any
    }

// ==================== 配置相关类型 ====================

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** 是否启用 Agent 模式 */
  enabled: boolean
  
  /** 最大迭代次数 */
  maxIterations: number
  
  /** LLM 配置 */
  llm: {
    model: string
    temperature: number
    maxTokens: number
  }
  
  /** 工具列表 */
  tools: string[]
  
  /** 是否启用 Fallback */
  fallbackToLegacy: boolean
  
  /** 任务上下文缓存配置 */
  taskContextConfig: {
    /** 是否启用任务上下文缓存 */
    enabled: boolean
    
    /** 缓存有效期（毫秒） */
    cacheDuration: number
    
    /** 任务数量上限（避免过大） */
    maxTasksToCache: number
  }
}

/**
 * Agent 记忆接口
 */
export interface IAgentMemory {
  /** 添加对话消息 */
  addMessage(message: { role: 'user' | 'assistant'; content: string }): void
  
  /** 添加思考 */
  addThought(thought: string): void
  
  /** 添加 ReAct 步骤 */
  addStep(step: { action: string; input: any; observation: any }): void
  
  /** 获取对话历史 */
  getHistory(): Array<{ role: string; content: string }>
  
  /** 获取思考历史 */
  getThoughts(): string[]
  
  /** 获取 ReAct 步骤历史 */
  getSteps(): ReActStep[]
  
  /** 更新任务上下文（Long-term Memory） */
  updateTaskContext(taskContext: TaskContext): void
  
  /** 获取任务上下文 */
  getTaskContext(): TaskContext | null
  
  /** 清空记忆（保留任务上下文） */
  clear(): void
  
  /** 完全清空（包括任务上下文） */
  clearAll(): void
}



