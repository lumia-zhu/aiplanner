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
  ReflectionRound,
  MatrixContextForPriority
} from '@/types/reflection'

// ==================== 类型定义 ====================

/** 反思轮次类型（四轮） */
export type ReflectionRoundType = 'clarity' | 'decomposition' | 'time' | 'priority'

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
    title: '明确任务',
    description: '让我们先看看这些任务是否足够清晰～',
    emoji: '🟦'
  },
  decomposition: {
    title: '任务拆解',
    description: '看看有没有需要拆解的大任务～',
    emoji: '✂️'
  },
  time: {
    title: '估算时间',
    description: '接下来想想时间安排～',
    emoji: '🟩'
  },
  priority: {
    title: '优先级',
    description: '最后考虑一下轻重缓急～',
    emoji: '🟧'
  }
}

// ==================== 降级问题库（确保总有3个问题） ====================

/**
 * 当 LLM 生成失败或问题数量不足时使用的降级问题
 * 每个轮次都有3个通用但有效的备用问题
 */
const FALLBACK_QUESTIONS: Record<ReflectionRoundType, ReflectionQuestion[]> = {
  clarity: [
    {
      id: 'clarity-fallback-1',
      text: '这个任务具体是要修改哪方面的内容（如论文、报告、设计稿等）？',
      hint: '明确任务的具体对象和范围'
    },
    {
      id: 'clarity-fallback-2',
      text: '修改的重点是什么（如内容、格式、逻辑、数据等）？',
      hint: '了解任务的核心要求'
    },
    {
      id: 'clarity-fallback-3',
      text: '预期的完成标准是什么？怎样算修改完成？',
      hint: '确定任务的完成条件'
    }
  ],
  decomposition: [
    {
      id: 'decomposition-fallback-1',
      text: '这个任务可以分成哪几个独立的小步骤？',
      hint: '识别可独立完成的子任务'
    },
    {
      id: 'decomposition-fallback-2',
      text: '如果只做5分钟，你会从哪一步开始？',
      hint: '找到最小启动单元'
    },
    {
      id: 'decomposition-fallback-3',
      text: '这些步骤需要按顺序做，还是可以任选一个开始？',
      hint: '理清任务依赖关系'
    }
  ],
  time: [
    {
      id: 'time-fallback-1',
      text: '回想一下上次做类似任务的时候，实际花费的时间是不是比预想的要长？',
      hint: '基于过往经验校准时间估计'
    },
    {
      id: 'time-fallback-2',
      text: '做这个任务之前，是不是需要等别人的回复或准备什么？',
      hint: '识别隐形的时间依赖'
    },
    {
      id: 'time-fallback-3',
      text: '如果这个任务被打断或遇到意外情况，你打算怎么办？会影响其他任务吗？',
      hint: '考虑应对措施和影响'
    }
  ],
  priority: [
    {
      id: 'priority-fallback-1',
      text: '这些任务里，哪些是"别人在等"的（有外部 deadline），哪些是"自己想做"的？前者通常更紧急。',
      hint: '区分紧急性来源 → 判断是否放入"紧急"象限'
    },
    {
      id: 'priority-fallback-2',
      text: '想象一下：如果这些任务这周都不做，哪个会让你一个月后最后悔？那个可能是"重要但不紧急"的任务。',
      hint: '识别长期价值 → 判断是否放入"重要"象限'
    },
    {
      id: 'priority-fallback-3',
      text: '有没有哪个任务，做完后会让其他任务变得更容易？这种"解锁型"任务可能值得优先做。',
      hint: '识别任务依赖关系 → 优化执行顺序'
    }
  ]
}

// ==================== 概述生成 ====================

/**
 * 生成反思概述消息（LLM 生成）
 * 分析用户的任务列表，给出澄清/时间/优先级三方面的简要建议
 */
