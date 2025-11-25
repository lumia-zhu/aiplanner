// ============================================
// 元认知反思流程控制
// ============================================
// 管理三轮反思的流转逻辑
// ============================================

import { doubaoService } from '@/lib/doubaoService'
import type { 
  ReflectionSession, 
  ScanResult, 
  RoundRecord, 
  RoundsJson,
  TaskSnapshot,
  ReflectionRound 
} from '@/types/reflection'

// ==================== 类型定义 ====================

/** 反思轮次类型（三轮） */
export type ReflectionRoundType = 'clarity' | 'time' | 'priority'

/** 反思问题 */
export interface ReflectionQuestion {
  id: string
  text: string
  hint?: string
}

/** 单轮反思结果 */
export interface RoundResult {
  round: ReflectionRoundType
  questions: ReflectionQuestion[]
  title: string
  description: string
}

// ==================== 轮次配置 ====================

const ROUND_CONFIG: Record<ReflectionRoundType, {
  title: string
  description: string
  emoji: string
}> = {
  clarity: {
    title: '任务澄清',
    description: '让我们先看看这些任务是否足够清晰～',
    emoji: '🟦'
  },
  time: {
    title: '时间规划',
    description: '接下来想想时间安排～',
    emoji: '🟩'
  },
  priority: {
    title: '优先级',
    description: '最后考虑一下轻重缓急～',
    emoji: '🟧'
  }
}

// ==================== 元认知维度定义 ====================

/**
 * 任务澄清的 5 大核心维度（基于元认知理论）
 * 
 * 目标：让用户从"写下一个任务" → "理解这个任务"
 * 对应元认知四过程：Planning / Monitoring / Control / Evaluation
 */
const CLARITY_DIMENSIONS = {
  // 1. 目标明确度 (Goal Clarity) - Planning
  goalClarity: {
    name: '目标明确度',
    description: '任务是否清楚、具体、能一眼知道要干什么',
    questionDirections: [
      '这个任务完成后，最终产出是什么？',
      '如果用一句话告诉朋友，TA能明白你要做什么吗？',
      '怎样判断这个任务"完成了"？'
    ]
  },
  // 2. 范围与边界 (Scope & Boundaries) - Planning
  scope: {
    name: '范围边界',
    description: '任务的大小、是否可一次性完成、是否需要拆解',
    questionDirections: [
      '这个任务能一次做完，还是需要分几步？',
      '它包含哪些子部分？',
      '有没有不需要做的部分？'
    ]
  },
  // 3. 前置条件 (Prerequisites) - Monitoring
  prerequisites: {
    name: '前置条件',
    description: '任务是否缺少资源、信息、环境',
    questionDirections: [
      '开始之前需要准备什么？',
      '有没有必须先完成的前置任务？',
      '有没有"如果没准备好会卡住"的东西？'
    ]
  },
  // 4. 开始方式 (Activation & First Step) - Control
  activation: {
    name: '开始方式',
    description: '如何迈出第一步（ADHD 最困难的部分）',
    questionDirections: [
      '如果只用 5 分钟先做一点点，会从哪步开始？',
      '最初的动作是什么？',
      '哪个部分最容易入手？'
    ]
  },
  // 5. 完成标准 (Completion Criteria) - Evaluation
  completion: {
    name: '完成标准',
    description: '如何判断任务结束',
    questionDirections: [
      '完成时希望看到怎样的结果？',
      '"做到满意"意味着什么？',
      '打算如何确认已经达成？'
    ]
  }
}

// ==================== Prompt 构建 ====================

/**
 * 分析任务的"可理解性"，判断缺失哪些元认知维度
 */
function analyzeTaskClarity(task: TaskSnapshot): {
  isAbstract: boolean      // 是否过于抽象
  isTooLarge: boolean      // 是否过大
  missingDimensions: string[]  // 缺失的维度
} {
  const title = task.title
  
  // 检查是否过于抽象（单个动词或缺乏具体对象）
  const abstractPatterns = [
    /^(学习|复习|准备|整理|处理|完成|做)$/,
    /^(学习|复习|准备|整理|处理|完成|做).{0,3}$/,
  ]
  const isAbstract = abstractPatterns.some(p => p.test(title)) || title.length < 4
  
  // 检查是否过大（可能需要拆解）
  const largePatterns = [
    /论文|报告|项目|课程|考试/,
    /整个|全部|所有/
  ]
  const isTooLarge = largePatterns.some(p => p.test(title))
  
  // 判断缺失的维度
  const missingDimensions: string[] = []
  if (isAbstract) {
    missingDimensions.push('goalClarity')  // 目标不明确
  }
  if (isTooLarge) {
    missingDimensions.push('scope')  // 范围过大
  }
  // 默认都可能缺少开始方式（ADHD 核心困难）
  missingDimensions.push('activation')
  
  return { isAbstract, isTooLarge, missingDimensions }
}

