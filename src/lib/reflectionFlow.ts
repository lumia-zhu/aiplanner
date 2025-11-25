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
  tasksToDecompose?: string[]  // Clarity 轮特有：LLM 建议拆解的任务标题
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
 * 识别顶层任务（过滤掉子任务）
 * 子任务通常有以下特征：
 * 1. 标题以动词开头 + 父任务名（如"制定锻炼计划"、"准备锻炼装备"）
 * 2. 标题模式：动作词 + 相同的关键词
 * 3. 多个任务共享相同的关键词（如"椭圆机"出现在多个任务中）
 */
function identifyTopLevelTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  if (tasks.length <= 1) return tasks
  
  // 收集所有任务标题
  const titles = tasks.map(t => t.title)
  
  // 找出可能的父任务关键词（出现在多个任务中，且至少有一个任务就是这个关键词）
  const potentialParentKeywords: Set<string> = new Set()
  
  // 第一步：找出所有共享的关键词
  const keywordCounts: Map<string, number> = new Map()
  for (const title of titles) {
    // 提取可能的关键词（2-6个字的词）
    const keywords = title.match(/[\u4e00-\u9fa5]{2,6}/g) || []
    for (const keyword of keywords) {
      const count = (keywordCounts.get(keyword) || 0) + 1
      keywordCounts.set(keyword, count)
    }
  }
  
  // 找出出现次数 >= 2 的关键词
  for (const [keyword, count] of keywordCounts) {
    if (count >= 2) {
      potentialParentKeywords.add(keyword)
    }
  }
  
  // 子任务模式：以动词开头
  const subtaskVerbPatterns = /^(制定|准备|执行|完成|整理|记录|调整|检查|确认|安排|规划|设置|进行|开始|结束|收拾|清理|购买|下载|安装|配置|测试|验证|提交|发送|回复|联系|预约|取消)/
  
  // 判断一个任务是否是子任务
  const isSubtask = (title: string): boolean => {
    // 如果任务很短（可能是父任务），不算子任务
    if (title.length <= 4) return false
    
    // 检查是否以动词开头
    const startsWithVerb = subtaskVerbPatterns.test(title)
    
    // 检查是否包含共享关键词
    const containsSharedKeyword = Array.from(potentialParentKeywords).some(keyword => {
      // 如果任务标题就是关键词本身，不算子任务
      if (title === keyword) return false
      // 如果任务标题只比关键词多一两个字，可能是父任务
      if (title.length <= keyword.length + 2) return false
      return title.includes(keyword)
    })
    
    // 同时满足：以动词开头 + 包含共享关键词 = 子任务
    return startsWithVerb && containsSharedKeyword
  }
  
  // 过滤出顶层任务
  const topLevelTasks = tasks.filter(task => !isSubtask(task.title))
  
  // 如果过滤后任务太少（可能误判），尝试更宽松的策略
  if (topLevelTasks.length === 0) {
    // 返回原始列表
    return tasks
  }
  
  // 如果过滤后只剩很少的任务，但原来有很多，可能是误判
  // 这种情况下，选择最短的几个任务作为顶层任务
  if (topLevelTasks.length < tasks.length * 0.3 && tasks.length > 3) {
    // 按标题长度排序，取最短的几个
    const sortedByLength = [...tasks].sort((a, b) => a.title.length - b.title.length)
    const shortestTasks = sortedByLength.slice(0, Math.max(3, Math.ceil(tasks.length * 0.3)))
    return shortestTasks
  }
  
  return topLevelTasks
}

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

【额外任务：识别需要拆解的任务】
请同时判断哪些任务**可能需要拆解**。判断标准：
- 任务描述模糊，不知道具体要做什么
- 任务范围太大，一次做不完
- 任务包含多个步骤或子目标
- 任务复杂度高，容易让人不知从何下手

注意：简单、清晰、一步到位的任务（如"锻炼"、"买菜"）不需要拆解。

【输出格式】
返回 JSON 对象：
{
  "questions": [
    { "text": "问题内容", "hint": "问题背后的元认知意图（如：策略意识、障碍预判）" }
  ],
  "tasksToDecompose": ["任务标题1", "任务标题2"]
}

- questions: 严格 3 个反思问题
- tasksToDecompose: 建议拆解的任务标题数组（可以为空数组 []）

只返回 JSON，不要其他内容。`

  } else if (round === 'time') {
    // 过滤出顶层任务（非子任务）
    // 子任务通常是拆解出来的，标题可能包含"制定...计划"、"准备..."等模式
    // 或者我们可以通过检查任务是否有多个相似前缀来判断
    const topLevelTasks = identifyTopLevelTasks(uncompletedTasks)
    const topLevelTaskList = topLevelTasks
      .map(t => {
        const parts = [`「${t.title}」`]
        if (t.priority) parts.push(`优先级: ${t.priority}`)
        if (t.estimatedDuration) parts.push(`${t.estimatedDuration}分钟`)
        if (t.deadline) parts.push(`截止: ${t.deadline}`)
        return parts.join(' | ')
      })
      .join('\n')
    
    return `你是一个专业的元认知教练。在时间规划层面，你的目标是帮助用户**克服规划谬误（Planning Fallacy）**和**时间盲区（Time Blindness）**。

