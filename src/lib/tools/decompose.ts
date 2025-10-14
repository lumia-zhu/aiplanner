/**
 * 任务拆解工具
 * 将复杂任务拆解为多个子任务
 */

import { AITool, createToolConfig } from './base';
import type { AIService } from '@/lib/ai/service';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  DecomposeTaskInput,
  DecomposeTaskOutput,
} from '@/types/workflow/tool';
import { z } from 'zod';

/**
 * 子任务 Schema
 */
const SubtaskSchema = z.object({
  title: z.string().describe('子任务标题'),
  description: z.string().optional().describe('子任务描述(可选)'),
  estimatedMinutes: z.number().min(1).describe('预估时长(分钟)'),
  priority: z.enum(['high', 'medium', 'low']).describe('优先级'),
  dependencies: z.array(z.number()).optional().describe('依赖的子任务索引'),
});

/**
 * 拆解结果 Schema
 */
const DecomposeResultSchema = z.object({
  reasoning: z.string().describe('拆解思路'),
  subtasks: z.array(SubtaskSchema).describe('子任务列表'),
  totalEstimatedMinutes: z.number().min(0).describe('总预估时长(分钟)'),
  complexity: z.enum(['simple', 'medium', 'complex']).describe('任务复杂度'),
});

/**
 * 任务拆解工具
 */
export class DecomposeTaskTool extends AITool<DecomposeTaskInput, DecomposeTaskOutput> {
  constructor(aiService: AIService) {
    super(
      createToolConfig(
        'decompose',
        '任务拆解',
        '将复杂任务拆解为多个可执行的子任务',
        {
          priority: 10,
          retryOnFailure: true,
          maxRetries: 2,
          timeout: 30000, // 30 秒
        }
      ),
      aiService
    );
  }

  /**
   * 验证输入
   */
  protected async validate(input: DecomposeTaskInput, context: ToolExecutionContext): Promise<string | undefined> {
    if (!input.taskTitle || input.taskTitle.trim().length === 0) {
      return '任务标题不能为空';
    }

    if (input.taskTitle.length > 500) {
      return '任务标题过长(最多500字符)';
    }

    return undefined;
  }

  /**
   * 执行任务拆解
   */
  protected async executeInternal(
    input: DecomposeTaskInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<DecomposeTaskOutput>> {
    try {
      // 构建 Prompt
      const prompt = this.buildPrompt(input);

      // 调用 AI 服务生成结构化输出
      const result = await this.aiService.generateObject({
        model: context.modelConfig?.modelName || 'primary',
        messages: [{ role: 'user', content: prompt }],
        schema: DecomposeResultSchema,
        temperature: 0.7,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || '任务拆解失败',
          executionTime: 0,
          toolType: 'decompose',
        };
      }

      // 转换为输出格式
      const output: DecomposeTaskOutput = {
        subtasks: result.data.subtasks.map((subtask, index) => ({
          id: `subtask-${Date.now()}-${index}`,
          title: subtask.title,
          description: subtask.description,
          estimatedMinutes: subtask.estimatedMinutes,
          priority: subtask.priority,
          dependencies: subtask.dependencies || [],
          order: index,
        })),
        reasoning: result.data.reasoning,
        totalEstimatedMinutes: result.data.totalEstimatedMinutes,
        complexity: result.data.complexity,
      };

      return {
        success: true,
        data: output,
        executionTime: 0,
        toolType: 'decompose',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        toolType: 'decompose',
      };
    }
  }

  /**
   * 构建拆解 Prompt
   */
  private buildPrompt(input: DecomposeTaskInput): string {
    let prompt = `请将以下任务拆解为多个可执行的子任务:

**任务标题**: ${input.taskTitle}`;

    if (input.taskDescription) {
      prompt += `\n**任务描述**: ${input.taskDescription}`;
    }

    if (input.currentSubtasks && input.currentSubtasks.length > 0) {
      prompt += `\n\n**已有子任务**:\n${input.currentSubtasks.map((st, i) => `${i + 1}. ${st}`).join('\n')}`;
    }

    if (input.userContext) {
      prompt += `\n\n**用户上下文**: ${input.userContext}`;
    }

    prompt += `

**拆解要求**:
1. 子任务应该具体、可执行、可衡量
2. 每个子任务的时长应该在 15-120 分钟之间
3. 合理安排子任务的优先级和依赖关系
4. 如果任务较简单,拆解为 2-3 个子任务即可
5. 如果任务复杂,最多拆解为 8-10 个子任务
6. 子任务之间应该有清晰的逻辑关系和执行顺序

请给出你的拆解方案。`;

    return prompt;
  }
}

/**
 * 创建任务拆解工具实例
 */
export function createDecomposeTaskTool(aiService: AIService): DecomposeTaskTool {
  return new DecomposeTaskTool(aiService);
}