export async function generateOverviewMessage(
  tasks: TaskSnapshot[],
  scanResult: ScanResult
): Promise<string> {
  const uncompletedTasks = tasks.filter(t => !t.isCompleted)
  
  // 只统计父类任务（顶层任务）
  const parentTasks = uncompletedTasks.filter(t => (t.depth ?? 0) === 0)
  
  // 如果没有任务，返回空消息
  if (parentTasks.length === 0) {
    return '📭 今天还没有任务呢，先在左边添加一些任务吧～'
  }
  
  // 检查哪些父任务有子任务
  const parentTasksWithChildren = parentTasks.filter(parent => 
    uncompletedTasks.some(child => child.parent_task_id === parent.id)
  )
  const parentIdsWithChildren = new Set(parentTasksWithChildren.map(t => t.id))
  
  // 构建任务列表（只包含父类任务，并标注是否有子任务）
  const taskList = parentTasks
    .map(t => {
      const parts = [`- ${t.title}`]
      if (parentIdsWithChildren.has(t.id)) parts.push(`(有子任务)`)
      if (t.estimatedDuration) parts.push(`(${t.estimatedDuration}分钟)`)
      return parts.join(' ')
    })
    .join('\n')
  
  // 统计父类任务的未估时数量
  const unestimatedParentCount = parentTasks.filter(t => !t.estimatedDuration).length
  
  const prompt = `你是一个专业的任务规划助手，帮助用户快速诊断今天的任务情况。

【用户今天的主要任务】（共 ${parentTasks.length} 个父类任务，不含子任务）
${taskList}

注意：以下所有诊断都只针对父类任务，不要分析子任务。

【任务扫描结果】（仅统计父类任务）
- 未估时任务数量: ${unestimatedParentCount}
- 工作负载: ${scanResult.workloadLevel === 'light' ? '轻松' : scanResult.workloadLevel === 'medium' ? '适中' : '较重'}

【你的任务】
生成一段**简洁、启发性**的任务诊断，包含三个方面。语气轻松友好，不替用户做决策。

**1. 📝 明确任务诊断**（智能判断，关注"可执行性"）

判断标准——一个任务是否"清晰可执行"，需要满足：
1. **目标明确**：能一眼看出要做什么，不是模糊的动词（如"学习""整理""处理"）
2. **范围可控**：能在一次工作时段内完成，不是需要拆解的大任务
3. **有具体对象**：说明了要操作的具体内容（如"学习Python第3章"而非"学习"）

**哪些任务需要澄清？**
- ❌ 纯动词：「学习」「整理」「准备」「处理」
- ❌ 笼统范围：「完善XXX」「准备XXX」（没说清楚要完善/准备什么方面）
- ❌ 大任务：「写论文」「做项目」（需要拆解）
- ✅ 清晰任务：「计算机网络20年考试卷」「和导师Meeting」「锻炼30分钟」

**有子任务的任务可以不需要澄清**（因为已经被拆解了）

输出要求：
- 如果有需要澄清的任务：简要说明哪些任务可以更具体，并**用"如..."简短提示可以从什么角度补充**
  示例：「完善开发原型」可以更具体～如明确要完善哪些功能
  示例：「学习」「准备材料」可以更具体～如明确学什么、准备什么
- 如果有子任务的任务和简单任务：可以点明"「XXX」有子任务，其他可考虑更具体～"
- 如果大部分清晰：**不输出内容**（留空，直接进入下一部分）
- **绝对不要**批评用户
- 总字数≤50字

**2. ⏱️✂️ 拆分步骤与估算时间诊断**（合并诊断）
重点关注明显复杂/耗时的任务：
- 标题含：论文、报告、项目、开发、会议、准备XX
- 标题>10字
- 已估时>60分钟
- 明显是大任务需要拆解的

输出要求：
- **优先建议拆分步骤**，拆分后顺带提醒估算时间
  示例1：「XX」和「YY」看起来比较复杂，可以考虑拆分步骤并估算下时间？
  示例2：「XX」可以拆分成几个小步骤～估算时间也会更准确
- 如果任务都简单或已拆分/已估时：就说"拆分和估算看起来不错～"
- **不要给原因**（容易变成臆测）
- 用建议式语气："可以考虑..." "要不要..."
- 总字数≤50字

**3. 🎯 优先级诊断**
输出要求：
- 用一个**不带结论**的启发式提问，帮助用户决定先做哪一个（例如：收益/影响、阻力/可启动性、是否能带动后续）。
- **绝对不要**重复任务数量（前面已经说过了）
- **绝对不要**臆想依赖关系（如"A可能是B的前置"）
- **绝对不要**替用户决策（如"建议先做XX"）
- 用建议式语气："可以想想..." "要不要考虑..."
- 总字数≤40字

【输出格式要求】
使用以下结构化格式（每个方面独立段落，用空行分隔）：

📋 今天有 ${parentTasks.length} 个任务！

**📝 明确任务**
[1句话，≤50字，只针对父类任务]

**⏱️✂️ 拆分步骤与估算时间**
[1句话，≤50字，只针对父类任务，优先提拆分建议]

**🎯 安排优先级**
[1句话，≤40字，只针对父类任务]

【注意事项 - ADHD友好】
- 极致简洁：总字数≤150字
- 建议式语气：用"可以考虑""可以想想""要不要"
- 只陈述事实，不臆测原因/依赖关系
- 不替用户做决策，不批评用户
- 不要用 markdown 加粗（除了上面格式中的标题）

请生成诊断：`

  try {
    const response = await doubaoService.sendMessage(prompt)
    
    if (response.success && response.message) {
      return response.message
    }
    
    // LLM 调用失败，使用规则生成降级方案
    return generateFallbackOverview(uncompletedTasks, scanResult)
  } catch (error) {
    console.error('生成概述失败:', error)
    return generateFallbackOverview(uncompletedTasks, scanResult)
  }
}

/**
 * 降级方案：规则生成概述（简洁版）
 * 注意：只统计和分析父类任务（顶层任务）
 */
function generateFallbackOverview(
  tasks: TaskSnapshot[],
  scanResult: ScanResult
): string {
  const lines: string[] = []
  
  // 只检查顶层任务（depth = 0 或 undefined）
  const topLevelTasks = tasks.filter(t => (t.depth ?? 0) === 0)
  
  // 父类任务数量
  lines.push(`📋 今天有 ${topLevelTasks.length} 个任务！`)
  lines.push('')
  
  // 明确任务建议 - 更智能的判断（只针对父类任务）
  lines.push('**📝 明确任务**')
  
  // 找出可能需要澄清的任务（简单规则）
  const vaguePatterns = [
    /^(学习|复习|准备|整理|处理|完成|做|写|弄|搞)$/,  // 纯动词
    /^(完善|优化|改进|更新).{2,6}$/,  // 笼统的"完善XXX"
  ]
  
  // 检查是否有任务有子任务（通过检查是否有 depth > 0 的任务）
  const hasChildTasks = tasks.some(t => (t.depth ?? 0) > 0)
  const tasksWithChildren = hasChildTasks ? topLevelTasks.filter(parent => 
    tasks.some(child => child.parent_task_id === parent.id)
  ) : []
  
  const vagueTasks = topLevelTasks.filter(t => {
    const title = t.title.trim()
    // 有子任务的不算模糊
    if (tasksWithChildren.some(p => p.id === t.id)) return false
    // 匹配模糊模式
    return vaguePatterns.some(p => p.test(title)) || title.length <= 2
  })
  
  if (vagueTasks.length > 0) {
    const vagueNames = vagueTasks.slice(0, 2).map(t => `「${t.title}」`).join('')
    lines.push(`${vagueNames}可以更具体～如明确具体内容`)
    lines.push('')
  } else if (tasksWithChildren.length > 0 && topLevelTasks.length > tasksWithChildren.length) {
    // 有些任务有子任务，其他任务可能需要更具体
    const taskWithChildNames = tasksWithChildren.slice(0, 2).map(t => `「${t.title}」`).join('')
    lines.push(`${taskWithChildNames}有子任务，其他可考虑更具体～`)
    lines.push('')
  }
  // 如果任务都挺清晰，不输出任何内容，直接进入下一部分
  
  // 拆分步骤与估算时间建议（只针对父类任务）
  lines.push('**⏱️✂️ 拆分步骤与估算时间**')
  
  // 找出可能需要拆分的复杂任务
  const complexTasks = topLevelTasks.filter(t => {
    const title = t.title.trim()
    const hasNoChildren = !tasks.some(child => child.parent_task_id === t.id)
    // 标题长 或 包含复杂关键词 且没有子任务
    return hasNoChildren && (
      title.length > 10 ||
      /论文|报告|项目|开发|完善|准备/.test(title)
    )
  })
  
  const unestimatedCount = topLevelTasks.filter(t => !t.estimatedDuration).length
  
  if (complexTasks.length > 0) {
    const complexNames = complexTasks.slice(0, 2).map(t => `「${t.title}」`).join('')
    lines.push(`${complexNames}可以考虑拆分步骤～估算时间也会更准确`)
  } else if (unestimatedCount > 0) {
    lines.push(`有 ${unestimatedCount} 个任务可以考虑估算下时间？`)
  } else {
    lines.push(`拆分和估算看起来不错～`)
  }
  lines.push('')
  
  // 优先级建议（只针对父类任务）
  lines.push('**🎯 安排优先级**')
  if (topLevelTasks.length > 1) {
    lines.push(`可以想想：先做哪个任务最“好启动”，又能带动后续？`)
  } else {
    lines.push(`今天任务不多，按自己的节奏来～`)
  }
  
  return lines.join('\n')
}

