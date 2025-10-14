/**
 * 工作流系统初始化
 * 用于创建和配置真实的工作流实例
 */

import { AIService } from '@/lib/ai/service';
import { createDoubaoAdapter } from '@/lib/ai/doubao';
import { initializeTools, globalToolRegistry } from '@/lib/tools';
import { createWorkflowOrchestrator } from '@/lib/workflow';
import type { WorkflowOrchestrator } from '@/lib/workflow/orchestrator';

let workflowInstance: WorkflowOrchestrator | null = null;

/**
 * 初始化真实的工作流系统
 * @returns 工作流编排器实例
 */
export function initializeWorkflow(): WorkflowOrchestrator {
  // 如果已经初始化过,直接返回
  if (workflowInstance) {
    return workflowInstance;
  }

  console.log('🔧 初始化 AI 工作流系统...');

  // 1. 创建 AI 服务
  const aiService = new AIService({
    defaultModel: 'primary',
    fallbackModel: undefined,
    cacheEnabled: true,
    cacheTTL: 5 * 60 * 1000, // 5分钟
  });

  // 2. 获取 API 配置
  const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY || '';
  const baseURL = process.env.NEXT_PUBLIC_DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

  if (!apiKey) {
    console.warn('⚠️ 未配置 DOUBAO_API_KEY,将使用 Mock 模式');
  } else {
    console.log('✅ 豆包 API 配置已加载');
  }

  // 3. 创建并注册豆包适配器
  const doubaoAdapter = createDoubaoAdapter({
    modelName: 'doubao-pro-32k',
    apiKey,
    baseURL,
  });

  aiService.registerAdapter('primary', doubaoAdapter);
  console.log('✅ 豆包适配器已注册');

  // 4. 初始化所有工具
  initializeTools(aiService);
  console.log('✅ 所有工具已初始化');

  // 5. 创建工作流编排器
  workflowInstance = createWorkflowOrchestrator(
    globalToolRegistry,
    aiService,
    {
      autoTransition: true,
      enableCaching: true,
      timeout: 60000, // 60秒
    }
  );

  console.log('🎉 工作流系统初始化完成!');

  return workflowInstance;
}

/**
 * 获取工作流实例
 * @returns 工作流编排器实例,如果未初始化则返回 null
 */
export function getWorkflowInstance(): WorkflowOrchestrator | null {
  return workflowInstance;
}

/**
 * 重置工作流系统
 */
export function resetWorkflow(): void {
  if (workflowInstance) {
    workflowInstance.reset();
  }
  workflowInstance = null;
  console.log('🔄 工作流系统已重置');
}

/**
 * 检查是否已配置 API 密钥
 */
export function hasApiKey(): boolean {
  return !!(process.env.NEXT_PUBLIC_DOUBAO_API_KEY);
}