function buildRoundPrompt(
  round: ReflectionRoundType,
  tasks: TaskSnapshot[],
  scanResult: ScanResult,
  previousResponses?: string[]
): string {
  const config = ROUND_CONFIG[round]
  const uncompletedTasks = tasks.filter(t => !t.isCompleted)
  
  // 构建任务列表
  const taskList = uncompletedTasks
    .map(t => {
      const parts = [`「${t.title}」`]
      if (t.priority) parts.push(`优先级: ${t.priority}`)
      if (t.estimatedDuration) parts.push(`${t.estimatedDuration}分钟`)
      if (t.deadline) parts.push(`截止: ${t.deadline}`)
      return parts.join(' | ')
    })
    .join('\n')

  // 之前的回答（如果有）
  const previousContext = previousResponses && previousResponses.length > 0
    ? `\n【用户之前的回答】\n${previousResponses.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : ''

  // 根据轮次构建特定的 Prompt
  if (round === 'clarity') {
    // 分析每个任务的清晰度
    const taskAnalysis = uncompletedTasks.map(t => {
      const analysis = analyzeTaskClarity(t)
      const issues: string[] = []
      if (analysis.isAbstract) issues.push('目标模糊')
      if (analysis.isTooLarge) issues.push('范围较大')
      if (issues.length === 0) issues.push('相对清晰')
      return `- 「${t.title}」: ${issues.join('、')}`
    }).join('\n')

    return `你是一个专业的元认知教练。你的目标不是"补全任务细节"，而是**唤醒用户的元认知（Task / Self / Strategy Awareness）**。

【用户的任务】
${taskList}

【任务分析】
${taskAnalysis}
${previousContext}
【问题生成策略 - 核心调整】

**❌ 绝对禁止（Don't）：**
1. **不要猜场景**：不要问"是去健身房还是在家？"、"是批作业还是答疑？"（除非你非常有把握，否则显着很傻）。
2. **不要问无关细节**：不要问"有多少份要批？"（这对当下的行动意愿没帮助）。
3. **不要做二选一**：不要问"是A还是B？"（这限制了用户的思维）。

**✅ 必须坚持（Do）：**
1. **Task Awareness（任务认知）**：
   - 关注"完成的标准"：不是问"你要做什么"，而是问"你怎么知道做完了？" / "你脑海里有做完后的画面吗？"
   - 关注"模糊性"：如果任务模糊，问"这个任务对你来说是常规操作，还是需要现想怎么做？"

2. **Strategy Awareness（策略认知）**：
   - 关注"执行路径"：问"你打算按部就班做，还是有什么捷径？"
   - 关注"障碍预判"：问"做这个任务时，最容易让你分心或卡住的是什么？"

3. **Self Awareness（自我认知）**：
   - 关注"状态匹配"：问"你现在的精力/情绪适合做这个吗？"

【问题示例】
❌ 差（过于具体/预设）："锻炼是跑步还是举铁？"
✅ 好（策略/状态）："关于锻炼，你是有固定的计划，还是打算看心情决定？"

❌ 差（过于具体）："做TA是批改几份作业？"
✅ 好（障碍预判）："做TA这项工作，有没有哪个环节是你比较抗拒、容易拖延的？"

❌ 差（无效问题）："学习的目标是什么？"
✅ 好（行动触发）："学习这项任务，你只需要准备好，还是需要先调整一下状态才能开始？"

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "问题内容", "hint": "问题背后的元认知意图（如：策略意识、障碍预判）" }
]

只返回 JSON，不要其他内容。`

  } else if (round === 'time') {
    return `你是一个专业的元认知教练。在时间规划层面，你的目标是唤醒用户的**Temporal Awareness（时间知觉）**。

