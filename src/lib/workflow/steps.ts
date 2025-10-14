/**
 * 工作流步骤定义
 * 定义工作流中的每个步骤及其执行逻辑
 */

import type { WorkflowStep, WorkflowPhase, TaskComplexity } from '@/types/workflow';
import type { ToolType } from '@/types/workflow/tool';
import type { WorkflowContextManager } from './context';
import type { ToolRegistry } from '@/lib/tools/registry';
import type { AIService } from '@/lib/ai/service';

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
  success: boolean;
  nextPhase?: WorkflowPhase;
  data?: any;
  error?: string;
}

/**
 * 步骤执行器接口
 */
export type StepExecutor = (
  context: WorkflowContextManager,
  toolRegistry: ToolRegistry,
  aiService: AIService,
  input?: any
) => Promise<StepExecutionResult>;

/**
 * 步骤 1: 分析任务复杂度
 */
export const analyzeTaskComplexity: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('📊 开始分析任务复杂度...');

  try {
    const tasks = context.getTasks();
    if (tasks.length === 0) {
      return {
        success: false,
        error: '没有任务需要分析',
      };
    }

    // 使用 AI 分析任务复杂度
    const prompt = `请分析以下任务的复杂度:

任务列表:
${tasks.map((t, i) => `${i + 1}. ${t.title}${t.description ? `\n   描述: ${t.description}` : ''}`).join('\n')}

请评估:
1. 整体复杂度(simple/medium/complex)
2. 是否需要拆解
3. 是否需要澄清`;

    const result = await aiService.generateText({
      model: 'primary',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: '分析失败',
      };
    }

    // 简单解析结果
    const text = result.data.toLowerCase();
    let complexity: TaskComplexity = 'medium';
    if (text.includes('simple') || text.includes('简单')) {
      complexity = 'simple';
    } else if (text.includes('complex') || text.includes('复杂')) {
      complexity = 'complex';
    }

    const needsDecomposition = text.includes('拆解') || text.includes('decompose');
    const needsClarification = text.includes('澄清') || text.includes('clarify');

    // 保存分析结果
    context.setAnalysis({
      complexity,
      needsDecomposition,
      needsClarification,
      estimatedTotalMinutes: 0,
      reasoning: result.data,
    });

    console.log(`✅ 任务复杂度: ${complexity}`);

    // 根据复杂度决定下一阶段
    if (needsClarification) {
      return { success: true, nextPhase: 'clarifying' };
    } else if (needsDecomposition) {
      return { success: true, nextPhase: 'decomposing' };
    } else {
      return { success: true, nextPhase: 'estimating' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤 2: 任务澄清
 */
export const clarifyTasks: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('❓ 开始任务澄清...');

  try {
    const tasks = context.getTasks();
    const clarifyTool = toolRegistry.getTool('clarify' as ToolType);

    if (!clarifyTool) {
      return { success: false, error: '澄清工具未找到' };
    }

    // 为第一个任务生成澄清问题
    const task = tasks[0];
    const result = await clarifyTool.execute(
      {
        taskTitle: task.title,
        taskDescription: task.description,
      },
      {
        userId: context.getContext().userId,
        sessionId: context.getContext().sessionId,
        timestamp: Date.now(),
      }
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || '澄清失败' };
    }

    // 生成建议芯片
    const chips = result.data.questions.slice(0, 3).map((q: any) => ({
      id: `chip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: q.question,
      action: 'clarify',
      category: q.category,
      metadata: { questionId: q.id },
    }));

    context.addSuggestions(chips);

    console.log(`✅ 生成了 ${chips.length} 个澄清问题`);

    return {
      success: true,
      nextPhase: 'decomposing',
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤 3: 任务拆解
 */
export const decomposeTasks: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('🔨 开始任务拆解...');

  try {
    const tasks = context.getTasks();
    const decomposeTool = toolRegistry.getTool('decompose' as ToolType);

    if (!decomposeTool) {
      return { success: false, error: '拆解工具未找到' };
    }

    // 拆解第一个任务
    const task = tasks[0];
    const result = await decomposeTool.execute(
      {
        taskTitle: task.title,
        taskDescription: task.description,
      },
      {
        userId: context.getContext().userId,
        sessionId: context.getContext().sessionId,
        timestamp: Date.now(),
      }
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || '拆解失败' };
    }

    // 生成建议芯片
    const chips = result.data.subtasks.slice(0, 4).map((st: any) => ({
      id: `chip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `子任务: ${st.title}`,
      action: 'add_subtask',
      metadata: { subtask: st },
    }));

    context.addSuggestions(chips);

    console.log(`✅ 拆解出 ${result.data.subtasks.length} 个子任务`);

    return {
      success: true,
      nextPhase: 'estimating',
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤 4: 时间估算
 */
export const estimateTime: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('⏱️ 开始时间估算...');

  try {
    const tasks = context.getTasks();
    const estimateTool = toolRegistry.getTool('estimate' as ToolType);

    if (!estimateTool) {
      return { success: false, error: '估算工具未找到' };
    }

    // 估算第一个任务
    const task = tasks[0];
    const result = await estimateTool.execute(
      {
        taskTitle: task.title,
        taskDescription: task.description,
      },
      {
        userId: context.getContext().userId,
        sessionId: context.getContext().sessionId,
        timestamp: Date.now(),
      }
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || '估算失败' };
    }

    // 更新分析结果
    const analysis = context.getAnalysis();
    if (analysis) {
      context.setAnalysis({
        ...analysis,
        estimatedTotalMinutes: result.data.estimatedMinutes,
      });
    }

    // 生成建议芯片
    const chip = {
      id: `chip-${Date.now()}`,
      text: `预计耗时: ${result.data.estimatedMinutes} 分钟`,
      action: 'update_time',
      metadata: { estimate: result.data },
    };

    context.addSuggestion(chip);

    console.log(`✅ 估算完成: ${result.data.estimatedMinutes} 分钟`);

    return {
      success: true,
      nextPhase: 'prioritizing',
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤 5: 优先级排序
 */
export const prioritizeTasks: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('🎯 开始优先级排序...');

  try {
    const tasks = context.getTasks();
    const prioritizeTool = toolRegistry.getTool('prioritize' as ToolType);

    if (!prioritizeTool) {
      return { success: false, error: '排序工具未找到' };
    }

    // 排序所有任务
    const result = await prioritizeTool.execute(
      {
        tasks: tasks.map((t) => ({
          id: t.id || `task-${Date.now()}`,
          title: t.title,
          description: t.description,
        })),
      },
      {
        userId: context.getContext().userId,
        sessionId: context.getContext().sessionId,
        timestamp: Date.now(),
      }
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || '排序失败' };
    }

    // 生成建议芯片
    const chips = result.data.prioritizedTasks.slice(0, 3).map((pt: any) => ({
      id: `chip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `优先级: ${pt.priority}`,
      action: 'set_priority',
      metadata: { taskId: pt.taskId, priority: pt.priority },
    }));

    context.addSuggestions(chips);

    console.log(`✅ 排序完成`);

    return {
      success: true,
      nextPhase: 'checking',
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 步骤 6: 生成检查清单
 */
export const generateChecklist: StepExecutor = async (context, toolRegistry, aiService, input) => {
  console.log('✅ 开始生成检查清单...');

  try {
    const tasks = context.getTasks();
    const checklistTool = toolRegistry.getTool('checklist' as ToolType);

    if (!checklistTool) {
      return { success: false, error: '检查清单工具未找到' };
    }

    // 为第一个任务生成检查清单
    const task = tasks[0];
    const result = await checklistTool.execute(
      {
        taskTitle: task.title,
        taskDescription: task.description,
      },
      {
        userId: context.getContext().userId,
        sessionId: context.getContext().sessionId,
        timestamp: Date.now(),
      }
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || '生成检查清单失败' };
    }

    // 生成建议芯片
    const chips = result.data.items.slice(0, 3).map((item: any) => ({
      id: `chip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: item.item,
      action: 'add_checklist',
      metadata: { checklistItem: item },
    }));

    context.addSuggestions(chips);

    console.log(`✅ 生成了 ${result.data.items.length} 个检查项`);

    return {
      success: true,
      nextPhase: 'completed',
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 工作流步骤注册表
 */
export const workflowSteps: Map<string, WorkflowStep> = new Map([
  [
    'analyze',
    {
      id: 'analyze',
      name: '分析任务',
      phase: 'analyzing',
      order: 1,
      execute: analyzeTaskComplexity,
      requiredTools: [],
      description: '分析任务复杂度和需求',
    },
  ],
  [
    'clarify',
    {
      id: 'clarify',
      name: '澄清任务',
      phase: 'clarifying',
      order: 2,
      execute: clarifyTasks,
      requiredTools: ['clarify' as ToolType],
      description: '生成澄清问题',
    },
  ],
  [
    'decompose',
    {
      id: 'decompose',
      name: '拆解任务',
      phase: 'decomposing',
      order: 3,
      execute: decomposeTasks,
      requiredTools: ['decompose' as ToolType],
      description: '将任务拆解为子任务',
    },
  ],
  [
    'estimate',
    {
      id: 'estimate',
      name: '估算时间',
      phase: 'estimating',
      order: 4,
      execute: estimateTime,
      requiredTools: ['estimate' as ToolType],
      description: '估算任务所需时间',
    },
  ],
  [
    'prioritize',
    {
      id: 'prioritize',
      name: '排序优先级',
      phase: 'prioritizing',
      order: 5,
      execute: prioritizeTasks,
      requiredTools: ['prioritize' as ToolType],
      description: '为任务排序优先级',
    },
  ],
  [
    'checklist',
    {
      id: 'checklist',
      name: '生成检查清单',
      phase: 'checking',
      order: 6,
      execute: generateChecklist,
      requiredTools: ['checklist' as ToolType],
      description: '生成执行检查清单',
    },
  ],
]);

/**
 * 获取步骤
 * @param stepId - 步骤 ID
 */
export function getStep(stepId: string): WorkflowStep | undefined {
  return workflowSteps.get(stepId);
}

/**
 * 获取所有步骤
 */
export function getAllSteps(): WorkflowStep[] {
  return Array.from(workflowSteps.values()).sort((a, b) => a.order - b.order);
}

/**
 * 根据阶段获取步骤
 * @param phase - 工作流阶段
 */
export function getStepByPhase(phase: WorkflowPhase): WorkflowStep | undefined {
  return Array.from(workflowSteps.values()).find((step) => step.phase === phase);
}

