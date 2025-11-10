/**
 * Agent 工具注册中心
 * 
 * 管理所有可用的 Agent 工具，提供工具查找和注册功能
 * Phase 2: 工具层开发
 */

import type { AgentTool } from '../AgentTypes'

// Phase 2: 工具类导入（将在各个 Step 中逐步取消注释）
import { LoadTaskContextTool } from './LoadTaskContextTool' // ✅ Step 2
import { GetTasksTool } from './GetTasksTool' // ✅ Step 3
import { AnalyzeTasksTool } from './AnalyzeTasksTool' // ✅ Step 4
import { ClarifyTaskTool } from './ClarifyTaskTool' // ✅ Step 5
import { DecomposeTaskTool } from './DecomposeTaskTool' // ✅ Step 6
import { EstimateTimeTool } from './EstimateTimeTool' // ✅ Step 7

// Phase 5: CRUD 工具（P0 核心功能）
import { CreateTaskTool } from './CreateTaskTool' // ✅ Phase 5 Step 3
import { CreateRecurringTasksTool } from './CreateRecurringTasksTool' // ✅ 批量创建工具
import { UpdateTaskTool } from './UpdateTaskTool' // ✅ Phase 5 Step 4
import { UpdateRecurringTasksTool } from './UpdateRecurringTasksTool' // ✅ 批量更新工具
import { DeleteTaskTool } from './DeleteTaskTool' // ✅ Phase 5 Step 5
import { DeleteRecurringTasksTool } from './DeleteRecurringTasksTool' // ✅ 批量删除工具

/**
 * 工具实例缓存
 * 避免重复创建工具实例，提升性能
 */
let toolsCache: AgentTool[] | null = null

/**
 * 获取所有可用的 Agent 工具
 * 
 * @returns 工具列表
 */
export function getAllTools(): AgentTool[] {
  // 如果缓存存在，直接返回
  if (toolsCache) {
    return toolsCache
  }

  // Phase 2: 逐步添加工具实例
  toolsCache = [
    new LoadTaskContextTool(), // ✅ Step 2
    new GetTasksTool(), // ✅ Step 3
    new AnalyzeTasksTool(), // ✅ Step 4
    new ClarifyTaskTool(), // ✅ Step 5
    new DecomposeTaskTool(), // ✅ Step 6
    new EstimateTimeTool(), // ✅ Step 7
    // Phase 5: CRUD 工具
    new CreateTaskTool(), // ✅ Phase 5 Step 3
    new CreateRecurringTasksTool(), // ✅ 批量创建工具
    new UpdateTaskTool(), // ✅ Phase 5 Step 4
    new UpdateRecurringTasksTool(), // ✅ 批量更新工具
    new DeleteTaskTool(), // ✅ Phase 5 Step 5
    new DeleteRecurringTasksTool(), // ✅ 批量删除工具
  ]

  const toolNames = toolsCache.map(t => t.name).join(', ')
  console.log(`✅ Agent 工具已加载 (${toolsCache.length}): ${toolNames || '无'}`)
  
  return toolsCache
}

/**
 * 根据名称获取工具
 * 
 * @param name 工具名称
 * @returns 工具实例
 * @throws 如果工具不存在，抛出错误
 */
export function getTool(name: string): AgentTool {
  const tools = getAllTools()
  const tool = tools.find(t => t.name === name)
  
  if (!tool) {
    const availableTools = tools.map(t => t.name).join(', ')
    throw new Error(
      `工具 "${name}" 不存在。可用工具: ${availableTools || '无'}`
    )
  }
  
  return tool
}

/**
 * 重置工具缓存
 * 主要用于测试，强制重新创建工具实例
 */
export function resetToolsCache(): void {
  toolsCache = null
  console.log('🧹 工具缓存已清空')
}

/**
 * 检查工具是否存在
 * 
 * @param name 工具名称
 * @returns 工具是否存在
 */
export function hasToolByName(name: string): boolean {
  const tools = getAllTools()
  return tools.some(t => t.name === name)
}