【用户的主要任务】（只关注这些顶层任务，不要问子任务）
${topLevelTaskList}

【当前情况】
- ${scanResult.unestimatedTaskCount} 个任务没有时间估计
- 工作负载: ${scanResult.workloadLevel === 'light' ? '轻松' : scanResult.workloadLevel === 'heavy' ? '较重' : '适中'}
- 主要任务数: ${topLevelTasks.length}
${previousContext}
【问题生成策略 - 核心调整】

**❌ 禁止（Don't）：**
1. **不要问"有多少时间"**：用户通常高估可用时间。
2. **不要问"哪个最长"**：这通常显而易见，没价值。
3. **不要问子任务**：只关注主要任务（如"锻炼"、"做TA"），不要问拆解出来的子步骤。

**✅ 必须坚持（Do）—— 聚焦于"校准"和"落地"：**
1. **参考类预测（Reference Class）**：
   - "回想一下上次做类似[主要任务]的时候，实际花费的时间是不是比预想的要长？"
   - "通常做这类任务，你是不是容易低估某些环节的时间？"

2. **隐形依赖与瓶颈（Hidden Dependencies）**：
   - "做[主要任务]之前，是不是需要等别人的回复或准备什么？"
   - "[主要任务]有没有什么前置步骤是你没算进时间的？"

3. **风险与冗余（Risk & Buffer）**：
   - "如果[主要任务]中间出了点小岔子（比如被打断），你现在的计划有弹性吗？"
   - "你有没有给[主要任务]预留 buffer，以防万一？"

4. **整体时间分配（Time Allocation）**：
   - "今天这几个任务加起来，时间够用吗？有没有需要调整的？"

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "问题内容", "hint": "元认知意图（如：参考过往经验、识别隐形依赖、预留缓冲）" }
]

只返回 JSON，不要其他内容。`

  } else if (round === 'priority') {
    // 过滤出顶层任务
    const topLevelTasks = identifyTopLevelTasks(uncompletedTasks)
    const topLevelTaskList = topLevelTasks
      .map(t => `「${t.title}」`)
      .join('、')
    const taskNames = topLevelTasks.map(t => t.title)
    
    return `你是一个专业的元认知教练。在优先级层面，你的目标是帮助用户**梳理出哪个任务该先做**。

【用户的主要任务】（只关注这些，不要问子任务）
${topLevelTaskList}

【当前情况】
- ${scanResult.noPriorityCount} 个任务没有设置优先级
- 主要任务数: ${topLevelTasks.length}
${scanResult.deadlineConflicts.length > 0 ? `- 需要关注的 deadline: ${scanResult.deadlineConflicts.join(', ')}` : ''}
${previousContext}
【问题生成策略 - 核心调整】

**❌ 禁止（Don't）：**
1. **不要泛泛而问**：不要问"哪个重要"、"先做哪个"这种抽象问题。
2. **不要问子任务**：只关注主要任务（${taskNames.join('、')}），不要问拆解出来的子步骤。

**✅ 必须坚持（Do）—— 具体到任务名称：**
1. **后果对比（Consequence Comparison）**：
   - "如果「${taskNames[0] || '任务A'}」和「${taskNames[1] || '任务B'}」今天只能做一个，不做哪个明天会更麻烦？"
   - "「${taskNames[0] || '任务'}」如果今天不做，会有什么实际后果？"

2. **紧迫度校准（Urgency Check）**：
   - "「${taskNames[0] || '任务'}」是真的今天必须做，还是只是你觉得'应该'做？"
   - "这几个任务里，哪个有真正的外部 deadline（比如别人在等）？"

3. **阻力识别（Resistance Analysis）**：
   - "「${taskNames[0] || '任务'}」和「${taskNames[1] || '任务'}」相比，你更想逃避哪一个？（通常它更重要但更难）"

4. **依赖关系（Dependency）**：
   - "做完「${taskNames[0] || '任务'}」会不会让「${taskNames[1] || '任务'}」变得更容易？"

