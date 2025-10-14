/**
 * 检查清单工具
 * 为任务生成执行检查清单
 */

import { AITool, createToolConfig } from './base';
import type { AIService } from '@/lib/ai/service';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ChecklistInput,
  ChecklistOutput,
} from '@/types/workflow/tool';
import { z } from 'zod';

/**
 * 检查项 Schema
 */
const ChecklistItemSchema = z.object({
  item: z.string().describe('检查项内容'),
  category: z.enum(['preparation', 'execution', 'validation', 'completion']).describe('检查项类别'),
  mandatory: z.boolean().describe('是否必须'),
  description: z.string().optional().describe('详细说明'),
  tips: z.array(z.string()).optional().describe('提示和建议'),
});

/**
 * 检查清单结果 Schema
 */
const ChecklistResultSchema = z.object({
  items: z.array(ChecklistItemSchema).describe('检查项列表'),
  overallGuidance: z.string().describe('整体指导'),
  commonPitfalls: z.array(z.string()).describe('常见陷阱'),
  successCriteria: z.array(z.string()).describe('成功标准'),
});

/**
 * 检查清单工具
 */
export class ChecklistTool extends AITool<ChecklistInput, ChecklistOutput> {
  constructor(aiService: AIService) {
    super(
      createToolConfig(
        'checklist',
        '检查清单',
        '为任务生成详细的执行检查清单',
        {
          priority: 6,
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
  protected async validate(input: ChecklistInput, context: ToolExecutionContext): Promise<string | undefined> {
    if (!input.taskTitle || input.taskTitle.trim().length === 0) {
      return '任务标题不能为空';
    }

    return undefined;
  }

  /**
   * 执行检查清单生成
   */
  protected async executeInternal(
    input: ChecklistInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<ChecklistOutput>> {
    try {
      // 构建 Prompt
      const prompt = this.buildPrompt(input);

      // 调用 AI 服务生成结构化输出
      const result = await this.aiService.generateObject(
        prompt,
        ChecklistResultSchema,
        {
          modelName: context.modelConfig?.modelName || 'doubao-seed-1-6-vision-250815',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
        }
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || '检查清单生成失败',
          executionTime: 0,
          toolType: 'checklist',
        };
      }

      // 转换为输出格式
      const output: ChecklistOutput = {
        items: result.data.items.map((item, index) => ({
          id: `checklist-${Date.now()}-${index}`,
          item: item.item,
          category: item.category,
          mandatory: item.mandatory,
          description: item.description,
          tips: item.tips || [],
          checked: false,
        })),
        overallGuidance: result.data.overallGuidance,
        commonPitfalls: result.data.commonPitfalls,
        successCriteria: result.data.successCriteria,
      };

      return {
        success: true,
        data: output,
        executionTime: 0,
        toolType: 'checklist',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        toolType: 'checklist',
      };
    }
  }

  /**
   * 构建检查清单 Prompt
   */
  private buildPrompt(input: ChecklistInput): string {
    let prompt = `请为以下任务生成详细的执行检查清单:

**任务标题**: ${input.taskTitle}`;

    if (input.taskDescription) {
      prompt += `\n**任务描述**: ${input.taskDescription}`;
    }

    if (input.subtasks && input.subtasks.length > 0) {
      prompt += `\n\n**子任务列表**:\n${input.subtasks.map((st, i) => `${i + 1}. ${st}`).join('\n')}`;
    }

    if (input.phase) {
      prompt += `\n\n**当前阶段**: ${input.phase}`;
    }

    prompt += `

**检查清单要求**:
1. 生成 8-15 个检查项,覆盖任务执行的各个阶段:
   - preparation: 准备阶段(开始之前需要做什么)
   - execution: 执行阶段(执行过程中需要注意什么)
   - validation: 验证阶段(如何验证完成质量)
   - completion: 完成阶段(收尾工作)

2. 标注每个检查项是否必须(mandatory)

3. 对重要的检查项提供详细说明和提示

4. 列出常见的陷阱和需要避免的错误

5. 明确任务成功的标准

6. 提供整体的执行指导

请生成实用、具体、可操作的检查清单,帮助用户高质量地完成任务。`;

    return prompt;
  }
}

/**
 * 创建检查清单工具实例
 */
export function createChecklistTool(aiService: AIService): ChecklistTool {
  return new ChecklistTool(aiService);
}

