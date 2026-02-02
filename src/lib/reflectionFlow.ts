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
// 🆕 历史上下文相关类型
import type { RecentTaskHistoryItem, TaskFamilyContext } from '@/lib/dailyTasks'
import type { RecentReflectionItem } from '@/lib/dailyReflections'
// 🆕 用户画像类型（用于个性化问题生成）
import type { UserProfile } from '@/types'

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
    title: '明确/拆分任务',
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
  previousResponses?: string[],
  reflectionContext?: ReflectionContext  // 🆕 历史上下文
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
  
  // 🆕 历史上下文（纵向感知）
  const historyContext = reflectionContext 
    ? formatContextForPrompt(reflectionContext, uncompletedTasks[0]?.title)
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
${historyContext}
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
${historyContext}
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
${historyContext}
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

// ==================== 🆕 历史上下文构建（纵向感知） ====================

/**
 * 反思上下文（注入到 Prompt 中）
 */
export interface ReflectionContext {
  // 当前任务信息
  currentTask: {
    title: string
    isSubtask: boolean
    parentTitle: string | null
    siblings: string[]
  } | null
  
  // 历史上下文（过去3天）
  recentHistory: RecentTaskHistoryItem[]
  
  // 用户过去的反思问答（精选）
  previousQAPairs: {
    date: string
    dayLabel: string
    question: string
    answer: string
  }[]
  
  // AI 总结（如果有）
  previousSummaries: {
    date: string
    dayLabel: string
    summary: string
  }[]
}

/**
 * 构建完整的反思上下文
 * @param currentTask 当前选中的任务（可选，用于单任务反思）
 * @param taskFamily 任务家族上下文（父子关系）
 * @param recentHistory 过去N天的任务历史
 * @param recentReflections 过去N天的反思记录
 * @returns 完整的反思上下文对象
 */
export function buildReflectionContext(
  currentTask: TaskSnapshot | null,
  taskFamily: TaskFamilyContext | null,
  recentHistory: RecentTaskHistoryItem[],
  recentReflections: RecentReflectionItem[]
): ReflectionContext {
  // 1. 构建当前任务上下文
  let currentTaskContext: ReflectionContext['currentTask'] = null
  if (currentTask && taskFamily) {
    currentTaskContext = {
      title: currentTask.title,
      isSubtask: taskFamily.hasParent,
      parentTitle: taskFamily.parent?.title || null,
      siblings: taskFamily.siblings.map(s => s.title)
    }
  }
  
  // 2. 提取有效的问答对
  const previousQAPairs: ReflectionContext['previousQAPairs'] = []
  recentReflections.forEach(reflection => {
    reflection.questions.forEach((question, index) => {
      const answer = reflection.answers[index]
      if (question && answer) {
        previousQAPairs.push({
          date: reflection.date,
          dayLabel: reflection.dayLabel,
          question,
          answer
        })
      }
    })
  })
  
  // 3. 提取 AI 总结
  const previousSummaries: ReflectionContext['previousSummaries'] = recentReflections
    .filter(r => r.summary)
    .map(r => ({
      date: r.date,
      dayLabel: r.dayLabel,
      summary: r.summary!
    }))
  
  return {
    currentTask: currentTaskContext,
    recentHistory,
    previousQAPairs,
    previousSummaries
  }
}

/**
 * 将反思上下文格式化为 Prompt 文本
 * @param context 反思上下文
 * @param currentTaskTitle 当前任务标题（用于查找相似任务）
 * @returns 格式化的 Prompt 文本段落
 */
