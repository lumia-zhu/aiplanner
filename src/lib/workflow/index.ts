/**
 * 工作流模块统一导出
 */

// 导出上下文管理器
export { WorkflowContextManager } from './context';

// 导出步骤定义
export {
  workflowSteps,
  getStep,
  getAllSteps,
  getStepByPhase,
  analyzeTaskComplexity,
  clarifyTasks,
  decomposeTasks,
  estimateTime,
  prioritizeTasks,
  generateChecklist,
} from './steps';
export type { StepExecutionResult, StepExecutor } from './steps';

// 导出编排器
export { WorkflowOrchestrator } from './orchestrator';
export type { WorkflowExecutionOptions, WorkflowExecutionResult } from './orchestrator';

// 导出工厂函数
import { WorkflowOrchestrator } from './orchestrator';
import type { ToolRegistry } from '@/lib/tools/registry';
import type { AIService } from '@/lib/ai/service';
import type { WorkflowConfig } from '@/types/workflow';

/**
 * 创建工作流编排器实例
 * @param toolRegistry - 工具注册中心
 * @param aiService - AI 服务
 * @param config - 工作流配置(可选)
 * @returns 工作流编排器实例
 */
export function createWorkflowOrchestrator(
  toolRegistry: ToolRegistry,
  aiService: AIService,
  config?: Partial<WorkflowConfig>
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(toolRegistry, aiService, config);
}

/**
 * 默认工作流配置
 */
export const DEFAULT_WORKFLOW_CONFIG: Partial<WorkflowConfig> = {
  startPhase: 'initial',
  endPhase: 'completed',
  autoTransition: true,
  enableCaching: true,
  timeout: 60000, // 60 秒
};