【输出格式】
返回 JSON 数组（严格 3 个问题，必须包含具体任务名称）：
[
  { "text": "问题内容（必须提到具体任务名称）", "hint": "元认知意图（如：后果对比、紧迫度校准）" }
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
    let tasksToDecompose: string[] = []
    
    try {
      // Clarity 轮返回的是对象格式 { questions: [...], tasksToDecompose: [...] }
      // 其他轮返回的是数组格式 [...]
      if (round === 'clarity') {
        // 尝试解析对象格式
        const jsonMatch = response.message.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('未找到 JSON 对象')
        }
        
        const parsed = JSON.parse(jsonMatch[0])
        
        // 解析问题
        const questionsArray = parsed.questions || []
        questions = questionsArray.map((q: any, index: number) => ({
          id: `${round}-${index + 1}`,
          text: q.text,
          hint: q.hint
        }))
        
        // 解析建议拆解的任务
        tasksToDecompose = parsed.tasksToDecompose || []
        console.log(`✂️ LLM 建议拆解的任务:`, tasksToDecompose)
        
      } else {
        // 其他轮次：数组格式
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
      }
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
      description: config.description,
      tasksToDecompose: round === 'clarity' ? tasksToDecompose : undefined
    }
    
  } catch (error) {
    console.error('❌ 生成反思问题失败:', error)
    return null
  }
}

// ==================== 任务拆解识别 ====================

/**
 * 识别可能需要拆解的复杂任务
 * 
 * 识别逻辑（宽松策略，宁可多问不漏）：
 * 1. 任务标题包含特定关键词（论文、报告、项目、准备、整理、Meeting 等）
 * 2. 任务标题较长（>8字符，去除时间标记后）
 * 3. 任务被分析为"模糊"或"过大"
 * 4. 任务包含多个动作或对象
 * 
 * @param tasks 任务列表
 * @returns 可能需要拆解的任务数组
 */
export function identifyDecomposableTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  const decomposableTasks: TaskSnapshot[] = []
  
  for (const task of tasks) {
    // 跳过已完成的任务
    if (task.isCompleted) continue
    
    // 清理标题：去除时间标记（如 ⏳ 30m）
    const cleanTitle = task.title.replace(/⏳\s*\d+[mh]?\s*/g, '').trim()
    
    // 1. 检查关键词（表示复杂任务）- 扩展关键词列表
    const complexKeywords = [
      // 学术/工作相关
      '论文', '报告', '项目', '课程', '考试', '作业', '答辩', '演讲', '展示',
      // 会议/沟通类（通常需要准备）
      'meeting', 'Meeting', '会议', '面试', '汇报', '讨论',
      // 准备/整理类
      '准备', '整理', '规划', '设计', '开发', '搭建', '部署',
      // 范围词
      '整个', '全部', '所有', '完整',
      // 流程词
      '实现', '完成', '制作', '写', '做',
      // 学习类（可能需要细化）
      '学习', '复习', '研究', '调研'
    ]
    const hasComplexKeyword = complexKeywords.some(kw => cleanTitle.toLowerCase().includes(kw.toLowerCase()))
    
    // 2. 检查标题长度（较长的标题通常意味着复杂任务）
    const isTitleLong = cleanTitle.length > 8
    
    // 3. 使用已有的分析函数
    const analysis = analyzeTaskClarity(task)
    const isAbstractOrLarge = analysis.isAbstract || analysis.isTooLarge
    
    // 4. 检查是否包含多个元素（用"和"、"与"、"+"连接）
    const hasMultipleElements = /[和与+&,，]/.test(cleanTitle)
    
    // 综合判断：满足以下任一条件即认为可能需要拆解
    // - 包含复杂关键词 且 不是太短（避免"学习"这种单词）
    // - 标题较长
    // - 包含多个元素
    // - 被分析为模糊/过大 且 标题不是太短
    const shouldDecompose = 
      (hasComplexKeyword && cleanTitle.length > 3) ||
      isTitleLong ||
      hasMultipleElements ||
      (isAbstractOrLarge && cleanTitle.length > 5)
    
    if (shouldDecompose) {
      decomposableTasks.push(task)
    }
  }
  
  console.log(`🔍 识别到 ${decomposableTasks.length} 个可能需要拆解的任务:`, 
    decomposableTasks.map(t => t.title))
  
  return decomposableTasks
}

/**
 * 格式化拆解询问消息
 * 
 * @param decomposableTasks 可能需要拆解的任务列表
 * @returns 格式化后的消息
 */
export function formatDecompositionInquiryMessage(decomposableTasks: TaskSnapshot[]): string {
  if (decomposableTasks.length === 0) {
    return ''
  }
  
  const lines: string[] = []
  
  lines.push('**✂️ 要不要拆解一下？**')
  lines.push('')
  lines.push('我注意到这些任务可能比较复杂，拆解成小步骤会更容易执行：')
  lines.push('')
  
  decomposableTasks.forEach((task, index) => {
    lines.push(`${index + 1}. **${task.title}**`)
  })
  
  lines.push('')
  lines.push('_你可以选择要拆解的任务，也可以跳过继续下一步～_')
  
  return lines.join('\n')
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
  lines.push('_你可以想一想这些问题并修改你的任务计划，再点击下一步～_')
  
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