// ==================== 任务哈希与个性化问候 ====================

/**
 * 生成任务列表的哈希值
 * 用于判断任务是否有变化
 */
export function generateTaskHash(tasks: TaskSnapshot[]): string {
  // 只取关键信息生成哈希：任务ID、标题、完成状态
  const taskSignatures = tasks
    .filter(t => !t.isCompleted) // 只关注未完成任务
    .map(t => `${t.id}|${t.title}|${t.isCompleted}`)
    .sort() // 排序保证顺序一致
    .join(';;')
  
  // 简单的哈希：使用字符串长度和前几个字符
  // 不需要加密级别的哈希，只需要检测变化
  return `${taskSignatures.length}-${taskSignatures.slice(0, 100)}`
}

/**
 * 生成 AI 个性化问候（任务没变化时使用）
 * 
 * 返回一个简短的、与任务相关的问候语
 */
export async function generatePersonalizedGreeting(
  tasks: TaskSnapshot[]
): Promise<string> {
  const uncompletedTasks = tasks.filter(t => !t.isCompleted)
  const parentTasks = uncompletedTasks.filter(t => (t.depth ?? 0) === 0)
  
  // 如果没有任务
  if (parentTasks.length === 0) {
    return '👋 欢迎回来！今天还没有任务，要不要添加一些？'
  }
  
  // 取前 3 个任务名作为上下文
  const taskNames = parentTasks.slice(0, 3).map(t => t.title).join('、')
  
  const prompt = `你是一个轻松友好的任务管理助手。用户刚刚再次打开了任务面板，他们今天的主要任务有：${taskNames}

请生成一句**轻松、不催促、像朋友聊天**的问候语。

要求：
1. 必须提到具体的任务名（至少一个）
2. 语气随意轻松，**不要给人施加压力或催促的感觉**
3. 避免"进展""完成""都...了吧"这类检查式语气
4. 可以用"怎么样""有意思吗""还在弄吗"这类轻松的问法
5. 可以用一个相关的 emoji 开头
6. **总字数不超过 20 个字**
7. 用"～"或"吗"或"呀"结尾（轻松自然）

示例（轻松友好，不催促）：
- 💭 「${parentTasks[0]?.title}」还在弄吗～
- 😊 「${parentTasks[0]?.title}」怎么样呀～
- ✨ 今天「${parentTasks[0]?.title}」顺利不～
- 🎯 回来啦～「${parentTasks[0]?.title}」有意思吗

直接输出问候语，不要其他内容：`

  try {
    const response = await doubaoService.sendMessage(prompt)
    
    if (response.success && response.message) {
      const greeting = response.message.trim()
      // 如果 AI 返回内容太长，使用降级方案
      if (greeting.length > 40) {
        return generateFallbackGreeting(parentTasks)
      }
      return greeting
    }
    
    return generateFallbackGreeting(parentTasks)
  } catch (error) {
    console.error('生成个性化问候失败:', error)
    return generateFallbackGreeting(parentTasks)
  }
}

/**
 * 降级方案：预设模板问候（轻松友好，不催促）
 */
