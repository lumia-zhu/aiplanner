/**
 * 任务澄清工具
 * 生成澄清问题帮助用户明确任务需求
 */

import { AITool, createToolConfig } from './base';
import type { AIService } from '@/lib/ai/service';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ClarifyTaskInput,
  ClarifyTaskOutput,
} from '@/types/workflow/tool';
import { z } from 'zod';

/**
 * 澄清问题 Schema
 */
const ClarificationQuestionSchema = z.object({
  question: z.string().describe('澄清问题'),
  category: z.enum(['goal', 'scope', 'resource', 'constraint', 'quality', 'other']).describe('问题类别'),
  importance: z.enum(['critical', 'important', 'nice-to-have']).describe('问题重要性'),
  reasoning: z.string().describe('为什么需要澄清这个问题'),
  suggestedAnswers: z.array(z.string()).optional().describe('建议的答案选项'),
});

/**
 * 任务澄清结果 Schema
 */
const ClarifyResultSchema = z.object({
  questions: z.array(ClarificationQuestionSchema).describe('澄清问题列表'),
  ambiguities: z.array(z.string()).describe('发现的模糊点'),
  recommendations: z.array(z.string()).describe('改进建议'),
  summary: z.string().describe('总结'),
});

/**
 * 任务澄清工具
 */
export class ClarifyTaskTool extends AITool<ClarifyTaskInput, ClarifyTaskOutput> {
  constructor(aiService: AIService) {
    super(
      createToolConfig(
        'clarify',
        '任务澄清',
        '生成澄清问题帮助用户明确任务需求',
        {
          priority: 7,
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
  protected async validate(input: ClarifyTaskInput, context: ToolExecutionContext): Promise<string | undefined> {
    if (!input.taskTitle || input.taskTitle.trim().length === 0) {
      return '任务标题不能为空';
    }

    return undefined;
  }

  /**
   * 执行任务澄清
   */
  protected async executeInternal(
    input: ClarifyTaskInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<ClarifyTaskOutput>> {
    try {
      // 构建 Prompt
      const prompt = this.buildPrompt(input);

      // 将 Zod Schema 转为 JSON Schema（手写以确保与豆包兼容）
      const jsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        additionalProperties: false,
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                question: { type: 'string' },
                category: { type: 'string', enum: ['goal','scope','resource','constraint','quality','other'] },
                importance: { type: 'string', enum: ['critical','important','nice-to-have'] },
                reasoning: { type: 'string' },
                suggestedAnswers: { type: 'array', items: { type: 'string' } }
              },
              required: ['question','category','importance','reasoning']
            }
          },
          ambiguities: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        },
        required: ['questions','ambiguities','recommendations','summary']
      }

      // 调用 AI 服务生成结构化输出（json_schema 模式）
      const result = await this.aiService.generateObject(
        prompt,
        jsonSchema,
        {
          modelName: context.modelConfig?.modelName || 'doubao-seed-1-6-vision-250815',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }
      );

      // 调试：打印豆包返回的结果
      console.log('🔍 豆包返回的澄清结果:', JSON.stringify(result, null, 2));

      // 检查返回结果的结构
      if (!result || !result.questions) {
        console.error('❌ 豆包返回的结果格式不正确:', result);
        return {
          success: false,
          error: `豆包返回格式错误: ${JSON.stringify(result)}`,
          executionTime: 0,
          toolType: 'clarify',
        };
      }

      // 转换为输出格式
      const output: ClarifyTaskOutput = {
        questions: result.questions.map((q: any, index: number) => ({
          id: `question-${Date.now()}-${index}`,
          question: q.question,
          category: q.category,
          importance: q.importance,
          reasoning: q.reasoning,
          suggestedAnswers: q.suggestedAnswers || [],
        })),
        ambiguities: result.ambiguities,
        recommendations: result.recommendations,
        summary: result.summary,
      };

      return {
        success: true,
        data: output,
        executionTime: 0,
        toolType: 'clarify',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        toolType: 'clarify',
      };
    }
  }

  /**
   * 构建澄清 Prompt
   */
  private buildPrompt(input: ClarifyTaskInput): string {
    let prompt = `请分析以下任务,生成澄清问题帮助用户明确需求:

**任务标题**: ${input.taskTitle}`;

    if (input.taskDescription) {
      prompt += `\n**任务描述**: ${input.taskDescription}`;
    }

    if (input.existingAnswers && Object.keys(input.existingAnswers).length > 0) {
      prompt += `\n\n**已有信息**:\n${Object.entries(input.existingAnswers)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n')}`;
    }

    if (input.userContext) {
      prompt += `\n\n**用户上下文**: ${input.userContext}`;
    }

    prompt += `

**澄清要求**:
1. 识别任务描述中的模糊点和不明确的地方
2. 生成 3-8 个澄清问题,涵盖以下类别:
   - goal: 任务目标和期望结果
   - scope: 任务范围和边界
   - resource: 所需资源和工具
   - constraint: 时间、预算等约束条件
   - quality: 质量标准和验收标准
   - other: 其他需要澄清的方面

3. 标注每个问题的重要性:
   - critical: 必须澄清,影响任务的可执行性
   - important: 应该澄清,影响任务的质量
   - nice-to-have: 可以澄清,有助于更好地完成任务

4. 解释为什么需要澄清这个问题
5. 如果可能,提供建议的答案选项
6. 给出改进任务描述的建议

请生成有针对性的澄清问题,帮助用户更好地定义任务。`;

    return prompt;
  }
}

/**
 * 创建任务澄清工具实例
 */
export function createClarifyTaskTool(aiService: AIService): ClarifyTaskTool {
  return new ClarifyTaskTool(aiService);
}



