/**
 * 工具注册中心
 * 
 * TODO: Phase 2 实现具体工具
 */

import type { AgentTool } from '../AgentTypes'

/**
 * 获取所有可用工具
 * 
 * @returns 工具列表
 */
export function getAllTools(): AgentTool[] {
  console.log('🔧 获取所有工具（占位符 - Phase 2 会实现）')
  
  // 占位符：返回空数组
  return []
}

/**
 * 根据名称获取工具
 * 
 * @param name 工具名称
 * @returns 工具实例或 undefined
 */
export function getTool(name: string): AgentTool | undefined {
  const tools = getAllTools()
  return tools.find(t => t.name === name)
}

