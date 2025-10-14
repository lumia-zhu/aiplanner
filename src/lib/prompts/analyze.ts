/**
 * 任务分析 Prompts
 * 
 * 用于分析任务复杂度并生成建议
 */

import { BasePromptTemplate, promptManager } from './index'

/**
 * 任务分析 Prompt - 版本 1
 */
export const ANALYZE_TASKS_V1 = new BasePromptTemplate(
  'analyze-tasks',
  'v1',
  `你是一个专业的任务分析专家。请分析以下任务，评估它们的复杂度，并提供建议。

任务列表：
{{taskList}}

分析要求：
1. **complexity**：评估任务复杂度
   - simple: 简单直接，可以立即执行（如"发邮件"、"打电话"）
   - medium: 需要一定计划，但不需要拆解（如"写报告"、"准备会议"）
   - complex: 复杂模糊，建议拆解为子任务（如"完成项目"、"准备演讲"）

2. **insights**：提供 1-2 条分析见解（简短有用的建议）

3. **suggestedTools**：建议使用的工具（可多选）：
   - decompose: 任务模糊或复杂，建议拆解
   - estimate_time: 需要时间规划
   - prioritize: 任务较多（3个以上），建议排序
   - clarify: 任务描述不清晰，需要澄清
   - add_checklist: 适合添加检查清单

4. **confidence**：你对这个分析的信心度（0-1 的小数）

请用中文分析，返回严格的 JSON 格式（不要添加任何额外文字）。`,
  '任务分析 Prompt - 基础版本'
)

/**
 * 任务分析 Prompt - 版本 2（更详细）
 */
export const ANALYZE_TASKS_V2 = new BasePromptTemplate(
  'analyze-tasks',
  'v2',
  `你是一位有 10 年经验的项目经理，擅长任务分析和规划。

请分析以下任务：
{{taskList}}

分析维度：
1. **复杂度评估**：
   - simple（简单）: 单步操作，5分钟内完成，如"发邮件"
   - medium（中等）: 需要计划，30分钟-2小时，如"写周报"
   - complex（复杂）: 多步骤，需要拆解，如"完成论文"

2. **见解提供**：
   - 找出任务的关键难点
   - 提供具体可行的建议
   - 每个任务 1-2 条，简洁有力

3. **工具推荐**：
   根据任务特点推荐合适的工具：
   - 模糊任务 → decompose（拆解）
   - 耗时任务 → estimate_time（估时）
   - 多个任务 → prioritize（排序）
   - 描述不清 → clarify（澄清）
   - 有步骤 → add_checklist（清单）

4. **信心度**：对分析的确定程度（0-1）

返回 JSON，不要任何其他文字。`,
  '任务分析 Prompt - 详细版本'
)

// 注册 Prompts
promptManager.register(ANALYZE_TASKS_V1)
promptManager.register(ANALYZE_TASKS_V2)

// 默认使用 v1 版本
promptManager.setActiveVersion('analyze-tasks', 'v1')

