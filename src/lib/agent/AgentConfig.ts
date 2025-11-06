/**
 * Agent 配置
 * 
 * 控制 Agent 模式的启用、行为参数等
 */

import type { AgentConfig } from './AgentTypes'

/**
 * 默认配置
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  // 是否启用 Agent 模式（默认关闭，通过环境变量或 UI 开启）
  enabled: process.env.NEXT_PUBLIC_AGENT_MODE === 'true',
  
  // 最大迭代次数（防止死循环）
  maxIterations: 5,
  
  // LLM 配置
  llm: {
    model: 'doubao-seed-1-6-vision-250815',
    temperature: 0.7,
    maxTokens: 1000
  },
  
  // 可用工具列表（Phase 2 会实现这些工具）
  tools: [
    'get_tasks',
    'analyze_tasks',
    'decompose_task',
    'clarify_task',
    'estimate_time'
  ],
  
  // 如果 Agent 出错，自动回退到旧流程
  fallbackToLegacy: true,
  
  // 任务上下文缓存配置
  taskContextConfig: {
    // 启用任务上下文缓存
    enabled: true,
    
    // 缓存有效期：5分钟（避免频繁查询数据库）
    cacheDuration: 5 * 60 * 1000,
    
    // 最多缓存 200 个任务（近3个月的任务）
    maxTasksToCache: 200
  }
}

/**
 * 获取当前配置
 */
export function getAgentConfig(): AgentConfig {
  return DEFAULT_AGENT_CONFIG
}

/**
 * 更新配置（用于测试和调试）
 */
export function updateAgentConfig(partial: Partial<AgentConfig>): AgentConfig {
  Object.assign(DEFAULT_AGENT_CONFIG, partial)
  return DEFAULT_AGENT_CONFIG
}