【用户的任务】
${taskList}

【当前情况】
- ${scanResult.unestimatedTaskCount} 个任务没有时间估计
- 工作负载: ${scanResult.workloadLevel === 'light' ? '轻松' : scanResult.workloadLevel === 'heavy' ? '较重' : '适中'}
- 总任务数: ${scanResult.totalTaskCount}
${previousContext}
【问题生成策略】

**❌ 禁止（Don't）：**
1. **不要逐个问时间**："学习要多久？"、"锻炼要多久？"（枯燥、像填表）。
2. **不要问无法回答的问题**："你觉得今天能做完吗？"（用户通常会盲目自信说能）。

**✅ 提倡（Do）：**
1. **校准时间知觉（Calibration）**：
   - "这几个任务里，哪个通常会比你预期的花更多时间？"
   - "对于[具体任务]，你以前做类似的事情时，实际花费的时间和预计的一样吗？"

2. **识别时间黑洞（Time Sinks）**：
   - "哪个任务一旦开始，你可能会不知不觉陷进去（Flow/Hyperfocus）？"
   - "今天有没有什么固定的时间窗口（如上课、开会）是必须避开的？"

3. **能量管理（Energy Management）**：
   - "这些任务里，哪个需要在你精力最好的时候做？"

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "问题内容", "hint": "元认知意图（如：时间校准、能量匹配）" }
]

只返回 JSON，不要其他内容。`

  } else if (round === 'priority') {
    return `你是一个专业的元认知教练。在优先级层面，你的目标是帮助用户**识别价值（Value）和后果（Consequence）**。

【用户的任务】
${taskList}

【当前情况】
- ${scanResult.noPriorityCount} 个任务没有设置优先级
- 总任务数: ${scanResult.totalTaskCount}
${scanResult.deadlineConflicts.length > 0 ? `- 需要关注的 deadline: ${scanResult.deadlineConflicts.join(', ')}` : ''}
${previousContext}
【问题生成策略】

**❌ 禁止（Don't）：**
1. **不要问"哪个重要"**：这太抽象，用户通常觉得都重要。
2. **不要问"先做哪个"**：这是结果，不是思考过程。

**✅ 提倡（Do）：**
1. **后果思维（Consequence）**：
   - "如果今天只能完成一件事，做哪件会让你今晚睡得最安稳？"
   - "这几个任务里，有没有哪个如果不做，明天会有真正的麻烦？"

2. **阻力分析（Resistance）**：
   - "哪个任务是你现在最想逃避的？（通常它很重要但很难）"
   - "有没有哪个任务是单纯的'想做'（Want to），而不是'必须做'（Have to）？"

3. **多米诺效应（Leverage）**：
   - "有没有哪个任务做完后，其他的任务会变得容易一些？"

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "问题内容", "hint": "元认知意图（如：后果分析、阻力识别）" }
]

只返回 JSON，不要其他内容。`
  }

  // 默认 fallback
  return `生成 2-3 个关于任务的反思问题，任务列表：${taskList}`
}

// ==================== 核心函数 ====================

/**
 * 生成某一轮的反思问题
 * @param previousQuestions 之前已经问过的问题（用于生成补充问题时避免重复）
 */
export async function generateRoundQuestions(
  round: ReflectionRoundType,
  tasks: TaskSnapshot[],
  scanResult: ScanResult,
  previousResponses?: string[],
  previousQuestions?: string[]  // 新增：之前问过的问题
): Promise<RoundResult | null> {
  try {
    console.log(`💭 生成 ${round} 轮反思问题...`, previousQuestions ? '(补充问题模式)' : '')
    
    const config = ROUND_CONFIG[round]
    let prompt = buildRoundPrompt(round, tasks, scanResult, previousResponses)
    
    // 如果有之前的问题，添加避免重复的指令
    if (previousQuestions && previousQuestions.length > 0) {
      const avoidSection = `

