/**
 * 时间估算工具
 * 为任务估算所需时间
 */

import { AITool, createToolConfig } from './base';
import type { AIService } from '@/lib/ai/service';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  EstimateTimeInput,
  EstimateTimeOutput,
} from '@/types/workflow/tool';
import { z } from 'zod';

/**
 * 时间估算结果 Schema
 */
const EstimateResultSchema = z.object({
  estimatedMinutes: z.number().min(1).describe('预估时长(分钟)'),
  minMinutes: z.number().min(1).describe('最短时长(分钟)'),
  maxMinutes: z.number().min(1).describe('最长时长(分钟)'),
  confidence: z.enum(['high', 'medium', 'low']).describe('置信度'),
  reasoning: z.string().describe('估算依据'),
  assumptions: z.array(z.string()).describe('假设条件'),
  risks: z.array(z.string()).optional().describe('时间风险'),
});

/**
 * 时间估算工具
 */
export class EstimateTimeTool extends AITool<EstimateTimeInput, EstimateTimeOutput> {
  constructor(aiService: AIService) {
    super(
      createToolConfig(
        'estimate',
        '时间估算',
        '为任务估算所需的执行时间',
        {
          priority: 8,
          retryOnFailure: true,
          maxRetries: 2,
          timeout: 20000, // 20 秒
        }
      ),
      aiService
    );
  }

  /**
   * 验证输入
   */
  protected async validate(input: EstimateTimeInput, context: ToolExecutionContext): Promise<string | undefined> {
    if (!input.taskTitle || input.taskTitle.trim().length === 0) {
      return '任务标题不能为空';
    }

    return undefined;
  }

  /**
   * 执行时间估算
   */
  protected async executeInternal(
    input: EstimateTimeInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<EstimateTimeOutput>> {
    try {
      // 构建 Prompt
      const prompt = this.buildPrompt(input);

      // Estimate JSON Schema
      const jsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        additionalProperties: false,
        properties: {
          estimatedMinutes: { type: 'number' },
          minMinutes: { type: 'number' },
          maxMinutes: { type: 'number' },
          confidence: { type: 'string' },
          reasoning: { type: 'string' },
          assumptions: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
        },
        required: ['estimatedMinutes','minMinutes','maxMinutes','confidence','reasoning']
      }

      const result = await this.aiService.generateObject(
        prompt,
        jsonSchema,
        {
          modelName: context.modelConfig?.modelName || 'doubao-seed-1-6-vision-250815',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }
      );

      // 转换为输出格式
      const output: EstimateTimeOutput = {
        estimatedMinutes: result.estimatedMinutes,
        minMinutes: result.minMinutes,
        maxMinutes: result.maxMinutes,
        confidence: result.confidence,
        reasoning: result.reasoning,
        assumptions: result.assumptions,
        risks: result.risks || [],
      };

      return {
        success: true,
        data: output,
        executionTime: 0,
        toolType: 'estimate',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        toolType: 'estimate',
      };
    }
  }

  /**
   * 构建估算 Prompt
   */
  private buildPrompt(input: EstimateTimeInput): string {
    let prompt = `请为以下任务估算所需的执行时间:

**任务标题**: ${input.taskTitle}`;

    if (input.taskDescription) {
      prompt += `\n**任务描述**: ${input.taskDescription}`;
    }

    if (input.subtasks && input.subtasks.length > 0) {
      prompt += `\n\n**子任务列表**:\n${input.subtasks.map((st, i) => `${i + 1}. ${st}`).join('\n')}`;
    }

    if (input.complexity) {
      prompt += `\n\n**任务复杂度**: ${input.complexity}`;
    }

    if (input.userSkillLevel) {
      prompt += `\n**用户技能水平**: ${input.userSkillLevel}`;
    }

    prompt += `

**估算要求**:
1. 给出最可能的时间估算(estimatedMinutes)
2. 给出最乐观情况下的时间(minMinutes)
3. 给出最悲观情况下的时间(maxMinutes)
4. 说明估算的置信度(高/中/低)
5. 解释估算依据和假设条件
6. 指出可能导致时间延长的风险因素

请基于任务的复杂度、工作量、技能要求等因素给出合理的时间估算。`;

    return prompt;
  }
}

/**
 * 创建时间估算工具实例
 */
export function createEstimateTimeTool(aiService: AIService): EstimateTimeTool {
  return new EstimateTimeTool(aiService);
}

