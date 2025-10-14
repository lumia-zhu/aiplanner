/**
 * AI 工具模块统一导出
 */

// 导出基类和注册中心
export { AITool, createToolConfig } from './base';
export { ToolRegistry, globalToolRegistry } from './registry';
export type { ToolFilter } from './registry';

// 导出具体工具
export { DecomposeTaskTool, createDecomposeTaskTool } from './decompose';
export { EstimateTimeTool, createEstimateTimeTool } from './estimate';
export { PrioritizeTasksTool, createPrioritizeTasksTool } from './prioritize';
export { ClarifyTaskTool, createClarifyTaskTool } from './clarify';
export { ChecklistTool, createChecklistTool } from './checklist';

// 导出工具创建工厂函数
import type { AIService } from '@/lib/ai/service';
import { createDecomposeTaskTool } from './decompose';
import { createEstimateTimeTool } from './estimate';
import { createPrioritizeTasksTool } from './prioritize';
import { createClarifyTaskTool } from './clarify';
import { createChecklistTool } from './checklist';
import { globalToolRegistry } from './registry';

/**
 * 初始化所有工具并注册到全局注册中心
 * @param aiService - AI 服务实例
 */
export function initializeTools(aiService: AIService): void {
  // 清空已有工具(防止重复注册)
  globalToolRegistry.clear();

  // 创建并注册所有工具
  const decomposeTask = createDecomposeTaskTool(aiService);
  const estimateTime = createEstimateTimeTool(aiService);
  const prioritizeTasks = createPrioritizeTasksTool(aiService);
  const clarifyTask = createClarifyTaskTool(aiService);
  const checklist = createChecklistTool(aiService);

  // 注册工具并添加标签
  globalToolRegistry.register(decomposeTask, ['planning', 'decomposition', 'core']);
  globalToolRegistry.register(estimateTime, ['planning', 'estimation', 'core']);
  globalToolRegistry.register(prioritizeTasks, ['planning', 'prioritization', 'core']);
  globalToolRegistry.register(clarifyTask, ['communication', 'clarification', 'core']);
  globalToolRegistry.register(checklist, ['execution', 'validation', 'core']);

  console.log('✅ 所有工具已初始化并注册');
  console.log('📊 注册中心统计:', globalToolRegistry.getRegistryStats());
}

/**
 * 获取所有核心工具
 * @returns 核心工具列表
 */
export function getCoreTools() {
  return globalToolRegistry.query({ tags: ['core'], enabled: true });
}

/**
 * 获取计划相关工具
 * @returns 计划工具列表
 */
export function getPlanningTools() {
  return globalToolRegistry.query({ tags: ['planning'], enabled: true });
}

/**
 * 获取执行相关工具
 * @returns 执行工具列表
 */
export function getExecutionTools() {
  return globalToolRegistry.query({ tags: ['execution'], enabled: true });
}

/**
 * 获取沟通相关工具
 * @returns 沟通工具列表
 */
export function getCommunicationTools() {
  return globalToolRegistry.query({ tags: ['communication'], enabled: true });
}