function generateFallbackGreeting(tasks: TaskSnapshot[]): string {
  const taskName = tasks[0]?.title || '任务'
  const templates = [
    `💭 「${taskName}」还在弄吗～`,
    `😊 「${taskName}」怎么样呀～`,
    `✨ 今天「${taskName}」顺利不～`,
    `🎯 回来啦～「${taskName}」有意思吗`,
    `👋 「${taskName}」继续搞呀～`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
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
 * 
 * 优先使用 depth 字段（来自笔记缩进）：
 * - depth = 0 或 undefined：顶层任务
 * - depth >= 1：子任务
 * 
 * 如果没有 depth 信息，则回退到基于标题的启发式判断
 */
function identifyTopLevelTasks(tasks: TaskSnapshot[]): TaskSnapshot[] {
  if (tasks.length <= 1) return tasks
  
  // 检查是否有 depth 信息
  const hasDepthInfo = tasks.some(t => t.depth !== undefined && t.depth > 0)
  
  if (hasDepthInfo) {
    // 使用 depth 字段过滤：只保留 depth = 0 或 undefined 的任务
    const topLevelTasks = tasks.filter(task => (task.depth ?? 0) === 0)
    console.log(`🔍 使用 depth 过滤：${tasks.length} 个任务 → ${topLevelTasks.length} 个顶层任务`)
    return topLevelTasks.length > 0 ? topLevelTasks : tasks
  }
  
  // 回退：基于标题的启发式判断（兼容旧数据）
  console.log('🔍 没有 depth 信息，使用启发式判断')
  
  // 子任务模式：以动词开头 + 包含共享关键词
  const titles = tasks.map(t => t.title)
  const keywordCounts: Map<string, number> = new Map()
  
  for (const title of titles) {
    const keywords = title.match(/[\u4e00-\u9fa5]{2,6}/g) || []
    for (const keyword of keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1)
    }
  }
  
  const sharedKeywords = new Set(
    Array.from(keywordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([keyword]) => keyword)
  )
  
  const subtaskVerbPatterns = /^(制定|准备|执行|完成|整理|记录|调整|检查|确认|安排|规划|设置|进行|开始|结束|收拾|清理|购买|下载|安装|配置|测试|验证|提交|发送|回复|联系|预约|取消)/
  
  const isSubtask = (title: string): boolean => {
    if (title.length <= 4) return false
    const startsWithVerb = subtaskVerbPatterns.test(title)
    const containsSharedKeyword = Array.from(sharedKeywords).some(kw => 
      title !== kw && title.length > kw.length + 2 && title.includes(kw)
    )
    return startsWithVerb && containsSharedKeyword
  }
  
  const topLevelTasks = tasks.filter(task => !isSubtask(task.title))
  return topLevelTasks.length > 0 ? topLevelTasks : tasks
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
    // 过滤出顶层任务（非子任务）
    const topLevelTasks = identifyTopLevelTasks(uncompletedTasks)
    const topLevelTaskList = topLevelTasks
      .map(t => {
        const parts = [`「${t.title}」`]
        if (t.estimatedDuration) parts.push(`${t.estimatedDuration}分钟`)
        if (t.deadline) parts.push(`截止: ${t.deadline}`)
        return parts.join(' | ')
      })
      .join('\n')
    
    const taskNames = topLevelTasks.map(t => t.title)

    return `你是一个专业的元认知教练，帮助 ADHD 用户更好地理解任务以便开始执行。
你的目标是**唤醒用户的任务认知（Task Awareness）**，让用户从"写下任务"进化到"真正理解任务"。

【用户的主要任务】（共 ${taskNames.length} 个，只关注这些顶层任务）
${topLevelTaskList}
${previousContext}
【核心原则】
你的问题必须**贴合任务的具体场景**，帮助用户更好地理解这个任务。
- 不同类型的任务，关键问题不同
- 问题要让用户"啊，我没想到这个"，而不是"这不是废话吗"

【任务类型与关键问题】

**会议/沟通类**（如 Meeting、汇报、讨论）：
- 关键是**目标**和**准备**："这次 Meeting 你想达成什么？有没有想好要说的核心点？"
- 关键是**预期管理**："导师/对方可能会问什么？你准备好怎么回应了吗？"

**学习/研究类**（如 学习、复习、看论文）：
- 关键是**边界**："今天学习的具体目标是什么？学到什么程度算完成？"
- 关键是**方法**："你打算怎么学？是看视频、做题、还是整理笔记？"

**运动/健康类**（如 锻炼、跑步、健身）：
- 关键是**启动**："什么时候开始？需要换衣服/出门吗？"
- 关键是**动力**："今天状态怎么样？是想好好练还是轻松动一动？"

**工作/任务类**（如 做TA、写报告、改代码）：
- 关键是**范围**："今天要做到什么程度？有没有明确的交付物？"
- 关键是**卡点**："有没有什么地方可能会卡住？需要查资料或问人吗？"

**生活/杂事类**（如 买菜、收拾、取快递）：
- 这类任务通常不需要深入反思，简单确认即可

【问题生成策略】

⚠️ **3 个问题要尽量覆盖不同的任务**

**维度 1：任务边界（Task Boundary）**
- 目的：帮用户明确"做到什么程度算完成"
- 好问题："「和导师Meeting」你想达成什么？是汇报进度、讨论问题、还是拿到反馈？"
- 坏问题："「和导师Meeting」对你来说，做到什么程度算完成？"（太模板化）

**维度 2：约束与依赖（Constraints & Dependencies）**
- 目的：帮用户识别"能不能现在就开始"
- 好问题："「和导师Meeting」之前，你需要准备什么材料或想好什么问题吗？"
- 坏问题："「锻炼」之前，有没有必须先准备好的东西？"（对锻炼来说不是关键）

**维度 3：启动障碍（Activation Barrier）**
- 目的：帮用户找到"第一步"或识别"阻力"
- 好问题："「锻炼」你打算什么时候开始？现在的状态适合动起来吗？"
- 坏问题："「锻炼」你一直没开始，是因为太难、太无聊、还是怕做不好？"（锻炼不是怕做不好）

**维度 4：风险预判（Risk Anticipation）**
- 目的：帮用户提前想到"可能出问题的地方"
- 好问题："「做TA」如果学生问了你不会的问题，你打算怎么处理？"
- 坏问题："「和导师Meeting」如果比预想的复杂，你打算怎么办？"（Meeting 的风险不是"复杂"）

**❌ 绝对禁止（Don't）：**
1. **不要套模板**：不要用"做到什么程度算完成"、"有没有准备好的东西"这种万能句式
2. **不要问不相关的维度**：锻炼不需要问"准备资料"，Meeting 不需要问"怕做不好"
3. **不要猜具体场景**：不要问"是去健身房还是在家？"
4. **不要问子任务**：只关注主要任务（${taskNames.join('、')}）

**✅ 必须坚持（Do）：**
1. **贴合任务场景**：根据任务类型选择最相关的问题角度
2. **问题要有洞察**：让用户觉得"这个问题问到点子上了"
3. **3 个问题覆盖不同任务**（如果只有 1 个任务，则问不同维度）
4. **hint 要解释问题的意图**：帮用户理解为什么问这个问题

【额外任务：识别需要拆解的任务】
请同时判断哪些任务**可能需要拆解**。判断标准：
- 任务范围太大，一次做不完（如"写论文"、"准备考试"）
- 任务包含多个独立步骤（如"准备Meeting"可能包括做PPT、整理数据等）
- 任务复杂度高，不知从何下手

注意：简单、清晰、一步到位的任务（如"锻炼"、"买菜"、"回复邮件"）不需要拆解。

【输出格式】
返回 JSON 对象：
{
  "questions": [
    { "text": "问题内容（贴合任务场景，提到具体任务名称）", "hint": "这个问题帮用户理解什么（如：明确沟通目标、识别准备工作、找到启动点）" }
  ],
  "tasksToDecompose": ["任务标题1", "任务标题2"]
}

⚠️ **严格要求**：
- questions 数组必须包含恰好 3 个问题，不能多也不能少
- 每个问题都必须贴合任务场景，覆盖不同任务或维度
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
    
    return `你是一个专业的元认知教练。在估算时间层面，你的目标是帮助用户**克服规划谬误（Planning Fallacy）**和**时间盲区（Time Blindness）**。

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

3. **风险与应对（Risk & Response）**：
   - "如果[主要任务]中间出了点小岔子（比如被打断），你打算怎么办？"
   - "这会影响你其他任务的安排吗？"

4. **整体时间分配（Time Allocation）**：
   - "今天这几个任务加起来，时间够用吗？有没有需要调整的？"

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "问题内容", "hint": "元认知意图（如：参考过往经验、识别隐形依赖、应对意外）" }
]