【⚠️ 重要：避免重复】
以下问题已经问过了，请生成**完全不同角度**的新问题：
${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

请从其他维度提问，比如：
- 如果之前问了"具体做什么" → 现在可以问"可能遇到什么困难"
- 如果之前问了"怎么开始" → 现在可以问"怎么判断完成了"
- 如果之前问了任务A → 现在可以问任务B
- 可以问跨任务的整体问题

绝对不要重复或换个说法问同样的问题！`
      
      prompt = prompt.replace('只返回 JSON，不要其他内容。', avoidSection + '\n\n只返回 JSON，不要其他内容。')
    }
    
    const response = await doubaoService.sendMessage(prompt)
    
    if (!response.success || !response.message) {
      console.error('❌ LLM 调用失败:', response.error)
      return null
    }
    
    // 解析 JSON
    let questions: ReflectionQuestion[]
    try {
      const jsonMatch = response.message.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('未找到 JSON 数组')
      }
      
      const parsed = JSON.parse(jsonMatch[0])
      questions = parsed.map((q: any, index: number) => ({
        id: `${round}-${index + 1}`,
        text: q.text,
        hint: q.hint
      }))
    } catch (parseError) {
      console.error('❌ JSON 解析失败:', parseError)
      // 降级：直接使用返回的文本作为单个问题
      questions = [{
        id: `${round}-1`,
        text: response.message.slice(0, 200),
        hint: undefined
      }]
    }
    
    console.log(`✅ 生成了 ${questions.length} 个问题`)
    
    return {
      round,
      questions,
      title: `${config.emoji} ${config.title}`,
      description: config.description
    }
    
  } catch (error) {
    console.error('❌ 生成反思问题失败:', error)
    return null
  }
}

/**
 * 获取下一个轮次
 */
export function getNextRound(currentRound: ReflectionRound): ReflectionRound | 'summary' {
  switch (currentRound) {
    case 'overview':
      return 'clarity'
    case 'clarity':
      return 'time'
    case 'time':
      return 'priority'
    case 'priority':
      return 'summary'
    default:
      return 'summary'
  }
}

/**
 * 判断某轮是否需要执行（基于 ScanResult）
 */
export function shouldRunRound(
  round: ReflectionRoundType,
  scanResult: ScanResult,
  taskCount: number
): { shouldRun: boolean; reason?: string } {
  // 任务太少时，某些轮次可以跳过
  if (taskCount === 0) {
    return { shouldRun: false, reason: '没有任务' }
  }
  
  switch (round) {
    case 'clarity':
      // 澄清轮：总是执行
      return { shouldRun: true }
      
    case 'time':
      // 时间轮：如果所有任务都有时间估计，可以简化
      if (scanResult.unestimatedTaskCount === 0) {
        return { shouldRun: true, reason: '所有任务都已估时，简单确认' }
      }
      return { shouldRun: true }
      
    case 'priority':
      // 优先级轮：只有1个任务时可以跳过
      if (taskCount === 1) {
        return { shouldRun: false, reason: '只有一个任务，不需要排优先级' }
      }
      return { shouldRun: true }
      
    default:
      return { shouldRun: true }
  }
}

/**
 * 格式化反思问题为聊天消息
 */
export function formatQuestionsAsMessage(result: RoundResult): string {
  const lines: string[] = []
  
  lines.push(`**${result.title}**`)
  lines.push('')
  lines.push(result.description)
  lines.push('')
  
  result.questions.forEach((q, index) => {
    // 问题用粗体
    lines.push(`**${index + 1}. ${q.text}**`)
    // 提示用斜体和缩进，颜色更淡
    if (q.hint) {
      lines.push(`> _💡 ${q.hint}_`)
    }
    lines.push('')  // 问题之间空一行
  })
  
  lines.push('---')
  lines.push('_你可以想一想这些问题，回答或跳过都可以～_')
  
  return lines.join('\n')
}

// ==================== 反思总结生成 ====================

/** 执行建议类型 */
export interface ExecutionSuggestion {
  type: 'start' | 'time' | 'chunk' | 'obstacle' | 'focus' | 'emotion'
  text: string
}

/** 反思总结结果 */
export interface ReflectionSummaryResult {
  miniSummary: string           // 归纳用户的反思内容
  executionSuggestions: ExecutionSuggestion[]  // 执行建议
}

/**
 * 生成反思总结和执行建议
 */
export async function generateReflectionSummary(
  tasks: TaskSnapshot[],
  scanResult: ScanResult,
  roundsCompleted: ReflectionRoundType[],
  userResponses: Record<string, string[]>  // 每轮的用户回答
): Promise<ReflectionSummaryResult | null> {
  try {
    console.log('📝 生成反思总结...')
    
    const uncompletedTasks = tasks.filter(t => !t.isCompleted)
    const taskList = uncompletedTasks.map(t => `「${t.title}」`).join('、')
    
    // 收集所有用户回答
    const allResponses: string[] = []
    for (const round of roundsCompleted) {
      const responses = userResponses[round] || []
      allResponses.push(...responses)
    }
    
    const hasResponses = allResponses.length > 0
    const responsesText = hasResponses 
      ? `\n【用户在反思中的回答】\n${allResponses.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
      : '\n【用户没有回答问题，但完成了反思流程】\n'

    const prompt = `你是一个友好的任务规划助手，刚刚帮用户完成了任务反思。现在需要生成一个简短的总结和 1-2 条执行建议。

【用户的任务】
${taskList}

【任务扫描结果】
- 总任务数: ${scanResult.totalTaskCount}
- 模糊任务: ${scanResult.vagueTaskCount}
- 未估时: ${scanResult.unestimatedTaskCount}
- 工作负载: ${scanResult.workloadLevel}

【完成的反思轮次】
${roundsCompleted.map(r => ROUND_CONFIG[r].title).join(' → ')}
${responsesText}
【生成要求】

1. Mini Summary（1-3 句话）
   - 如果用户有回答，归纳用户说了什么
   - 如果用户没回答，简单肯定用户完成了反思
   - 语气温和、肯定

2. 执行建议（1-2 条）
   选择最适合的建议类型：
   - start: 起点建议（帮助突破"开始困难"，如"先做5分钟最小行动"）
   - time: 时间段建议（找合适的执行窗口）
   - chunk: 分段执行策略（把大任务拆成小段）
   - obstacle: 预判障碍（提前意识到可能卡住的地方）
   - focus: 专注策略（降低分心风险）
   - emotion: 情绪调节策略（应对焦虑/回避情绪）

   建议要：
   - 具体、可操作
   - 基于用户的任务内容
   - 不增加认知负担
   - 把选择权交给用户（"你可以考虑..."）

【输出格式】
返回 JSON：
{
  "miniSummary": "总结内容",
  "suggestions": [
    { "type": "start", "text": "建议内容" }
  ]
}

只返回 JSON，不要其他内容。`

    const response = await doubaoService.sendMessage(prompt)
    
    if (!response.success || !response.message) {
      console.error('❌ LLM 调用失败:', response.error)
      return null
    }
    
    // 解析 JSON
    try {
      const jsonMatch = response.message.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('未找到 JSON')
      }
      
      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        miniSummary: parsed.miniSummary || '反思完成！',
        executionSuggestions: (parsed.suggestions || []).map((s: any) => ({
          type: s.type || 'start',
          text: s.text
        }))
      }
    } catch (parseError) {
      console.error('❌ JSON 解析失败:', parseError)
      // 降级处理
      return {
        miniSummary: '你已经完成了今天的任务反思，对任务有了更清晰的认识。',
        executionSuggestions: [{
          type: 'start',
          text: '你可以从最简单的任务开始，先做 5 分钟试试看。'
        }]
      }
    }
    
  } catch (error) {
    console.error('❌ 生成反思总结失败:', error)
    return null
  }
}

/**
 * 格式化反思总结为聊天消息
 */
export function formatSummaryAsMessage(result: ReflectionSummaryResult): string {
  const lines: string[] = []
  
  lines.push('**🌟 小结一下**')
  lines.push('')
  lines.push(result.miniSummary)
  
  if (result.executionSuggestions.length > 0) {
    lines.push('')
    lines.push('**💡 下一步建议**')
    lines.push('')
    
    const typeEmoji: Record<string, string> = {
      start: '🚀',
      time: '⏰',
      chunk: '📦',
      obstacle: '🛡️',
      focus: '🎯',
      emotion: '💪'
    }
    
    result.executionSuggestions.forEach(s => {
      const emoji = typeEmoji[s.type] || '💡'
      lines.push(`${emoji} ${s.text}`)
    })
  }
  
  lines.push('')
  lines.push('---')
  lines.push('_你可以回到任务列表根据需要调整，也可以直接开始执行。加油！_ 😊')
  
  return lines.join('\n')
}

