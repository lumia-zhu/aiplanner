/**
 * 任务拆解AI服务
 * 用于根据任务内容动态生成拆解引导问题
 */

import type { Task } from '@/types'
import { generateContextQuestions } from './contextQuestions'

// 豆包大模型配置
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
}

/**
 * 根据任务内容动态生成3个任务拆解引导问题
 * @param task 需要拆解的任务
 * @returns 3个问题的数组
 */
export async function generateDynamicDecompositionQuestions(task: Task): Promise<string[]> {
  try {
    // 构建任务信息描述
    const taskInfo = buildTaskInfoDescription(task)
    
    // 构建AI prompt
    const systemPrompt = `你是一位擅长任务情境分析的智能助手。你的目标是：通过 1-3 个精准的开放式问题，帮助用户澄清任务的关键信息，确保任务可以顺利执行。

### 【核心分析框架】

基于任务性质，从以下三个核心角度诊断信息缺口：

**1. Task Awareness（任务认知）**
   - 任务的目标是什么？完成到什么程度算成功？
   - 任务的具体范围和边界在哪里？（哪些做、哪些不做）
   - 有哪些关键规格、截止日期或里程碑？

**2. Pre-requisition / Resource（前置条件与资源）**
   - 现在已经有什么资源/材料/信息？
   - 还需要什么依赖输入或外部支持？
   - 有哪些协作对象或需要他人提供的内容？

**3. Strategy Awareness（策略认知）**
   - 从哪个部分开始最容易上手？
   - 哪些部分最不确定或最担心？
   - 有没有可以参考的先例或模板？

### 【问题生成策略】

**灵活性原则**：
- 根据任务性质，**动态选择 1-3 个最关键的角度**
- 如果某个角度完全不适用（如简单任务无需问资源），直接跳过
- 如果某个角度特别关键（如复杂项目的里程碑），可以问多个问题
- **总问题数控制在 1-3 个**，不要为了凑数而问无意义的问题

**优先级判断**：
1. **简单任务**（如"买菜""发邮件"）：可能只需要 1 个问题，甚至不需要问
2. **中等任务**（如"写报告""准备演讲"）：通常 2-3 个问题
3. **复杂任务**（如"完成论文修改""组织活动"）：3 个问题，覆盖多个角度

**问题设计要点**：
- 每问只问一件事，句式简短（15-30字）
- 开放式问句（用"什么/如何/哪些/哪部分"开头）
- 贴合任务实际情境，使用任务相关的具体术语
- 避免抽象概念，聚焦可观察、可量化的信息

### 【严格禁止】

❌ 是/否题、情绪题（如"难吗""有信心吗"）
❌ 显而易见的问题（用户已说明的信息）
❌ 工具/格式细节（如"用Word还是LaTeX""字数多少"）
❌ 空泛笼统的问题（如"你打算怎么做"）
❌ 为了凑数而问的无关问题
- **过于细碎的信息收集**（如"已经收集了哪些文献的信息（标题、作者、年份）"）
  * 改问"现在文献在什么状态（有多少篇/是否已读/如何存放）"

### 【任务类型推理参考】（用于提高问题针对性）

- **学术写作**（论文/摘要/报告）→ 问：重点论证什么？已有哪些实验数据或文献综述？从哪个章节/部分最容易上手？
- **评审/评估**（审稿/打分）→ 问：评审的重点维度是什么（创新性/方法/写作）？需要评审几篇/什么类型的材料？每篇预计多久？
- **准备/演示**（汇报/PPT/答辩）→ 问：受众是谁/他们最关心什么？你想传达的核心观点是什么？现在已有哪些素材或数据？
- **整理/归档**（笔记/文件/文献）→ 问：整理后用于什么场景（写论文/复习/分享）？现在这些材料在什么状态（散落/部分已分类/完全混乱）？你希望按什么维度组织（主题/时间/重要性）？
- **学习/掌握**（复习/练习）→ 问：哪些内容是已经理解的？哪部分最薄弱或最担心？你打算如何检验自己是否掌握？
- **教学/辅助**（做TA/备课）→ 问：你具体负责哪部分工作（讲解/答疑/批改作业）？学生大概多少人/什么水平？课程进度到哪了？
- **会议/活动**（组织/参加）→ 问：你在其中的角色是什么/需要做什么？有哪些关键时间节点或里程碑？需要提前准备什么材料或信息？

### 【反例对比】（理解"目的导向"vs"技术细节导向"）

**任务：整理参考文献**

❌ **差的问题**（技术细节/过于细碎）：
- 你整理参考文献后要输出什么格式的文件（如EndNote库、Excel表、Word列表）？
- 你现在已经收集了哪些文献的信息（如标题、作者、年份）？
- 你打算用什么软件来管理这些文献？

✅ **好的问题**（目的/状态/执行导向）：
- 你整理这些文献是为了用在什么场景（写论文的某个章节/做文献综述/准备开题报告）？
- 这些文献现在是什么状态（散落在各处PDF/部分已读并标注/还是只有标题清单）？
- 你希望按什么维度来组织这些文献（按主题分类/按研究方法/按时间线/按与你研究的相关性）？

### 【ADHD友好原则】

- 温和、鼓励、非评判性语气（避免"你应该""必须""为什么不"）
- 降低启动焦虑，引导"下一步可以做什么"而非"为什么没做"
- 问题顺序符合自然思考流程（先想清楚目标，再盘点资源，最后思考启动）

### 【输出格式】（严格遵守）

- 输出 1-3 行问题（根据任务复杂度灵活调整）
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本

### 【成功标准】

用户回答后，应能让AI获得：
✓ 任务的目标、范围和完成标准（Task Awareness）
✓ 现有资源和所需依赖（Pre-requisition / Resource）
✓ 执行起点和潜在障碍（Strategy Awareness）`

    const userPrompt = `请基于以下任务信息，生成 1-3 个能有效澄清任务关键信息的问题：

${taskInfo}

**你的分析流程**（内部执行，不要输出）：

1️⃣ **任务复杂度判断**
   - 简单任务（如"买菜""发邮件"）：可能只需 1 个问题或不需要问
   - 中等任务（如"写报告""准备演讲"）：通常 2-3 个问题
   - 复杂任务（如"完成论文修改""组织活动"）：3 个问题

2️⃣ **核心角度诊断**（从三个角度判断哪些需要澄清）
   
   **Task Awareness（任务认知）**：
   - 任务目标是否明确？完成标准是什么？
   - 任务范围和边界清楚吗？
   - 有关键截止日期或里程碑吗？
   
   **Pre-requisition / Resource（前置条件与资源）**：
   - 现有资源/材料/信息是否充足？
   - 还需要什么依赖输入？
   - 有协作对象或外部支持吗？
   
   **Strategy Awareness（策略认知）**：
   - 执行起点是否清晰？
   - 有不确定或担心的部分吗？
   - 有可参考的先例或模板吗？

3️⃣ **灵活选择问题数量和角度**
   - 如果某个角度完全不适用，直接跳过（不要为了凑数而问）
   - 如果某个角度特别关键，可以问多个问题
   - 优先问对任务执行影响最大的角度
   - 确保问题之间互补，不重复

**质量自检**：
✓ 问题数量合理（1-3个，不凑数）
✓ 每问聚焦一个具体角度
✓ 开放式问句，贴合任务情境
✓ 避免抽象概念、工具细节、显而易见的问题

请直接输出问题（1-3个，每行以"- "开头，不要任何额外文字）：`

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
        max_tokens: 200, // 3个问题，每个约30字，稍微多一点buffer
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
    console.error('AI拆解问题生成失败，使用降级方案:', error)
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
    const totalMinutes = task.estimated_duration % 10000 // 去除buffer标记
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    let durationStr = ''
    if (hours > 0) durationStr += `${hours}小时`
    if (minutes > 0) durationStr += `${minutes}分钟`
    parts.push(`预估时长：${durationStr || '未知'}`)
  } else {
    parts.push(`预估时长：（未设置）`)
  }
  
  // 5. 标签/复杂度提示
  if (task.tags && task.tags.length > 0) {
    const complexityTags = task.tags.filter(tag => 
      ['difficult', 'easy', 'important', 'urgent'].includes(tag)
    )
    if (complexityTags.length > 0) {
      parts.push(`任务特点：${complexityTags.join('、')}`)
    }
  }
  
  // 6. 已有子任务提示
  if (task.subtasks && task.subtasks.length > 0) {
    parts.push(`备注：用户已创建了${task.subtasks.length}个子任务，可能需要进一步优化`)
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
export function formatDynamicDecompositionMessage(task: Task, questions: string[]): string {
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n\n')

  return `好的！在开始拆解「${task.title}」之前，我想了解一些背景信息：

${questionList}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
}

/**
 * 生成任务拆解问题（带降级方案）
 * 优先使用AI动态生成，失败时回退到规则模板
 * @param task 需要拆解的任务
 * @returns 问题数组和消息文本
 */
export async function generateDecompositionQuestionsWithFallback(task: Task): Promise<{
  questions: string[]
  message: string
  isAIGenerated: boolean
}> {
  try {
    // 尝试使用AI生成
    const aiQuestions = await generateDynamicDecompositionQuestions(task)
    const aiMessage = formatDynamicDecompositionMessage(task, aiQuestions)
    
    return {
      questions: aiQuestions,
      message: aiMessage,
      isAIGenerated: true
    }
  } catch (error) {
    console.warn('AI拆解问题生成失败，使用规则模板降级方案')
    
    // 降级到规则模板
    const ruleBasedQuestions = generateContextQuestions(task)
    const ruleBasedMessage = `好的！在开始拆解「${task.title}」之前，我想了解一些背景信息：

${ruleBasedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

💡 请在下方输入框中回答这些问题，也可以提供其他任何你知道的信息（可以自由描述，不需要严格按问题序号）`
    
    return {
      questions: ruleBasedQuestions,
      message: ruleBasedMessage,
      isAIGenerated: false
    }
  }
}