只返回 JSON，不要其他内容。`

  } else if (round === 'priority') {
    // 过滤出顶层任务
    const topLevelTasks = identifyTopLevelTasks(uncompletedTasks)
    const taskNames = topLevelTasks.map(t => t.title)
    
    // 构建任务详情信息，让 AI 理解每个任务的特点
    const taskDetailsForAI = topLevelTasks.map(t => {
      const details: string[] = [`「${t.title}」`]
      if (t.deadline) details.push(`截止日期: ${t.deadline}`)
      if (t.estimatedDuration) details.push(`预估时长: ${t.estimatedDuration}分钟`)
      if (t.priority) details.push(`当前优先级: ${t.priority}`)
      return details.join(' | ')
    }).join('\n')
    
    // 分析任务特征，用于生成更精准的问题
    const hasDeadlineTasks = topLevelTasks.filter(t => t.deadline)
    const longTasks = topLevelTasks.filter(t => t.estimatedDuration && t.estimatedDuration > 60)
    const shortTasks = topLevelTasks.filter(t => t.estimatedDuration && t.estimatedDuration <= 30)
    
    return `你是一个专业的元认知教练，帮助用户使用**艾森豪威尔四象限矩阵**思考任务优先级。

【四象限矩阵说明】
- 🔴 紧急+重要：立即做（如即将到期的重要任务）
- 🟡 重要+不紧急：安排时间做（如长期目标、能力提升）
- 🟠 紧急+不重要：尽量委托或快速处理（如临时琐事）
- ⚪ 不紧急+不重要：考虑是否真的需要做

【用户的任务详情】
${taskDetailsForAI}

【任务分析】
- 共 ${topLevelTasks.length} 个主要任务
${hasDeadlineTasks.length > 0 ? `- 有截止日期的: ${hasDeadlineTasks.map(t => `「${t.title}」`).join('、')}` : '- 目前没有任务设置截止日期'}
${longTasks.length > 0 ? `- 耗时较长(>1小时): ${longTasks.map(t => `「${t.title}」`).join('、')}` : ''}
${shortTasks.length > 0 ? `- 可快速完成(≤30分钟): ${shortTasks.map(t => `「${t.title}」`).join('、')}` : ''}
${scanResult.deadlineConflicts.length > 0 ? `- ⚠️ 需要关注的 deadline: ${scanResult.deadlineConflicts.join(', ')}` : ''}
${previousContext}

【你的目标】
生成 **3 个个性化问题**，帮助用户判断每个任务应该放在四象限的哪个位置。

**问题类型（根据任务特点选择最合适的）：**

1. **「重要性」判断问题**（帮用户区分"重要"vs"紧急"）
   - "「${taskNames[0] || '任务'}」做完后，对你接下来一周/一个月的工作有什么帮助？" 
   - "「${taskNames[0] || '任务'}」是为了解决眼前的问题，还是为了长远的目标？"
   - "如果「${taskNames[0] || '任务'}」这周都不做，一个月后会有什么影响？"

2. **「紧迫性」判断问题**（帮用户识别真假紧急）
   - "「${taskNames[0] || '任务'}」的"紧急感"是来自外部（别人在等、有 deadline），还是来自你内心的焦虑？"
   - "「${taskNames[0] || '任务'}」如果推迟到明天/后天，会有什么具体的后果？"
   - "${hasDeadlineTasks.length > 0 ? `「${hasDeadlineTasks[0].title}」有截止日期，但截止前一定要全部完成吗，还是可以分阶段交付？` : `这些任务里，哪个是真的有"别人在等"的外部压力？`}"

3. **「权衡对比」问题**（帮用户在多个任务间做选择）
   - "「${taskNames[0] || '任务A'}」和「${taskNames[1] || '任务B'}」，如果今天只能做一个，你觉得哪个做完后心里会更踏实？"
   - "这些任务里，哪个是你一直想做但总是被其他事情挤掉的？（这可能是重要但不紧急的任务）"
   - "${longTasks.length > 0 && shortTasks.length > 0 ? `「${shortTasks[0].title}」只需要 ${shortTasks[0].estimatedDuration} 分钟，先做完它会不会让你更有精力处理「${longTasks[0].title}」？` : '如果先做个小任务热身，你会选哪个？'}"