export function formatContextForPrompt(
  context: ReflectionContext,
  currentTaskTitle?: string
): string {
  const lines: string[] = []
  
  // 1. 近期历史（不强调完成状态，因为用户可能完成了但没勾选）
  if (context.recentHistory.length > 0) {
    lines.push('【📅 近期任务历史（过去3天）】')
    lines.push('（注意：这里只是记录用户安排过的任务，不代表实际完成情况）')
    context.recentHistory.forEach(day => {
      lines.push(`▸ ${day.dayLabel}（${day.date}）：`)
      day.tasks.forEach(task => {
        const parentInfo = task.parentTitle ? `（属于「${task.parentTitle}」）` : ''
        lines.push(`  - 「${task.title}」${parentInfo}`)
      })
    })
    lines.push('')
  }
  
  // 2. 用户过去的反思回答（最多取3条最相关的）
  if (context.previousQAPairs.length > 0) {
    lines.push('【💬 用户近期反思摘录】')
    // 取最近的3条
    const recentPairs = context.previousQAPairs.slice(0, 3)
    recentPairs.forEach(pair => {
      lines.push(`▸ ${pair.dayLabel}：`)
      lines.push(`  Q: "${pair.question}"`)
      lines.push(`  A: "${pair.answer}"`)
    })
    lines.push('')
  }
  
  // 3. 当前任务的父子关系（如果是子任务）
  if (context.currentTask?.isSubtask) {
    lines.push('【🌳 当前任务层级】')
    lines.push(`当前选择的任务：「${context.currentTask.title}」`)
    lines.push(`├── 父任务：「${context.currentTask.parentTitle}」`)
    if (context.currentTask.siblings.length > 0) {
      lines.push(`└── 兄弟任务：${context.currentTask.siblings.map(s => `「${s}」`).join('、')}`)
    }
    lines.push('')
  }
  
  // 4. 任务模式判断指令
  if (currentTaskTitle && context.recentHistory.length > 0) {
    lines.push('【🔍 任务模式判断 - 请先执行】')
    lines.push(`当前任务：「${currentTaskTitle}」`)
    lines.push('')
    lines.push('请分析当前任务与近期历史的关系，判断属于哪种模式：')
    lines.push('')
    lines.push('**Mode A: 新任务 (New Task)**')
    lines.push('- 特征：过去3天没有语义相似的任务')
    lines.push('- 策略：正常询问任务定义、目标、时间等基础问题')
    lines.push('')
    lines.push('**Mode B: 延续任务 (Continuation)**')
    lines.push('- 特征：近期有相同或语义相似的任务（不管完成与否）')
    lines.push('- 核心原则：**只陈述事实，不做假设，开放式提问**')
    lines.push('- 策略：')
    lines.push('  ✗ 不要问基础定义问题（"这个任务是什么？"）')
    lines.push('  ✗ 不要假设用户"完成了"或"没完成"（因为勾选状态可能不准确）')
    lines.push('  ✗ 不要问"为什么没完成"这类假设性问题')
    lines.push('  ✓ 陈述事实："我注意到你昨天也安排了[类似任务]"')
    lines.push('  ✓ 开放式提问："今天有什么不同的目标/安排吗？"')
    lines.push('  ✓ 关注当下："今天想达到什么效果？"')
    lines.push('  ✓ 可选询问体验："上次做得怎么样？有什么想调整的吗？"')
    lines.push('  ✓ 如果有用户之前的反思回答，可以引用')
    lines.push('')
    lines.push('**示例对比**：')
    lines.push('- ❌ 错误："上次锻炼没完成是因为时间不够还是身体不适？"（假设了没完成）')
    lines.push('- ✅ 正确："昨天也安排了锻炼，今天有什么不同的目标吗？"')
    lines.push('- ✅ 正确："这是连续安排的锻炼，今天想重点练哪个部分？"')
    lines.push('')
    lines.push('**请在回答开头用一行标注你的判断**，格式如：')
    lines.push('`[Mode: B-Continuation | 相关任务: 昨天的「锻炼」]`')
    lines.push('')
  }
  
  return lines.join('\n')
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
  previousQuestions?: string[],  // 之前问过的问题
  reflectionContext?: ReflectionContext  // 🆕 历史上下文
): Promise<RoundResult | null> {
  try {
    console.log(`💭 生成 ${round} 轮反思问题...`, previousQuestions ? '(补充问题模式)' : '', reflectionContext ? '(有历史上下文)' : '')
    
    const config = ROUND_CONFIG[round]
    let prompt = buildRoundPrompt(round, tasks, scanResult, previousResponses, reflectionContext)
    
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
 * 格式化截止时间为友好的中文格式
 * 例如：2026-01-18T18:00:00.000Z → "01月18日 18:00"
 */
function formatDeadlineForPrompt(deadline: string | undefined): string {
  if (!deadline) return '无截止时间'
  
  try {
    const date = new Date(deadline)
    if (isNaN(date.getTime())) return deadline // 如果解析失败，返回原始字符串
    
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${month}月${day}日 ${hours}:${minutes}`
  } catch {
    return deadline // 解析失败时返回原始字符串
  }
}

/**
 * 格式化时长为友好的中文格式
 * 例如：90 → "1小时30分钟"
 */
function formatDurationForPrompt(minutes: number | undefined): string {
  if (!minutes) return '未估时'
  
  if (minutes < 60) {
    return `${minutes}分钟`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
      return `${hours}小时`
    }
    return `${hours}小时${remainingMinutes}分钟`
  }
}

/**
 * 为选定的任务生成估算时间反思问题（1-3个）
 * 
 * 聚焦于帮助用户校准时间估计、识别隐形依赖、应对意外
 * 
 * @param tasks 用户选择的任务列表（通常是单个任务）
 * @param reflectionContext 🆕 历史上下文（用于纵向感知）
 * @returns 问题字符串数组
 */
export async function generateTimeQuestions(
  tasks: TaskSnapshot[],
  reflectionContext?: ReflectionContext  // 🆕 历史上下文
): Promise<string[]> {
  try {
    if (tasks.length === 0) {
      return ['今天这些任务加起来，时间够用吗？有没有需要调整的？']
    }

    const task = tasks[0] // 通常只选择一个任务
    
    // 🆕 格式化历史上下文
    const historyContext = reflectionContext 
      ? formatContextForPrompt(reflectionContext, task.title)
      : ''
    
    // 构建任务信息（使用友好格式）
    const formattedDuration = formatDurationForPrompt(task.estimatedDuration)
    const formattedDeadline = formatDeadlineForPrompt(task.deadline)
    
    const taskInfo = `
任务名称：${task.title}
预估时长：${formattedDuration}
截止时间：${formattedDeadline}
`.trim()

    // 📊 调试日志：显示传入 prompt 的任务信息
    console.log('🔍 [generateTimeQuestions] 任务信息:', {
      title: task.title,
      原始时长: task.estimatedDuration,
      格式化时长: formattedDuration,
      原始截止时间: task.deadline,
      格式化截止时间: formattedDeadline
    })

    const systemPrompt = `你是一位擅长启发式提问的时间估算教练。你的目标是通过开放式问题，引导用户更深入地思考任务的实际情况，从而做出更准确的时间判断。

### 【核心原则：启发元认知】

- 问题要开放式（需要思考和解释，不能简单回答"是/否"）
- 引导用户发现自己可能忽略的时间因素
- 探索用户对任务的理解深度
- 帮助用户意识到理想情况与现实的差距

### 【时间估算的常见盲区】

1. 只算核心动作，忽略准备、收尾、切换、等待等隐藏耗时
2. 按最顺利的情况估算，没考虑卡点、返工、查资料的时间
3. 凭直觉估大任务，没有拆解和分步估算
4. 低估熟悉度的影响（第一次做 vs 熟练操作）

### 【好问题示例（开放式，启发思考）】

✅ "这个任务的哪个环节最容易超时？为什么？"
✅ "如果没做完，最可能卡在哪里？"
✅ "这个任务你心里有清晰的步骤吗？每步大概要花多久？"
✅ "你做过类似的任务吗？上次实际花了多久？"
✅ "开始做之前，还需要做哪些准备？准备会花多久？"
✅ "是打算一口气做完，还是会分几次处理？"

### 【要避免的问题类型】

❌ 封闭式问题："考虑准备时间了吗？"（只能回答是/否）
❌ 偏离时间的问题："你打算怎么做这个任务？"（问做法，不是时间）
❌ 无关问题："今天还有其他任务吗？"（与当前任务时间无关）
❌ 假设流程的问题："验证环节需要多久？"（用户可能根本不验证）
❌ 是/否题、情绪题（如"难吗""有信心吗"）

### 【ADHD友好原则】

- 温和、鼓励、非评判性语气（避免"你应该""必须""为什么不"）
- 降低启动焦虑，引导思考而非质问
- 问题简短直接，不绕弯子

### 【输出格式】（严格遵守）

- 输出 1-3 行问题（根据任务复杂度灵活调整）
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本`

    const userPrompt = `请基于以下任务信息，生成 1-3 个能有效帮助用户校准时间估计的问题：

${taskInfo}
${historyContext ? `\n${historyContext}` : ''}
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
 * 为选定的任务生成优先级反思问题（固定3个，有逻辑递进关系）
 * 
 * 问题生成逻辑链条：
 * 1. 维度对比（在X轴或Y轴上对比选中的任务）
 * 2. 认知校准（帮用户识别判断中的盲点）
 * 3. 相对定位（和锚点对比或任务间直接定位）
 * 
 * @param tasks 用户选择的任务列表（通常是多个任务，至少2个）
 * @param matrixContext 可选的矩阵上下文，包含当前维度和已分类任务
 * @param reflectionContext 历史上下文（用于纵向感知）
 * @param userProfile 🆕 用户画像（用于个性化问题，如ADHD挑战标签）
 * @returns 问题字符串数组（固定3个）
 */
export async function generatePriorityQuestions(
  tasks: TaskSnapshot[], 
  matrixContext?: MatrixContextForPriority,
  reflectionContext?: ReflectionContext,
  userProfile?: UserProfile  // 🆕 用户画像
): Promise<string[]> {
  try {
    const taskNames = tasks.map(t => t.title)
    
    if (tasks.length === 0) {
      return [
        '你选择的任务里，哪个有真正的外部deadline（比如别人在等）？',
        '这些任务对你当前最重要的目标，分别有什么影响？',
        '如果今天只能完成一个，你会选哪个？为什么？'
      ]
    }

    const taskList = tasks.map(t => `「${t.title}」`).join('、')
    
    // 🆕 格式化历史上下文
    const historyContext = reflectionContext 
      ? formatContextForPrompt(reflectionContext, tasks[0]?.title)
      : ''
    
    // 构建任务信息（使用友好格式）
    const tasksWithDeadline = tasks.filter(t => t.deadline)
    const hasDeadline = tasksWithDeadline.length > 0
    const deadlineInfo = hasDeadline 
      ? `\n有截止时间的任务：${tasksWithDeadline.map(t => `「${t.title}」(${formatDeadlineForPrompt(t.deadline)})`).join('、')}`
      : '\n（这些任务暂无明确截止时间）'

    // 🆕 构建用户画像上下文
    let userContext = ''
    const challenges = userProfile?.challenges || []
    if (challenges.length > 0) {
      userContext = `\n【用户特点】用户标注的挑战：${challenges.join('、')}`
    }

    // 📊 调试日志
    console.log('🔍 [generatePriorityQuestions] 输入信息:', {
      任务数量: tasks.length,
      任务列表: taskNames,
      有截止时间: hasDeadline,
      用户挑战标签: challenges,
      有矩阵上下文: !!matrixContext
    })

    // 构建矩阵维度信息
    let matrixInfo = ''
    let xAxisName = '紧急度'
    let yAxisName = '重要性'
    let hasAnchorTasks = false
    let anchorTasksInfo = ''
    
    if (matrixContext) {
      const { axes, quadrants } = matrixContext
      xAxisName = axes.xAxis.name
      yAxisName = axes.yAxis.name
      
      // 检查是否有已分类的参考锚点任务
      const allAnchorTasks = [
        ...quadrants.topRight.tasks,
        ...quadrants.topLeft.tasks,
        ...quadrants.bottomRight.tasks,
        ...quadrants.bottomLeft.tasks
      ]
      hasAnchorTasks = allAnchorTasks.length > 0
      
      if (hasAnchorTasks) {
        const anchorLines = []
        if (quadrants.topRight.tasks.length > 0) {
          anchorLines.push(`- ${quadrants.topRight.label}：${quadrants.topRight.tasks.map(t => `「${t}」`).join('、')}`)
        }
        if (quadrants.topLeft.tasks.length > 0) {
          anchorLines.push(`- ${quadrants.topLeft.label}：${quadrants.topLeft.tasks.map(t => `「${t}」`).join('、')}`)
        }
        if (quadrants.bottomRight.tasks.length > 0) {
          anchorLines.push(`- ${quadrants.bottomRight.label}：${quadrants.bottomRight.tasks.map(t => `「${t}」`).join('、')}`)
        }
        if (quadrants.bottomLeft.tasks.length > 0) {
          anchorLines.push(`- ${quadrants.bottomLeft.label}：${quadrants.bottomLeft.tasks.map(t => `「${t}」`).join('、')}`)
        }
        anchorTasksInfo = anchorLines.join('\n')
      }
      
      matrixInfo = `
【矩阵维度】
- X轴：${xAxisName}（${axes.xAxis.lowLabel} ← → ${axes.xAxis.highLabel}）
- Y轴：${yAxisName}（${axes.yAxis.lowLabel} ↑ ↓ ${axes.yAxis.highLabel}）
${hasAnchorTasks ? `\n【已分类任务（参考锚点）】\n${anchorTasksInfo}` : '\n（暂无已分类任务作为参考）'}
`
    }

    // 🆕 动态策略选择
    const strategy = {
      focusOnDeadline: hasDeadline,
      hasAnchors: hasAnchorTasks,
      userHasProcrastination: challenges.includes('拖延'),
      userHasTimeBlindness: challenges.includes('时间盲区'),
      taskCount: tasks.length
    }
    
    console.log('🎯 [generatePriorityQuestions] 问题生成策略:', strategy)

    // 🆕 重构的 Prompt - 具体后果 + 开放探索 + 简单选择
    const systemPrompt = `你是一位擅长帮助用户判断任务优先级的智能助手。

## 你的任务

用户选择了 ${tasks.length} 个任务进行优先级判断，你需要生成 **恰好 3 个** 具体、易懂、好回答的问题，帮助用户判断这些任务的相对优先级。

## 问题生成逻辑（必须按此顺序）

### 第一个问题：具体后果（不问抽象的"重要性"，而是问具体的后果）
用"后果思维"帮助用户判断，问"不做会怎样"或"有没有人在等"。
**重要**：根据任务名称推断情境，让问题更个性化。
- ✅ 好问法（个性化）：「准备Tutorial Slides」如果没准备好，会影响学生的学习吗？「修改原型」呢，团队在等这个版本吗？
- ✅ 好问法（通用）：「任务A」和「任务B」，哪个有人在等你的结果？这个人重要吗？
- ✅ 好问法：这两个任务完成后，分别对你这周的计划有什么影响？
- ❌ 不要问：在重要性上有什么不同？（太抽象，用户难以回答）
${!hasDeadline ? '- ⚠️ 这些任务没有明确截止时间，聚焦于"影响"和"后果"，不要问截止时间' : ''}

### 第二个问题：开放探索（不预设用户状态，用开放式问题引导）
帮助用户自我觉察，但**不要预设用户的行为或状态**。
- ✅ 好问法：这两个任务里，有没有哪个是你"想开始但还没动手"的？
- ✅ 好问法：「任务A」和「任务B」，哪个做起来你会更有动力？
- ✅ 好问法：这两个任务，有没有哪个"看起来紧急"但其实可以等一等？
- ❌ 不要说："你一直想做但总在推后"（这是预设，可能不符合实际）
- ❌ 不要说："是什么让它难以开始"（预设了用户觉得难以开始）

### 第三个问题：对比影响（引导深度反思，不要简单二选一）
让用户对比分析"不做这些任务"会带来的影响，帮助判断轻重缓急。
**重要**：根据任务名称推断具体影响，不要套用通用模板。
- ✅ 好问法（个性化）：「准备Tutorial Slides」拖到明天，学生会受影响吗？「修改原型」推迟，对项目进度有什么影响？
- ✅ 好问法（通用）：「任务A」和「任务B」，不做它们分别会给你带来什么影响？
- ✅ 好问法：这两个任务如果都推迟一天，哪个带来的麻烦更大？
- ❌ 不要问：如果今天只能做一个，你会选哪个？（太简单，不引导反思）
- ❌ 不要问：和已分类的任务比，位置怎样排？（太复杂）

## 问题设计原则

**核心原则**：
✅ 问题要**具体**，用户一看就知道怎么回答
✅ 问题要像**聊天**一样自然，不要学术化
✅ **根据任务名称推断情境**，让问题贴合实际场景（而不是套用通用模板）
✅ **不预设用户状态**，用"有没有"而不是断言
✅ 每个问题必须包含**具体任务名称**（用「」包裹）
✅ 简短：15-30字

**个性化提示**：
- 从任务名称推断可能的场景（如"Tutorial"→教学场景，"修改原型"→产品开发）
- 让问题贴近任务的实际情境（如"学生在等""影响迭代进度"）
- 不要对所有任务问一样的通用问题

**绝对禁止**：
❌ 抽象的维度对比：如"在重要性上有什么不同"
❌ 预设用户状态：如"你一直想做但推后""是什么让它难以开始"
❌ 复杂的锚点对比：如"和已分类的任务比，位置怎样排"
❌ Yes/No 问题：如"是不是""合理吗""需要吗"
❌ 情绪评判：如"难吗""焦虑吗"
❌ 套用完全相同的通用模板

## 好问题示例（体现个性化）

假设用户选了「准备Tutorial Slides」和「修改原型」：

**示例1（结合情境）**：
1. "「准备Tutorial Slides」如果没准备好，会影响学生的学习吗？「修改原型」呢，团队在等这个版本吗？"
2. "这两个任务里，有没有哪个是你'想开始但还没动手'的？"
3. "「准备Tutorial Slides」拖到明天，学生会受影响吗？「修改原型」推迟，对项目进度有什么影响？"

**示例2（通用但具体）**：
1. "「准备Tutorial Slides」和「修改原型」，哪个有人在等你的结果？这个人重要吗？"
2. "这两个任务里，有没有哪个是你'看着就想拖'的？"
3. "「准备Tutorial Slides」和「修改原型」，不做它们分别会给你带来什么影响？"

**关键**：优先使用示例1的方式（根据任务名称推断情境），让问题更贴近实际。

## 输出格式

- 恰好输出 3 行问题
- 每行以"- "开头
- 不添加任何说明、编号、标题`

    const userPrompt = `请为以下任务生成恰好 3 个优先级判断问题：

【待判断任务】${taskList}
${deadlineInfo}
${matrixInfo}
${userContext}
${historyContext ? `\n${historyContext}` : ''}

请直接输出 3 个问题，每行以"- "开头。`

    const response = await doubaoService.sendMessage(
      `${systemPrompt}\n\n${userPrompt}`
    )

    if (!response.success || !response.message) {
      console.error('❌ 生成优先级问题失败:', response.error)
      // 降级：返回通用开放式问题（固定3个）
      return generateFallbackPriorityQuestions(taskNames, hasDeadline, xAxisName, yAxisName)
    }

    // 解析问题（每行以"- "开头）
    console.log('🔍 LLM 返回的原始消息:', response.message)
    
    const questions = response.message
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2).trim())
      .filter(q => q.length > 0)

    console.log('🔍 解析后的问题:', questions)

    // 确保返回恰好3个问题
    if (questions.length < 3) {
      console.warn(`⚠️ 只解析出 ${questions.length} 个问题，补充降级问题`)
      const fallback = generateFallbackPriorityQuestions(taskNames, hasDeadline, xAxisName, yAxisName)
      while (questions.length < 3 && fallback.length > 0) {
        questions.push(fallback.shift()!)
      }
    }

    console.log(`✅ 生成了 ${questions.length} 个优先级问题`)
    return questions.slice(0, 3) // 返回恰好3个

  } catch (error) {
    console.error('❌ 生成优先级问题失败:', error)
    const taskNames = tasks.map(t => t.title)
    const hasDeadline = tasks.some(t => t.deadline)
    return generateFallbackPriorityQuestions(taskNames, hasDeadline, '紧急度', '重要性')
  }
}

/**
 * 生成降级的优先级问题（固定3个）
 * 遵循：具体后果 → 开放探索 → 对比影响
 */
function generateFallbackPriorityQuestions(
  taskNames: string[], 
  hasDeadline: boolean,
  _xAxisName: string,  // 保留参数但不使用，避免学术化问题
  _yAxisName: string
): string[] {
  const t1 = taskNames[0] || '任务A'
  const t2 = taskNames[1] || '任务B'
  
  if (taskNames.length >= 2) {
    if (hasDeadline) {
      return [
        `「${t1}」和「${t2}」，哪个有人在等你的结果？这个人重要吗？`,
        `这两个任务里，有没有哪个"看起来紧急"但其实可以等一等？`,
        `「${t1}」和「${t2}」，不做它们分别会给你带来什么影响？`
      ]
    } else {
      return [
        `「${t1}」和「${t2}」完成后，分别会给你带来什么好处？`,
        `这两个任务里，有没有哪个是你"想开始但还没动手"的？`,
        `「${t1}」和「${t2}」，不做它们分别会给你带来什么影响？`
      ]
    }
  } else {
    return [
      `「${t1}」如果今天不做，明天会面临什么情况？`,
      `「${t1}」有人在等你的结果吗？这个人重要吗？`,
      `「${t1}」完成后会给你带来什么好处？不做会有什么影响？`
    ]
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

