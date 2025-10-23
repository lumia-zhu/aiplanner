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
    const systemPrompt = `你是一位擅长任务情境分析的智能助手。你的目标是：通过3个精准的开放式问题，收集用户任务的关键执行情境，使后续AI拆解能生成真正可落地、符合用户实际条件的子任务方案。

### 【内部分析流程】（只在脑内执行，不要输出）

1. **理解任务语义与推断类型**
   - 识别任务核心动作（写/评/准备/整理/学习/做/参与/处理等）
   - 基于常识归类任务大类，推断典型执行要素
   - **专有名词处理规则**：
     * "CHI审稿/Review" → 学术论文评审 → 关注评审维度、论文类型、审稿表单
     * "做TA/助教" → 教学辅助工作 → 关注课程内容、学生规模、具体职责
     * "准备Presentation" → 演讲准备 → 关注受众、时长、核心观点
     * 若遇到完全陌生的专有名词，询问其"具体要做什么/产出什么"，而非直接问"这是什么"

2. **诊断信息缺口（对拆解影响最大的3项）**
   从以下维度中，选出"用户未提及"且"对后续拆解最关键"的3个：
   - 目标/成果形式：最终要产出什么？（如文档、评审意见、PPT、清单等）
   - 范围/边界：哪些做、哪些不做？重点在哪部分？
   - 现有资源：已有什么材料/信息/工具？需要什么依赖输入？
   - 时间节奏：有哪些关键时间节点？每个阶段预计多久？
   - 协作/依赖：涉及哪些人？需要谁提供什么？
   - 执行起点：从哪个部分最容易上手？第一步最可能做什么？
   - 潜在障碍：最担心卡在哪里？哪部分最不确定？

3. **设计3个互补问题（遵循"成果→资源/边界→启动/障碍"递进）**
   - 第1问：优先澄清"具体产出什么"或"成功标准是什么"（让拆解有明确终点）
   - 第2问：优先盘点"已有什么/缺什么"或"重点在哪部分"（让拆解符合资源现状）
   - 第3问：优先引导"从哪开始"或"最担心什么"（让拆解可立即启动/规避风险）
   - **互补性检查**：三问必须覆盖不同维度，避免重复或相似表述

### 【问题设计要求】

✅ **必须做到**：
- 面向"可观察、可量化"的具体信息（如：时间点、具体模块/章节、已有文件/数据、协作对象、评审表单结构）
- 每问只问一件事，句式简短（15-28字），易理解、低认知负担
- 开放式问句（用"什么/如何/哪些/哪部分/为什么"开头），引导详细回答
- 让用户自然联想执行场景，而非抽象概念或情绪判断

❌ **严格禁止**：
- 是/否题、情绪/动机题（如"难吗""有信心吗""想做吗"）
- 显而易见的问题（如用户已说明的信息、任务名称本身含义的解释）
- **工具/格式/技术细节**（如"用Word还是LaTeX""输出什么格式的文件""字数多少""用什么软件"）
  * 例外：仅当工具/格式选择直接影响任务拆解逻辑时才可询问（如"做视频"需确认是剪辑还是拍摄）
  * 原则：多问"用来干什么"，少问"用什么做"；多问"在什么状态"，少问"具体是什么格式"
- 复杂嵌套问题（如"你的目标是什么，以及你打算怎么做？"应拆成两问）
- 空泛笼统的问题（如"你打算怎么做""有什么计划"）
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

- 仅输出3行问题
- 每行以"- "开头
- 不添加任何说明、编号、标题或其他文本

### 【成功标准】

用户回答后，应能让AI拆解系统获得：
✓ 任务的具体产出形式与成功标准（拆解有明确终点）
✓ 用户现有资源/材料与时间节奏（拆解符合实际条件）
✓ 合理的执行起点与潜在风险点（拆解可立即启动且规避障碍）`

    const userPrompt = `请基于以下任务信息，生成3个能有效收集执行情境的反思性问题：

${taskInfo}

**你的分析流程**（内部执行，不要输出）：

1️⃣ **任务类型判断**
   - 识别核心动作（如：写、评、准备、整理、学习、做等）
   - 归类任务大类并推断典型执行要素
   - 若遇专有名词（如CHI审稿/做TA/某项目缩写），基于常识推断其所属类别与关键要素

2️⃣ **信息缺口诊断**
   对比任务描述，从以下维度中找出"用户未提及"且"对拆解最关键"的3项：
   - 成果形式/目标（要产出什么？成功标准？）
   - 范围/边界（重点在哪？哪些不做？）
   - 现有资源（已有什么材料/信息/依赖？）
   - 时间节奏（关键节点？各阶段预期时长？）
   - 协作/依赖（涉及谁？需要谁提供什么？）
   - 执行起点（从哪最容易上手？第一步可能做什么？）
   - 潜在障碍（最担心什么？哪部分最不确定？）

3️⃣ **问题设计**（遵循"成果→资源/边界→启动/障碍"递进）
   - 第1问：优先澄清具体产出或成功标准
   - 第2问：优先盘点已有资源/材料或任务重点范围
   - 第3问：优先引导执行起点或潜在障碍
   - **互补性检查**：三问必须覆盖不同维度，避免重复

**质量自检**（出题前确认）：
✓ 每问是否面向具体、可观察的信息（而非抽象概念/情绪）？
✓ 是否都是开放式问题（而非是/否题）？
✓ 是否避免了显而易见/笼统/复杂嵌套的问题？
✓ **是否避免了工具/格式/技术细节**（多问"用来干什么""在什么状态"，少问"用什么做""什么格式"）？
✓ **是否避免了过于细碎的信息收集**（如"收集了哪些字段"应改为"现在在什么状态/有多少"）？
✓ 三问是否互补且符合递进逻辑？

请直接输出3个问题（每行以"- "开头，不要任何额外文字）：`

    // Add English instruction to ensure English output
    const userPromptWithEnglish = userPrompt + `

**CRITICAL: Generate ALL 3 questions in ENGLISH ONLY. Do NOT respond in Chinese. Each question must start with "- "`

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
          { role: 'user', content: userPromptWithEnglish }
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