4. **「隐藏依赖」识别问题**
   - "做完「${taskNames[0] || '任务A'}」，会不会让「${taskNames[1] || '任务B'}」变得更容易或更清晰？"
   - "这些任务里，哪个需要等别人的输入或反馈？（可能需要先启动）"

**⚠️ 注意事项：**
- 必须使用具体的任务名称，不要用"任务A"这种泛称
- 根据任务的实际特点（是否有 deadline、时长、子任务数）来定制问题
- 问题要能帮助用户判断：这个任务是紧急/不紧急？是重要/不重要？
- 不要问空洞的"哪个更重要"，要通过具体场景帮用户思考

【输出格式】
返回 JSON 数组（严格 3 个问题）：
[
  { "text": "个性化问题（提到具体任务名称和特点）", "hint": "这个问题帮助判断什么（如：判断紧迫性、判断重要性、权衡对比）" }
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
      console.warn('⚠️ 使用降级问题库')
      
      // 降级：返回预定义的问题
      return {
        round,
        questions: FALLBACK_QUESTIONS[round],
        title: `${config.emoji} ${config.title}`,
        description: config.description,
        tasksToDecompose: undefined
      }
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
      console.warn('⚠️ 使用降级问题库')
      // 降级：使用预定义的降级问题（确保有3个）
      questions = FALLBACK_QUESTIONS[round]
    }
    
    console.log(`✅ 生成了 ${questions.length} 个问题`)
    
    // ⭐ 确保至少有3个问题（使用降级问题补充）
    if (questions.length < 3) {
      console.warn(`⚠️ 只生成了 ${questions.length} 个问题，使用降级问题补充到3个`)
      const fallbackQuestions = FALLBACK_QUESTIONS[round]
      
      // 补充问题（避免重复）
      for (let i = questions.length; i < 3; i++) {
        if (fallbackQuestions[i]) {
          questions.push(fallbackQuestions[i])
        }
      }
      
      console.log(`✅ 补充后共 ${questions.length} 个问题`)
    }
    
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

// ==================== 时间规划问题生成 ====================

/**
 * 为选定的任务生成估算时间反思问题（1-3个）
 * 
 * 聚焦于帮助用户校准时间估计、识别隐形依赖、应对意外
 * 
 * @param tasks 用户选择的任务列表（通常是单个任务）
 * @returns 问题字符串数组
 */
export async function generateTimeQuestions(tasks: TaskSnapshot[]): Promise<string[]> {
  try {
    if (tasks.length === 0) {
      return ['今天这些任务加起来，时间够用吗？有没有需要调整的？']
    }

    const task = tasks[0] // 通常只选择一个任务
    
    // 构建任务信息
    const taskInfo = `
任务名称：${task.title}
${task.estimatedDuration ? `已估时长：${task.estimatedDuration}分钟` : '未估时'}
${task.deadline ? `截止时间：${task.deadline}` : '无截止时间'}
`.trim()

    const systemPrompt = `你是一位擅长时间管理的智能助手。你的目标是：通过 1-3 个精准的开放式问题，帮助用户**校准时间估计**、**识别隐形依赖**、**应对意外情况**。

### 【核心分析框架】

基于任务性质，从以下角度诊断估算时间的盲点：

**1. 参考类预测（Reference Class）**
   - 用户过去做类似任务时，实际花费的时间是否比预想的长？
   - 用户是否容易低估某些环节的时间？

**2. 隐形依赖与瓶颈（Hidden Dependencies）**
   - 任务开始前，是否需要等待他人回复或准备材料？
   - 任务中是否有前置步骤没有算进时间？

**3. 风险与应对（Risk & Response）**
   - 如果任务中间出现意外（被打断、遇到问题），你打算怎么办？
   - 会影响其他任务的安排吗？

**4. 整体时间分配（Time Allocation）**
   - 所有任务加起来，时间是否够用？
   - 是否需要调整优先级或减少任务？

### 【问题生成策略】

**灵活性原则**：
- 根据任务性质，**动态选择 1-3 个最关键的角度**
- 如果任务已有估时且看起来合理，可以问"是否考虑过意外情况"
- 如果任务没有估时，优先问"过去类似任务花了多久"
- 如果任务很简单，可能只需要 1 个问题
- **总问题数控制在 1-3 个**

**问题设计要点**：
- 每问只问一件事，句式简短（15-30字）
- 开放式问句（用"什么/如何/哪些/多久"开头）
- 贴合任务实际情境，使用任务相关的具体术语
- 避免抽象概念，聚焦可观察、可量化的信息
- 引导用户回忆过往经验，而不是凭空猜测

### 【严格禁止】

❌ 不要问"今天有多少时间"（用户通常高估可用时间）
❌ 不要问"哪个任务最长"（这通常显而易见）
❌ 不要问子任务（只关注主要任务）
❌ 是/否题、情绪题（如"难吗""有信心吗"）
❌ 显而易见的问题
❌ 为了凑数而问的无关问题

### 【ADHD友好原则】

- 温和、鼓励、非评判性语气（避免"你应该""必须""为什么不"）
- 降低启动焦虑，引导"可能需要多久"而非"为什么没估时"
- 问题顺序符合自然思考流程（先回忆经验，再识别依赖，最后考虑风险）

### 【输出格式】（严格遵守）

- 输出 1-3 行问题（根据任务复杂度灵活调整）
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本

### 【成功标准】

用户回答后，应能让AI获得：
✓ 任务的实际时间需求（基于过往经验）
✓ 潜在的时间陷阱和依赖
✓ 任务执行中可能出现的不确定因素和应对措施`

    const userPrompt = `请基于以下任务信息，生成 1-3 个能有效帮助用户校准时间估计的问题：

${taskInfo}

请直接输出问题列表，每行以"- "开头。`

    const response = await doubaoService.sendMessage(
      `${systemPrompt}\n\n${userPrompt}`
    )

    if (!response.success || !response.message) {
      console.error('❌ 生成估算时间问题失败:', response.error)
      // 降级：返回通用问题
      return [
        `回想一下上次做类似「${task.title}」的时候，实际花费的时间是不是比预想的要长？`,
        `做「${task.title}」之前，是不是需要等别人的回复或准备什么？`,
        `如果「${task.title}」中间出了点小岔子，你现在的计划有弹性吗？`
      ]
    }

    // 解析问题（每行以"- "开头）
    console.log('🔍 LLM 返回的原始消息:', response.message)
    
    const questions = response.message
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2).trim())
      .filter(q => q.length > 0)

    console.log('🔍 解析后的问题:', questions)

    if (questions.length === 0) {
      console.warn('⚠️ 未能解析出问题，使用降级方案')
      return [
        `回想一下上次做类似「${task.title}」的时候，实际花费的时间是不是比预想的要长？`,
        `做「${task.title}」之前，是不是需要等别人的回复或准备什么？`
      ]
    }

    console.log(`✅ 生成了 ${questions.length} 个估算时间问题`)
    return questions.slice(0, 3) // 最多返回3个

  } catch (error) {
    console.error('❌ 生成估算时间问题失败:', error)
    // 降级：返回通用问题
    const taskTitle = tasks[0]?.title || '这个任务'
    return [
      `回想一下上次做类似「${taskTitle}」的时候，实际花费的时间是不是比预想的要长？`,
      `做「${taskTitle}」之前，是不是需要等别人的回复或准备什么？`
    ]
  }
}

