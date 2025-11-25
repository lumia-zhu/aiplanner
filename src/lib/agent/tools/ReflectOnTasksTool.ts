/**
 * ReflectOnTasksTool - 元认知反思工具
 * 
 * 功能：生成元认知反思问题，帮助用户更清晰地思考任务
 * 
 * 理论基础：
 * - Flavell 的元认知理论：激活用户对任务/策略/自我的认识
 * - Nelson & Narens 的 meta-level ↔ object-level 模型：在 meta-level 做监控与决策支持
 * 
 * 特点：
 * - 只生成问题，不直接修改任务
 * - 问题由 LLM 动态生成，高度情境化
 * - 用户可以不回答，问题本身就是目的
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { doubaoService } from '@/lib/doubaoService'

// ==================== 类型定义 ====================

/** 触发类型 */
type TriggerType = 'improve' | 'decompose' | 'estimate_time' | 'reprioritize' | 'review'

/** 元认知维度 */
type MetacognitiveDimension = 'clarity' | 'strategy' | 'time_realism' | 'risk' | 'motivation' | 'scope'

/** 任务信息（简化版） */
interface TaskInfo {
  title: string
  priority?: string
  estimatedDuration?: number
  deadline?: string
  isCompleted?: boolean
  description?: string
}

/** 情境上下文 */
interface SituationContext {
  currentDate: string
  isWeekend: boolean
  pendingTaskCount: number
  overdueTaskCount: number
}

/** 工具参数 */
interface ReflectOnTasksParams {
  triggerType: TriggerType
  tasks: TaskInfo[]
  noteSnippet?: string
  userProfileSummary?: string
  situationContext?: SituationContext
}

/** 反思问题 */
interface ReflectionQuestion {
  id: string
  dimension: MetacognitiveDimension
  text: string
  hint?: string
}

// ==================== Prompt 模板 ====================

const TRIGGER_TYPE_DESCRIPTIONS: Record<TriggerType, string> = {
  improve: '用户想完善或明确一个任务的定义',
  decompose: '用户准备将任务拆解为更小的步骤',
  estimate_time: '用户在估计任务需要多长时间',
  reprioritize: '用户在考虑任务的优先级',
  review: '用户在回顾已完成或未完成的任务'
}

const DIMENSION_PRIORITIES: Record<TriggerType, MetacognitiveDimension[]> = {
  improve: ['clarity', 'scope', 'strategy'],
  decompose: ['strategy', 'risk', 'scope'],
  estimate_time: ['time_realism', 'strategy', 'risk'],
  reprioritize: ['motivation', 'risk', 'time_realism'],
  review: ['strategy', 'motivation', 'clarity']
}

function buildReflectionPrompt(params: ReflectOnTasksParams): string {
  const taskList = params.tasks.map(t => {
    const parts = [`「${t.title}」`]
    if (t.priority) parts.push(`优先级: ${t.priority}`)
    if (t.estimatedDuration) parts.push(`预估: ${t.estimatedDuration}分钟`)
    if (t.deadline) parts.push(`截止: ${t.deadline}`)
    if (t.isCompleted) parts.push(`(已完成)`)
    return parts.join(' | ')
  }).join('\n')

  const priorityDimensions = DIMENSION_PRIORITIES[params.triggerType]

  return `你是一个任务管理元认知助手。你的职责是提出高质量的反思问题，帮助用户更清晰地思考他们的任务。

【理论框架】
你基于 Flavell 的元认知理论工作：
- 元认知知识：帮助用户认识任务本身、可用策略、自身特点
- 元认知调节：支持用户进行计划、监控、调节

【当前触发场景】
${params.triggerType} - ${TRIGGER_TYPE_DESCRIPTIONS[params.triggerType]}

【优先关注的元认知维度】
${priorityDimensions.map(d => `- ${d}`).join('\n')}

维度说明：
- clarity: 目标清晰度（任务具体要做什么）
- scope: 范围边界（任务的大小和边界）
- strategy: 策略可行性（如何执行、从哪开始）
- time_realism: 时间现实性（时间估计是否合理）
- risk: 风险感知（可能的障碍和困难）
- motivation: 动机匹配（为什么要做、重要性）

【目标任务】
${taskList}

${params.noteSnippet ? `【相关笔记片段】\n${params.noteSnippet}\n` : ''}
${params.userProfileSummary ? `【用户画像】\n${params.userProfileSummary}\n` : ''}
${params.situationContext ? `【时间情境】\n当前日期: ${params.situationContext.currentDate}\n是否周末: ${params.situationContext.isWeekend ? '是' : '否'}\n待完成任务数: ${params.situationContext.pendingTaskCount}\n逾期任务数: ${params.situationContext.overdueTaskCount}\n` : ''}

【问题生成约束】
1. 生成 3 个问题
2. 问题必须简短、口语化、可一句话回答
3. 问题必须高度情境化，直接提及用户的任务标题「${params.tasks[0]?.title || '任务'}」
4. 禁止空泛的"你有什么感受"类问题
5. 禁止治疗化提问（不问"为什么你总是..."）
6. 每个问题针对不同的元认知维度

【输出格式】
返回 JSON 数组，格式如下：
[
  {
    "dimension": "clarity",
    "text": "问题文本（直接提及任务标题）",
    "hint": "可选的简短提示，帮助用户理解问题"
  }
]

只返回 JSON 数组，不要有其他内容。`
}

