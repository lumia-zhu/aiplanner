/**
 * 优先级排序工具
 * 为任务列表排序并分配优先级
 */

import { AITool, createToolConfig } from './base';
import type { AIService } from '@/lib/ai/service';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  PrioritizeTasksInput,
  PrioritizeTasksOutput,
} from '@/types/workflow/tool';
import { z } from 'zod';

/**
 * 任务优先级 Schema
 */
const TaskPrioritySchema = z.object({
  taskId: z.string().describe('任务ID'),
  priority: z.enum(['urgent-important', 'urgent-not-important', 'not-urgent-important', 'not-urgent-not-important']).describe('优先级象限'),
  urgency: z.number().min(0).max(10).describe('紧急程度(0-10)'),
  importance: z.number().min(0).max(10).describe('重要程度(0-10)'),
  reasoning: z.string().describe('优先级判断依据'),
  suggestedOrder: z.number().min(1).describe('建议执行顺序'),
});

/**
 * 优先级排序结果 Schema
 */
const PrioritizeResultSchema = z.object({
  prioritizedTasks: z.array(TaskPrioritySchema).describe('优先级排序后的任务'),
  overallStrategy: z.string().describe('整体执行策略'),
  keyInsights: z.array(z.string()).describe('关键洞察'),
});

/**
 * 优先级排序工具
 */
export class PrioritizeTasksTool extends AITool<PrioritizeTasksInput, PrioritizeTasksOutput> {
  constructor(aiService: AIService) {
    super(
      createToolConfig(
        'prioritize',
        '优先级排序',
        '根据紧急度和重要性为任务列表排序',
        {
          priority: 9,
          retryOnFailure: true,
          maxRetries: 2,
          timeout: 25000, // 25 秒
        }
      ),
      aiService
    );
  }

  /**
   * 验证输入
   */
  protected async validate(input: PrioritizeTasksInput, context: ToolExecutionContext): Promise<string | undefined> {
    if (!input.tasks || input.tasks.length === 0) {
      return '任务列表不能为空';
    }

    if (input.tasks.length > 50) {
      return '任务数量过多(最多50个)';
    }

    return undefined;
  }

  /**
   * 执行优先级排序
   */
  protected async executeInternal(
    input: PrioritizeTasksInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<PrioritizeTasksOutput>> {
    try {
      // 构建 Prompt
      const prompt = this.buildPrompt(input);

      // 调用 AI 服务生成结构化输出
      const result = await this.aiService.generateObject(
        prompt,
        PrioritizeResultSchema,
        {
          modelName: context.modelConfig?.modelName || 'doubao-seed-1-6-vision-250815',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        }
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || '优先级排序失败',
          executionTime: 0,
          toolType: 'prioritize',
        };
      }

      // 转换为输出格式
      const output: PrioritizeTasksOutput = {
        prioritizedTasks: result.data.prioritizedTasks.map((task) => ({
          taskId: task.taskId,
          priority: task.priority,
          urgency: task.urgency,
          importance: task.importance,
          reasoning: task.reasoning,
          suggestedOrder: task.suggestedOrder,
        })),
        overallStrategy: result.data.overallStrategy,
        keyInsights: result.data.keyInsights,
      };

      return {
        success: true,
        data: output,
        executionTime: 0,
        toolType: 'prioritize',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        toolType: 'prioritize',
      };
    }
  }

  /**
   * 构建排序 Prompt
   */
  private buildPrompt(input: PrioritizeTasksInput): string {
    let prompt = `请为以下任务列表进行优先级排序:

**任务列表**:
${input.tasks.map((task, i) => `${i + 1}. [${task.id}] ${task.title}${task.description ? `\n   描述: ${task.description}` : ''}`).join('\n')}`;

    if (input.currentDate) {
      prompt += `\n\n**当前日期**: ${input.currentDate}`;
    }

    if (input.userGoals && input.userGoals.length > 0) {
      prompt += `\n\n**用户目标**:\n${input.userGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`;
    }

    if (input.constraints && input.constraints.length > 0) {
      prompt += `\n\n**约束条件**:\n${input.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
    }

    prompt += `

**排序要求**:
1. 使用艾森豪威尔矩阵(四象限法)对任务分类:
   - urgent-important: 紧急且重要(第一象限)
   - urgent-not-important: 紧急但不重要(第二象限)
   - not-urgent-important: 不紧急但重要(第三象限)
   - not-urgent-not-important: 不紧急也不重要(第四象限)

2. 为每个任务评估紧急程度(0-10)和重要程度(0-10)

3. 给出建议的执行顺序(1表示最先执行)

4. 解释每个任务的优先级判断依据

5. 提供整体的执行策略建议

请基于任务的紧急性、重要性、依赖关系等因素给出合理的优先级排序。`;

    return prompt;
  }
}

/**
 * 创建优先级排序工具实例
 */
export function createPrioritizeTasksTool(aiService: AIService): PrioritizeTasksTool {
  return new PrioritizeTasksTool(aiService);
}

