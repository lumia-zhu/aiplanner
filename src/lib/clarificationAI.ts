/**
 * 任务澄清AI服务
 * 用于根据任务内容动态生成苏格拉底式问题
 */

import type { Task } from '@/types'
import { generateClarificationQuestions } from './clarificationQuestions'

// AI大模型配置（Deepseek V3.2）
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'deepseek-v3-2-251201',
}

/**
 * 根据任务内容动态生成3个苏格拉底式问题
 * @param task 需要澄清的任务
 * @returns 3个问题的数组
 */
export async function generateDynamicClarificationQuestions(task: Task): Promise<string[]> {
  try {
    // 构建任务信息描述
    const taskInfo = buildTaskInfoDescription(task)
    
    // 构建AI prompt
    const systemPrompt = `你是一位擅长引导思考的任务教练，使用苏格拉底式提问帮助用户**澄清任务本身的定义与边界**，使任务从模糊变为清晰、可执行。

### 核心目标

通过3个精准问题，帮助用户**理解任务本身是什么**，使任务定义从模糊变为清晰，从而能更好地制定计划和启动执行。

你的问题应帮助用户思考：
- **这个任务的核心是什么？**（主题、范围、重点）
- **做这个任务是为了什么？**（目的、用途、预期效果）
- **做成什么样算完成？**（成果形式、成功标准）
- **有哪些关键约束或要求？**（时间、质量、特定要求）

**注意区分**：
- ✅ **澄清（Clarification）** = 理解"任务是什么"（定义层面）
- ❌ **拆解（Decomposition）** = 理解"如何执行任务"（执行层面）

**判断"对象/受众"是否重要**：
- ✅ 当对象**不同会显著改变任务内容/风格/重点**时，才问"对象是谁"
  * 例："准备汇报"→老板/团队/客户的汇报内容完全不同
  * 例："写报告"→给导师/期刊/大众的报告风格完全不同
- ❌ 当对象**固定/显而易见/不影响任务本质**时，不问"对象是谁"
  * 例："Qualify Exam"→受众显然是评审委员会，问了无意义
  * 例："做TA批改作业"→受众显然是学生，问了无意义
  * 这种情况应改问任务的**核心内容、范围、重点、标准**

### 【内部分析流程】（只在脑内执行，不要输出）

1. **识别任务类型与推断典型定义要素**
   - **准备/演示类**（汇报/PPT/演讲）→ 关注：对象是谁、目的是什么、主题/范围是什么
   - **写作类**（论文/报告/文档）→ 关注：写给谁看、核心论点是什么、重点论证什么
   - **考试/考核类**（Qualify Exam/面试/答辩）→ 关注：考核的领域/科目是什么、预期形式/难度、重点准备什么
     * ⚠️ 不要问"受众是谁"（评审/面试官是固定的），改问"考核重点/范围/形式"
   - **评审/评估类**（审稿/打分）→ 关注：评审对象是什么、评审标准是什么、输出形式是什么
   - **整理/归档类**（笔记/文件/文献）→ 关注：整理后用于什么、按什么维度组织、成功标志是什么
   - **学习/掌握类**（复习/练习）→ 关注：学习目标是什么、重点掌握哪些、如何验证掌握
   - **教学/辅助类**（做TA/备课）→ 关注：具体负责什么工作、课程内容是什么、学生情况如何
     * ⚠️ 不要问"受众是谁"（显然是学生），改问"具体职责/课程内容/学生情况"
   - 若遇专有名词（如"CHI审稿""Qualify Exam"），基于常识归类并推断关键定义要素

2. **诊断任务定义的缺失维度**
   从以下维度中，找出"用户未明确"且"对任务定义最关键"的信息：
   - **对象/受众**：做给谁/呈现给谁？（仅当对象不同会显著改变任务内容/风格时才问）
     * ✅ 适用：汇报、演讲、写作、设计等（对象决定风格/深度/重点）
     * ❌ 不适用：考试、面试、答辩、做TA等（对象固定/显而易见）
   - **目的/用途**：为什么做/用在什么场景？（决定内容取舍）
   - **主题/范围**：核心内容是什么/边界在哪？（明确做什么/不做什么）
   - **重点/关键要素**：任务的核心或最重要的部分是什么？（如考核重点、关键领域）
   - **成果形式**：最终产出是什么样的？（如报告/PPT/评语/清单）
   - **成功标准**：怎样算"完成"？（如达成某个效果/满足某个要求）
   - **关键依赖/限制**：任务依赖什么/有哪些硬性约束？（影响任务可行性与边界）
     * 依赖：需要等谁提供什么/需要完成什么前置任务/需要什么权限或条件
     * 限制：必须在何时前完成/必须符合什么标准/预算/权限/资源上限

3. **设计3个互补问题（灵活选择最重要的定义维度）**
   根据任务类型，从诊断出的缺失维度中选择最关键的3个：
   - **若"对象"重要**（如汇报/写作）→ 优先问对象、再问目的/主题、最后问标准/重点
   - **若"对象"不重要**（如考试/做TA）→ 跳过对象，优先问主题/范围、目的/用途、重点/标准
   - **递进逻辑**：从"是什么"→"为什么"→"怎样算好"的顺序提问
   - **互补性检查**：三问必须覆盖不同定义维度，避免重复或相似

### 【问题设计要求】

✅ **必须做到**：
- 聚焦**任务定义层面**（对象、目的、主题、范围、标准），而非**执行细节层面**（步骤、资源、工具）
- 开放式问句（用"什么/谁/为什么/哪些/如何定义"开头），引导详细回答
- 每问只问一件事，句式简短（15-25字），易理解、低认知负担
- 帮助用户思考"我究竟要完成什么"，而非"我打算怎么做"

❌ **严格禁止**：
- **执行过程问题**（如"需要包含哪些模块/步骤""从哪个部分开始做""先做什么后做什么"）→ 这些属于拆解阶段
- **执行资源清单**（如"需要哪些工具/材料/参考书"）→ 除非是"关键依赖"（如"需要等谁提供什么"）
- **操作/技术细节**（如"用什么软件""多少页/字数""什么格式"）→ 除非是"硬性约束"（如"必须符合XX标准"）
- 是/否题、情绪/动机题（如"难吗""有信心吗"）
- 显而易见或空泛的问题（如"你打算怎么做""有什么计划"）

✅ **可以问的"依赖/限制"**（属于任务定义层面）：
- **关键依赖**：任务依赖谁/什么？（如"需要等导师审批""需要先完成某前置任务""需要某人提供数据"）
- **硬性约束**：有哪些不可逾越的限制？（如"必须在X时间前""必须符合XX标准""预算只有X""权限限制"）
- **前提条件**：任务能否进行的关键条件是什么？（如"需要某系统可用""需要团队成员都在场"）

### 【反例对比】（理解"定义层面"vs"执行层面" & "对象何时重要"）

**示例1：准备下周汇报**（对象很重要）

❌ **差的问题**（执行细节导向，属于拆解阶段）：
- 汇报需要包含哪些模块或步骤？
- 完成汇报需要哪些资源或支持？
- 你打算从哪个部分开始准备？

✅ **好的问题**（定义层面导向，属于澄清阶段）：
- 这次汇报的对象是谁（老板/团队/客户/评审）？
- 汇报的核心目的是什么（汇报进展/争取资源/寻求决策/分享成果）？
- 汇报的主题或重点内容是什么（项目整体/某个模块/数据分析/问题诊断）？

**示例2：准备Qualify Exam**（对象不重要/显而易见）

❌ **差的问题**（对象显而易见/无助于理解任务）：
- 这个Qualify Exam的受众是谁（如教授/评审委员会）？
- 你需要准备哪些资料或复习材料？
- 你打算从哪个科目开始复习？

✅ **好的问题**（聚焦考核本身的定义）：
- Qualify Exam主要考核哪些领域或科目？
- 考试的形式是什么（笔试/口试/综合评估）？预期难度如何？
- 你希望通过这次考试达到什么水平或证明什么能力？

**示例3：区分"依赖/限制"（定义层面 vs 执行层面）**

❌ **执行层面的资源/步骤**（属于拆解阶段）：
- 你需要哪些参考书或学习材料？
- 你需要准备哪些工具或软件？
- 你打算分几步来完成？从哪步开始？

✅ **定义层面的依赖/限制**（属于澄清阶段）：
- 这个任务依赖其他人或事吗（如需要等导师审批/需要某人提供数据）？
- 有哪些硬性的时间或质量约束（如必须在某日期前完成/必须符合某个标准）？
- 完成这个任务需要哪些关键前提条件（如需要某权限/需要某系统可用）？

### 【ADHD友好原则】

- 温和、鼓励、非评判性语气（避免"你应该""必须""为什么不"）
- 问题简洁、一次一个重点（15-25字）
- 引导任务定义澄清，降低启动焦虑

### 【输出格式】（严格遵守）

- 仅输出3行问题
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本`

    const userPrompt = `请根据以下任务信息，生成3个帮助用户**澄清任务定义**的问题：

${taskInfo}

**你的分析流程**（内部执行，不要输出）：

1️⃣ **任务类型识别**
   - 识别核心动作（准备/写/评/整理/学习/做等）
   - 归类任务类型并推断典型定义要素
   - 若遇专有名词，基于常识推断其所属类别

2️⃣ **定义缺口诊断**
   对比任务描述，从以下"**定义层面**"维度中找出"用户未明确"且"最关键"的3项：
   - **对象/受众**：做给谁/呈现给谁？
     * ⚠️ 仅当对象不同会显著改变任务内容/风格时才选择
     * 适用：汇报、演讲、写作、设计等
     * 不适用：考试、面试、答辩、做TA等（对象固定/显而易见）
   - **主题/范围**：核心内容是什么/边界在哪？（明确做什么/不做什么）
   - **目的/用途**：为什么做/用在什么场景？（决定内容取舍）
   - **重点/关键要素**：任务的核心或最重要的部分是什么？（如考核重点、关键领域）
   - **成果形式**：最终产出是什么样的？（如报告/PPT/评语/清单）
   - **成功标准**：怎样算"完成"？（如达成某个效果/满足某个要求）
   - **关键依赖/限制**：任务依赖什么/有哪些硬性约束？
     * 依赖：需要等谁提供什么/需要完成什么前置任务/需要什么权限或条件
     * 限制：必须在何时前/必须符合什么标准/预算/权限/资源上限
     * ⚠️ 不要问"需要哪些工具/材料/参考书"（这是执行资源清单）
   
   ⚠️ **不要选择执行层面的维度**（如具体步骤、执行资源清单、启动点）→ 这些属于拆解阶段

3️⃣ **问题设计**（灵活选择最重要的定义维度）
   - **若"对象"重要**（如汇报/写作）→ 问对象、目的/主题、标准/重点
   - **若"对象"不重要**（如考试/做TA）→ 跳过对象，问主题/范围、目的/用途、重点/标准
   - **递进逻辑**：从"是什么"→"为什么"→"怎样算好"的顺序提问
   - **互补性检查**：三问必须覆盖不同定义维度，避免重复或相似

**质量自检**（出题前确认）：
✓ 每问是否聚焦**任务定义层面**（对象、目的、主题、范围、标准、依赖/限制）？
✓ **是否避免了执行过程问题**（如"需要哪些模块/步骤""从哪开始"）？
✓ **是否避免了执行资源清单**（如"需要哪些工具/材料/参考书"）？
  * 但可以问**关键依赖/硬性限制**（如"依赖谁提供什么""必须符合什么标准"）
✓ **若问"对象"，是否确认对象真的会改变任务内容/风格**（考试/面试/做TA的对象显而易见，不要问）？
✓ 是否都是开放式问题（而非是/否题）？
✓ 是否避免了显而易见/空泛的问题？
✓ 三问是否互补且符合递进逻辑？

请直接输出3个问题（每行以"- "开头，不要任何额外文字）：`

    // 调用豆包API
    const apiKey = process.env.NEXT_PUBLIC_DOUBAO_API_KEY
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_DOUBAO_API_KEY not configured')
    }

    const response = await fetch(DOUBAO_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DOUBAO_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7, // 稍高的温度，增加创造性
        max_tokens: 150, // 3个问题，每个约25字
        thinking: { type: 'disabled' } // 关闭深度思考，提升响应速度
      }),
    })

    if (!response.ok) {
      throw new Error(`Doubao API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析AI返回的问题
    const questions = parseQuestionsFromResponse(content)
    
    // 如果解析失败或问题数量不对，抛出错误触发降级
    if (questions.length !== 3) {
      throw new Error(`Expected 3 questions, got ${questions.length}`)
    }
    
    return questions
    
  } catch (error) {
    console.error('AI问题生成失败，使用降级方案:', error)
    // 抛出错误，由调用方决定是否使用降级方案
    throw error
  }
}

/**
 * 构建任务信息描述（传递给AI）
 */
function buildTaskInfoDescription(task: Task): string {
  const parts: string[] = []
  
  // 1. 任务标题
  parts.push(`任务标题：${task.title}`)
  
  // 2. 任务描述
  if (task.description && task.description.trim().length > 0) {
    parts.push(`任务描述：${task.description}`)
  } else {
    parts.push(`任务描述：（未填写）`)
  }
  
  // 3. 截止时间
  if (task.deadline_datetime) {
    const deadline = new Date(task.deadline_datetime)
    const deadlineStr = deadline.toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    })
    parts.push(`截止时间：${deadlineStr}`)
  } else {
    parts.push(`截止时间：（未设置）`)
  }
  
  // 4. 预估时长
  if (task.estimated_duration) {
    // estimated_duration 现在是数字（分钟）
    const hours = Math.floor(task.estimated_duration / 60)
    const minutes = task.estimated_duration % 60
    let durationStr = ''
    if (hours > 0) durationStr += `${hours}小时`
    if (minutes > 0) durationStr += `${minutes}分钟`
    parts.push(`预估时长：${durationStr || '未知'}`)
  } else {
    parts.push(`预估时长：（未设置）`)
  }
  
  // 5. 标签/优先级
  if (task.tags && task.tags.length > 0) {
    parts.push(`标签：${task.tags.join('、')}`)
  } else {
    parts.push(`标签：（无）`)
  }
  
  // 6. 子任务数量
  if (task.subtasks && task.subtasks.length > 0) {
    parts.push(`已有${task.subtasks.length}个子任务`)
  }
  
  return parts.join('\n')
}

/**
 * 从AI响应中解析问题列表
 */
function parseQuestionsFromResponse(content: string): string[] {
  const questions: string[] = []
  
  // 按行分割
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  for (const line of lines) {
    // 匹配以 "- " 开头的行
    if (line.startsWith('- ')) {
      const question = line.substring(2).trim()
      if (question.length > 0) {
        questions.push(question)
      }
    }
    // 也兼容其他可能的格式：数字编号
    else if (/^\d+[\.)、]/.test(line)) {
      const question = line.replace(/^\d+[\.)、]\s*/, '').trim()
      if (question.length > 0) {
        questions.push(question)
      }
    }
  }
  
  return questions
}

/**
 * 格式化AI生成的问题为消息文本
 * @param task 任务
 * @param questions 问题数组
 * @returns 格式化后的消息文本
 */
export function formatDynamicQuestionsMessage(task: Task, questions: string[]): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n\n')

  return `好的！在开始澄清「${task.title}」之前，我想了解一些背景信息：

${questionList}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
}

/**
 * 生成任务澄清问题（带降级方案）
 * 优先使用AI动态生成，失败时回退到规则模板
 * @param task 需要澄清的任务
 * @returns 问题数组和消息文本
 */
export async function generateClarificationQuestionsWithFallback(task: Task): Promise<{
  questions: string[]
  message: string
  isAIGenerated: boolean
}> {
  try {
    // 尝试使用AI生成
    const aiQuestions = await generateDynamicClarificationQuestions(task)
    const aiMessage = formatDynamicQuestionsMessage(task, aiQuestions)
    
    return {
      questions: aiQuestions,
      message: aiMessage,
      isAIGenerated: true
    }
  } catch (error) {
    console.warn('AI问题生成失败，使用规则模板降级方案')
    
    // 降级到规则模板
    const ruleBasedQuestions = generateClarificationQuestions(task)
    const ruleBasedMessage = `好的！在开始澄清「${task.title}」之前，我想了解一些背景信息：

${ruleBasedQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n\n')}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
    
    return {
      questions: ruleBasedQuestions.map(q => q.question),
      message: ruleBasedMessage,
      isAIGenerated: false
    }
  }
}