// ==================== 工具类 ====================

export class ReflectOnTasksTool implements AgentTool {
  name = 'reflect_on_tasks'
  description = '生成元认知反思问题，帮助用户更清晰地思考任务。这个工具只生成问题，不直接修改任务。适用于用户想完善任务、拆解任务、估计时间、调整优先级或回顾任务时。'

  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      triggerType: {
        type: 'string',
        description: '触发类型：improve(完善任务) | decompose(拆解任务) | estimate_time(估计时间) | reprioritize(调整优先级) | review(回顾任务)'
      },
      tasks: {
        type: 'array',
        description: '目标任务列表，每个任务包含 title(必需)、priority、estimatedDuration、deadline、isCompleted、description'
      },
      noteSnippet: {
        type: 'string',
        description: '相关笔记片段（可选，截断到500字）'
      },
      userProfileSummary: {
        type: 'string',
        description: '用户画像摘要（可选，一句话）'
      },
      situationContext: {
        type: 'object',
        description: '时间情境（可选），包含 currentDate、isWeekend、pendingTaskCount、overdueTaskCount'
      }
    },
    required: ['triggerType', 'tasks']
  }

  async execute(params: ReflectOnTasksParams): Promise<ToolResult> {
    try {
      console.log(`💭 ReflectOnTasksTool: 为 ${params.tasks.length} 个任务生成反思问题...`)
      console.log(`   触发类型: ${params.triggerType}`)
      console.log(`   任务: ${params.tasks.map(t => t.title).join(', ')}`)

      // 验证参数
      if (!params.triggerType || !params.tasks || params.tasks.length === 0) {
        return {
          type: 'error',
          message: '缺少必要参数：triggerType 和 tasks'
        }
      }

      if (!['improve', 'decompose', 'estimate_time', 'reprioritize', 'review'].includes(params.triggerType)) {
        return {
          type: 'error',
          message: `无效的触发类型: ${params.triggerType}`
        }
      }

      // 构建 Prompt
      const prompt = buildReflectionPrompt(params)

      // 调用 LLM 生成问题
      const response = await doubaoService.sendMessage(prompt)

      if (!response.success || !response.message) {
        console.error('❌ LLM 调用失败:', response.error)
        return {
          type: 'error',
          message: response.error || '生成反思问题失败，请稍后再试'
        }
      }

      // 解析 LLM 返回的 JSON
      let questions: ReflectionQuestion[]
      try {
        // 尝试从返回内容中提取 JSON
        const jsonMatch = response.message.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
          throw new Error('未找到 JSON 数组')
        }
        
        const parsed = JSON.parse(jsonMatch[0])
        
        // 验证并格式化问题
        questions = parsed.map((q: any, index: number) => ({
          id: `q_${index + 1}`,
          dimension: q.dimension || 'clarity',
          text: q.text || '',
          hint: q.hint || undefined
        })).filter((q: ReflectionQuestion) => q.text.length > 0)

        if (questions.length === 0) {
          throw new Error('没有有效的问题')
        }

      } catch (parseError: any) {
        console.error('❌ 解析 LLM 返回失败:', parseError)
        console.log('   原始返回:', response.message)
        
        // 降级：返回默认问题
        questions = this.getDefaultQuestions(params)
      }

      console.log(`✅ 生成了 ${questions.length} 个反思问题`)

      // 生成标题
      const taskTitle = params.tasks[0]?.title || '任务'
      const title = this.generateTitle(params.triggerType, taskTitle)

      return {
        type: 'success',
        data: {
          title,
          triggerType: params.triggerType,
          questions,
          taskCount: params.tasks.length,
          message: `已为「${taskTitle}」生成 ${questions.length} 个反思问题`
        }
      }

    } catch (error: any) {
      console.error('❌ ReflectOnTasksTool 执行失败:', error)
      return {
        type: 'error',
        message: `生成反思问题失败: ${error.message}`
      }
    }
  }

  /** 生成标题 */
  private generateTitle(triggerType: TriggerType, taskTitle: string): string {
    const titleMap: Record<TriggerType, string> = {
      improve: `关于「${taskTitle}」的小小反思`,
      decompose: `拆解「${taskTitle}」之前，想一想`,
      estimate_time: `「${taskTitle}」需要多久？`,
      reprioritize: `「${taskTitle}」的优先级`,
      review: `回顾一下`
    }
    return titleMap[triggerType] || `关于「${taskTitle}」`
  }

  /** 获取默认问题（降级方案） */
  private getDefaultQuestions(params: ReflectOnTasksParams): ReflectionQuestion[] {
    const taskTitle = params.tasks[0]?.title || '这个任务'
    
    const defaultQuestions: Record<TriggerType, ReflectionQuestion[]> = {
      improve: [
        { id: 'q_1', dimension: 'clarity', text: `「${taskTitle}」完成后，你希望看到什么具体结果？`, hint: '一句话说说就好' },
        { id: 'q_2', dimension: 'scope', text: `「${taskTitle}」是一次能完成的，还是需要分几次？` },
        { id: 'q_3', dimension: 'strategy', text: `你打算从哪里开始做「${taskTitle}」？` }
      ],
      decompose: [
        { id: 'q_1', dimension: 'strategy', text: `如果只有 15 分钟，你会从「${taskTitle}」的哪一步开始？` },
        { id: 'q_2', dimension: 'risk', text: `做「${taskTitle}」时，最容易卡住的地方可能是什么？` },
        { id: 'q_3', dimension: 'scope', text: `「${taskTitle}」大概需要拆成几个小步骤？` }
      ],
      estimate_time: [
        { id: 'q_1', dimension: 'time_realism', text: `你之前做过类似「${taskTitle}」的事吗？大概花了多久？` },
        { id: 'q_2', dimension: 'strategy', text: `「${taskTitle}」你想一次做完，还是分几段？` },
        { id: 'q_3', dimension: 'time_realism', text: `结合今天的安排，什么时候做「${taskTitle}」最现实？` }
      ],
      reprioritize: [
        { id: 'q_1', dimension: 'motivation', text: `「${taskTitle}」对你目前最重要的目标，有多直接的帮助？` },
        { id: 'q_2', dimension: 'risk', text: `如果本周不做「${taskTitle}」，会有什么后果？` },
        { id: 'q_3', dimension: 'time_realism', text: `做「${taskTitle}」意味着今天可能不能做什么？你能接受吗？` }
      ],
      review: [
        { id: 'q_1', dimension: 'strategy', text: `今天完成的任务里，哪一件做得特别顺利？为什么？` },
        { id: 'q_2', dimension: 'motivation', text: `有没有一类任务，你总是会拖延？它们有什么共同点？` },
        { id: 'q_3', dimension: 'strategy', text: `今天用的哪个方法，以后可以继续用？` }
      ]
    }

    return defaultQuestions[params.triggerType] || defaultQuestions.improve
  }
}