// ==================== 优先级问题生成 ====================

/**
 * 为选定的任务生成优先级反思问题（1-3个）
 * 
 * 聚焦于帮助用户在矩阵中定位任务，通过后果对比、紧迫度校准、依赖关系等角度
 * 
 * @param tasks 用户选择的任务列表（通常是多个任务，至少2个）
 * @param matrixContext 可选的矩阵上下文，包含当前维度和已分类任务
 * @returns 问题字符串数组
 */
export async function generatePriorityQuestions(
  tasks: TaskSnapshot[], 
  matrixContext?: MatrixContextForPriority
): Promise<string[]> {
  try {
    if (tasks.length === 0) {
      return ['这几个任务里，哪个有真正的外部 deadline（比如别人在等）？']
    }

    const taskNames = tasks.map(t => t.title)
    const taskList = tasks.map(t => `「${t.title}」`).join('、')
    
    // 构建任务信息
    let taskInfo = `
待分类任务：${taskList}
任务数量：${tasks.length} 个
${tasks.some(t => t.deadline) ? `有截止时间的任务：${tasks.filter(t => t.deadline).map(t => `「${t.title}」(${t.deadline})`).join('、')}` : ''}
`.trim()

    // 如果有矩阵上下文，添加维度和已分类任务信息
    let matrixInfo = ''
    if (matrixContext) {
      const { axes, quadrants } = matrixContext
      matrixInfo = `

【当前矩阵维度】
- X轴：${axes.xAxis.name}（${axes.xAxis.lowLabel} ← → ${axes.xAxis.highLabel}）
- Y轴：${axes.yAxis.name}（${axes.yAxis.lowLabel} ↑ ↓ ${axes.yAxis.highLabel}）

【已分类的任务作为参考锚点】
${quadrants.topRight.tasks.length > 0 ? `- ${quadrants.topRight.label}：${quadrants.topRight.tasks.map(t => `「${t}」`).join('、')}` : ''}
${quadrants.topLeft.tasks.length > 0 ? `- ${quadrants.topLeft.label}：${quadrants.topLeft.tasks.map(t => `「${t}」`).join('、')}` : ''}
${quadrants.bottomRight.tasks.length > 0 ? `- ${quadrants.bottomRight.label}：${quadrants.bottomRight.tasks.map(t => `「${t}」`).join('、')}` : ''}
${quadrants.bottomLeft.tasks.length > 0 ? `- ${quadrants.bottomLeft.label}：${quadrants.bottomLeft.tasks.map(t => `「${t}」`).join('、')}` : ''}
${[quadrants.topRight, quadrants.topLeft, quadrants.bottomRight, quadrants.bottomLeft].every(q => q.tasks.length === 0) ? '- （暂无已分类任务）' : ''}
`.trim()
    }

    const systemPrompt = `你是一位擅长优先级管理的智能助手。你的目标是：通过 1-3 个精准的**开放式问题**，帮助用户**判断任务应该放在矩阵的哪个象限**。
${matrixContext ? `
【重要】用户正在使用 ${matrixContext.axes.yAxis.name} × ${matrixContext.axes.xAxis.name} 矩阵来分类任务，问题应聚焦于这两个维度。
` : ''}
### 【核心分析框架】

根据任务性质和矩阵维度，从以下角度帮助用户判断优先级（选择最相关的 1-3 个）：

**【优先】任务之间的对比（重点）**
   - **重点对比用户勾选的多个任务之间的关系**
   - 引导用户思考相对优先级，而不是绝对优先级

**1. 后果对比（Consequence Comparison）**
   - 在用户勾选的任务中，引导思考"如果不做会怎样"
   - 示例：「项目报告」和「数据分析」如果今天只能做一个，不做哪个明天会更麻烦？

**2. 紧迫度/时间维度**
   - ⚠️ **注意：只在任务有明确截止时间时才问时间相关问题**
   - 区分"真的紧急"和"感觉紧急"
   - 示例：「论文修改」和「PPT准备」，哪个的截止时间更不能推迟？为什么？

**3. 重要性/价值维度**
   - 在用户勾选的任务中对比价值和影响
   - 示例：「学习Python」和「写周报」，哪个对你当前最重要的目标影响更大？具体是什么影响？

**4. 依赖关系**
   - 识别用户勾选任务之间的先后顺序
   - 示例：在「数据分析」和「写报告」中，做完哪个会让另一个变得更容易？

**5. 参考已分类任务**（仅作为辅助）
   - ⚠️ **已分类任务只是参考锚点，不是重点**
   - 示例：和已经放在"重要紧急"的「XXX」比，「新任务A」和「新任务B」的紧迫性分别如何？

### 【问题设计原则】

**必须遵守**：
✅ **开放式问题**：用"什么/哪些/如何/多大程度"等词引导思考
✅ **引导对比**：让用户描述差异而非做选择
✅ **具体任务名**：每个问题必须包含「任务名」
✅ **简短精准**：15-30字，每问只问一件事

**绝对禁止**：
❌ **Yes/No 问题**：如"是不是""有没有""合理吗""需要吗"
❌ **给出答案让用户确认**：如"放在XX象限，你觉得合理吗？"
❌ **任务启动类问题**：如"为什么一直没做""是否在逃避"（这不属于优先级判断）
❌ **泛泛而问**：如"哪个重要""先做哪个"
❌ **情绪评判**：如"难吗""有信心吗"

### 【开放式 vs 封闭式示例】

| 维度 | ❌ 封闭式（禁止）| ✅ 开放式（推荐）|
|------|----------------|-----------------|
| 紧迫度 | 「任务A」紧急吗？ | 「任务A」的截止时间是怎么确定的？ |
| 重要性 | 「任务A」重要吗？ | 「任务A」对你当前最重要的目标有什么影响？ |
| 定位 | 放在"重要紧急"合理吗？ | 和「已分类任务」相比，「新任务」的紧迫程度怎么样？ |
| 后果 | 不做会有问题吗？ | 如果今天不做「任务A」，明天会面临什么情况？ |

### 【ADHD友好原则】

- 温和、鼓励的语气
- 降低决策焦虑，不问"为什么没做"
- 问题顺序自然（先后果，再对比，最后定位）

### 【输出格式】（严格遵守）

- 输出 1-3 行问题
- 每行以"- "开头
- 不添加任何说明、编号、标题
- **每个问题必须是开放式的，包含具体任务名称**`

    const userPrompt = `请基于以下信息，生成 1-3 个能有效帮助用户在矩阵中定位任务的开放式问题：

${taskInfo}
${matrixInfo}

【重要提示】：
1. **主要对比用户勾选的任务之间的关系**（而不是和已分类任务对比）
2. **已分类任务只是参考锚点**，不要作为问题的主要对比对象
3. **如果任务没有截止时间信息，不要问截止时间相关的问题**
4. 所有问题必须是开放式的（用"什么/哪些/如何/多大程度/哪个"引导）
5. 绝对不要问 Yes/No 问题或给出答案让用户确认
6. 每个问题必须包含具体任务名称（用「」包裹）

请直接输出问题列表，每行以"- "开头。`

    const response = await doubaoService.sendMessage(
      `${systemPrompt}\n\n${userPrompt}`
    )

    if (!response.success || !response.message) {
      console.error('❌ 生成优先级问题失败:', response.error)
      // 降级：返回通用开放式问题
      if (taskNames.length >= 2) {
        const fallbackQuestions = [
          `「${taskNames[0]}」和「${taskNames[1]}」如果今天只能做一个，不做哪个明天会面临什么情况？`
        ]
        // 只在有截止时间的任务时才问时间相关问题
        if (tasks.some(t => t.deadline)) {
          fallbackQuestions.push(`这几个任务里，哪个的截止时间是外部确定的（比如别人在等）？`)
        } else {
          fallbackQuestions.push(`「${taskNames[0]}」和「${taskNames[1]}」对你当前最重要的目标，哪个影响更大？`)
        }
        return fallbackQuestions
      } else {
        return [`「${taskNames[0] || '这个任务'}」如果今天不做，明天会面临什么情况？`]
      }
    }

    // 解析问题（每行以"- "开头）
    console.log('🔍 LLM 返回的原始消息:', response.message)
    
    const questions = response.message
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2).trim())
      .filter(q => q.length > 0)

    console.log('🔍 解析后的问题:', questions)

    if (questions.length === 0) {
      console.warn('⚠️ 未能解析出问题，使用降级方案')
      if (taskNames.length >= 2) {
        const fallbackQuestions = [
          `「${taskNames[0]}」和「${taskNames[1]}」如果今天只能做一个，不做哪个明天会面临什么情况？`
        ]
        // 只在有截止时间的任务时才问时间相关问题
        if (tasks.some(t => t.deadline)) {
          fallbackQuestions.push(`这几个任务里，哪个的截止时间是外部确定的（比如别人在等）？`)
        } else {
          fallbackQuestions.push(`「${taskNames[0]}」和「${taskNames[1]}」对你当前最重要的目标，哪个影响更大？`)
        }
        return fallbackQuestions
      } else {
        return [`「${taskNames[0] || '这个任务'}」如果今天不做，明天会面临什么情况？`]
      }
    }

    console.log(`✅ 生成了 ${questions.length} 个优先级问题`)
    return questions.slice(0, 3) // 最多返回3个

  } catch (error) {
    console.error('❌ 生成优先级问题失败:', error)
    // 降级：返回通用开放式问题
    const taskNames = tasks.map(t => t.title)
    if (taskNames.length >= 2) {
      const fallbackQuestions = [
        `「${taskNames[0]}」和「${taskNames[1]}」如果今天只能做一个，不做哪个明天会面临什么情况？`
      ]
      // 只在有截止时间的任务时才问时间相关问题
      if (tasks.some(t => t.deadline)) {
        fallbackQuestions.push(`这几个任务里，哪个的截止时间是外部确定的（比如别人在等）？`)
      } else {
        fallbackQuestions.push(`「${taskNames[0]}」和「${taskNames[1]}」对你当前最重要的目标，哪个影响更大？`)
      }
      return fallbackQuestions
    } else {
      return [`「${taskNames[0] || '这个任务'}」如果今天不做，明天会面临什么情况？`]
    }
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

