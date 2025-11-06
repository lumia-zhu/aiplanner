/**
 * Agent Prompt 模板
 * 
 * 基于 ReAct (Reasoning and Acting) 范式
 * 参考论文：https://arxiv.org/abs/2210.03629
 * 
 * Phase 3 Step 1
 */

import { ChatMessage, AgentTool, TaskContext, UserProfile, DateScope } from './AgentTypes'
import { format } from 'date-fns'

/**
 * ReAct Prompt 构建参数
 */
export interface BuildReActPromptParams {
  userMessage: string
  memory: ChatMessage[]
  tools: AgentTool[]
  taskContext: TaskContext | null
  userProfile: UserProfile | null
  dateScope: DateScope
}

/**
 * 构建 ReAct Prompt
 * 
 * 核心设计原则（基于 ReAct 论文）：
 * 1. 明确的角色定位
 * 2. 清晰的推理-行动范式
 * 3. 丰富的 Few-shot 示例
 * 4. 严格的输出格式
 */
export function buildReActPrompt(params: BuildReActPromptParams): string {
  const { userMessage, memory, tools, taskContext, userProfile, dateScope } = params

  // 1. 系统角色设定（基于 ReAct 范式）
  const rolePrompt = `你是一个智能任务管理助手，采用 ReAct (Reasoning and Acting) 范式工作。

## 核心工作方式

你通过"推理-行动-观察"的循环来解决问题：

1. **Thought (推理)**：分析当前情况，思考下一步应该做什么
2. **Action (行动)**：选择合适的工具来获取信息或执行操作  
3. **Observation (观察)**：查看工具返回的结果
4. **重复循环**：根据观察结果继续推理，直到能够回答用户

## 你的能力

- 📋 查询和分析任务
- 🔍 识别需要处理的问题（紧急、缺少估算、需要澄清等）
- 💡 提供智能建议
- 🤔 通过提问帮助用户澄清任务
- ✂️ 拆解复杂任务为子任务
- ⏱️ 估算任务所需时间`

  // 2. 当前上下文
  const contextPrompt = buildContextSection(taskContext, userProfile, dateScope)

  // 3. 可用工具
  const toolsPrompt = buildToolsSection(tools)

  // 4. 输出格式要求（严格遵循 ReAct 格式）
  const formatPrompt = `## 输出格式要求

⚠️ **你必须严格按照以下格式输出，不要添加任何其他文字：**

### 格式 A：需要调用工具
\`\`\`
Thought: [你的分析和推理过程，思考为什么需要这个工具]
Action: [工具名称，必须是上面列出的工具之一]
Action Input: [JSON 格式的参数，必须符合工具的参数 schema]
\`\`\`

### 格式 B：可以直接回复用户
\`\`\`
Thought: [你的分析，说明为什么现在可以回复用户]
Response: [给用户的回复内容]
\`\`\`

### 关键规则

1. ✅ **每次只输出一个 Thought**，以及一个 Action 或一个 Response
2. ✅ **Action Input 必须是有效的 JSON**，可以使用 JSON.stringify() 验证
3. ✅ **Action 必须是可用工具列表中的名称**，不能自创工具名
4. ✅ **Thought 要简洁明了**，说明你的推理过程
5. ❌ **不要在 Thought/Action/Response 之外添加任何解释文字**
6. ❌ **不要一次输出多个 Action**，每次只调用一个工具`

  // 5. Few-shot 示例（关键！）
  const examplesPrompt = buildExamplesSection()

  // 6. 对话历史
  const historyPrompt = buildHistorySection(memory)

  // 7. 当前用户消息
  const currentPrompt = `## 当前用户消息

用户说：${userMessage}

---

现在，请开始你的推理和行动（严格按照上述格式输出）：`

  // 组合所有部分
  const fullPrompt = [
    rolePrompt,
    contextPrompt,
    toolsPrompt,
    formatPrompt,
    examplesPrompt,
    historyPrompt,
    currentPrompt
  ].join('\n\n' + '='.repeat(80) + '\n\n')

  console.log('📝 ReAct Prompt 构建完成')
  console.log(`   长度: ${fullPrompt.length} 字符`)
  console.log(`   工具数: ${tools.length}`)
  console.log(`   对话历史: ${memory.length} 条`)

  return fullPrompt
}

/**
 * 构建上下文部分
 */
function buildContextSection(
  taskContext: TaskContext | null,
  userProfile: UserProfile | null,
  dateScope: DateScope
): string {
  let section = `## 当前上下文\n\n`

  // 用户信息
  if (userProfile) {
    section += `**用户信息**：\n`
    section += `- 姓名：${userProfile.name || '未设置'}\n`
    if (userProfile.major) section += `- 专业：${userProfile.major}\n`
    if (userProfile.grade) section += `- 年级：${userProfile.grade}\n`
    section += `\n`
  }

  // 日期范围
  section += `**当前日期范围**：${dateScope.type === 'day' ? '今天' : dateScope.type === 'week' ? '本周' : '本月'}\n`
  section += `- 开始：${dateScope.start}\n`
  section += `- 结束：${dateScope.end}\n\n`

  // 任务概览
  if (taskContext) {
    section += `**任务概览**（已加载）：\n`
    section += `- 📅 今天的任务：${taskContext.todayTasks.length} 个\n`
    section += `- 📊 近3个月总任务：${taskContext.recentTasksSummary.totalCount} 个\n`
    section += `- 🔥 紧急任务（即将到期）：${taskContext.recentTasksSummary.urgentCount} 个\n`
    section += `- ⏱️ 缺少时间估算：${taskContext.recentTasksSummary.missingEstimationCount} 个\n\n`

    // 月度统计
    section += `**月度统计**：\n`
    const { byMonth } = taskContext.recentTasksSummary
    section += `- 上个月 (${byMonth.previousMonth.date}): ${byMonth.previousMonth.completed}/${byMonth.previousMonth.total} 完成\n`
    section += `- 当前月 (${byMonth.currentMonth.date}): ${byMonth.currentMonth.completed}/${byMonth.currentMonth.total} 完成\n`
    section += `- 下个月 (${byMonth.nextMonth.date}): ${byMonth.nextMonth.completed}/${byMonth.nextMonth.total} 完成\n`
  } else {
    section += `**任务概览**：⚠️ 尚未加载\n`
    section += `> 💡 提示：你可以先调用 \`load_task_context\` 工具来加载用户的任务信息\n`
  }

  return section
}

/**
 * 构建工具描述部分
 */
function buildToolsSection(tools: AgentTool[]): string {
  let section = `## 可用工具清单\n\n`
  section += `你可以调用以下 ${tools.length} 个工具来完成任务：\n\n`

  tools.forEach((tool, index) => {
    section += `### ${index + 1}. \`${tool.name}\`\n\n`
    section += `**功能**：${tool.description}\n\n`
    section += `**参数格式**：\n\`\`\`json\n${JSON.stringify(tool.parameters, null, 2)}\n\`\`\`\n\n`
    
    // 添加必需参数提示
    if (tool.parameters.required && tool.parameters.required.length > 0) {
      section += `**必需参数**：${tool.parameters.required.join(', ')}\n\n`
    }
  })

  return section
}

/**
 * 构建 Few-shot 示例部分
 * 
 * 这是 ReAct 效果的关键！提供丰富的示例让 LLM 学会正确的输出格式
 */
function buildExamplesSection(): string {
  return `## 示例（请严格遵循以下格式）

### 📘 示例 1：简单问候（不需要工具）

**用户消息**：你好

**正确输出**：
\`\`\`
Thought: 这是一个简单的问候，不需要调用任何工具，我可以直接友好地回复。
Response: 你好！我是你的任务管理助手。我可以帮你：
- 📋 查看和分析任务
- 🤔 澄清任务细节
- ✂️ 拆解复杂任务
- ⏱️ 估算任务时间

有什么需要帮助的吗？
\`\`\`

---

### 📘 示例 2：查询任务（单步调用工具）

**用户消息**：我今天有哪些任务？

**第 1 轮输出**：
\`\`\`
Thought: 用户想了解今天的任务列表。我需要调用 get_tasks 工具来获取今天的任务。
Action: get_tasks
Action Input: {"userId": "user_id_placeholder", "dateRange": "today", "includeCompleted": false}
\`\`\`

**观察结果**：找到 3 个任务

**第 2 轮输出**：
\`\`\`
Thought: 已经成功获取到任务列表，现在可以告诉用户了。
Response: 你今天有 3 个任务：
1. [任务1标题] - 优先级：高
2. [任务2标题] - 优先级：中
3. [任务3标题] - 优先级：低

需要我帮你分析这些任务吗？
\`\`\`

---

### 📘 示例 3：多步推理（查询 + 分析）

**用户消息**：帮我看看任务情况

**第 1 轮输出**：
\`\`\`
Thought: 用户想了解任务的整体情况。我先获取今天的任务列表，然后再分析。
Action: get_tasks
Action Input: {"userId": "user_id_placeholder", "dateRange": "today", "includeCompleted": false}
\`\`\`

**观察结果**：找到 5 个任务

**第 2 轮输出**：
\`\`\`
Thought: 已经获取到任务列表，现在需要分析这些任务的状态，看看有没有需要特别注意的问题。
Action: analyze_tasks
Action Input: {"tasks": [...]}
\`\`\`

**观察结果**：分析完成，发现 2 个紧急任务，3 个缺少时间估算

**第 3 轮输出**：
\`\`\`
Thought: 分析完成，我现在可以给用户一个全面的总结和建议了。
Response: 📊 任务情况分析：

你今天有 5 个任务，整体情况如下：

⚠️ **需要注意**：
- 🔥 有 2 个紧急任务需要优先处理
- ⏱️ 有 3 个任务缺少时间估算

💡 **建议**：
1. 先处理紧急任务
2. 为缺少估算的任务添加时间预估，便于规划
3. 如果有任务不清楚如何执行，可以让我帮你澄清或拆解

需要我进一步帮助吗？
\`\`\`

---

### 📘 示例 4：交互式工具（需要用户输入）

**用户消息**：帮我拆解"准备论文答辩"这个任务

**第 1 轮输出**：
\`\`\`
Thought: 用户想拆解一个任务。我需要调用 decompose_task 工具，这个工具会询问用户一些问题来更好地拆解任务。
Action: decompose_task
Action Input: {"task": {"id": "task_id", "title": "准备论文答辩", "description": ""}, "userContext": null}
\`\`\`

**观察结果**：工具返回需要用户输入（need_input）

> **注意**：此时 Agent 会暂停，等待用户回答工具提出的问题

---

### ❌ 错误示例（不要这样做）

**错误 1：在输出中添加额外文字**
\`\`\`
好的，让我帮你查一下。

Thought: 需要获取任务
Action: get_tasks
...
\`\`\`
❌ 不要在 Thought 前添加任何文字！

---

**错误 2：一次调用多个工具**
\`\`\`
Thought: 我需要获取任务并分析
Action: get_tasks, analyze_tasks
...
\`\`\`
❌ 每次只能调用一个工具！

---

**错误 3：Action Input 不是 JSON**
\`\`\`
Action: get_tasks
Action Input: 获取今天的任务
\`\`\`
❌ Action Input 必须是有效的 JSON 格式！`
}

/**
 * 构建对话历史部分
 */
function buildHistorySection(memory: ChatMessage[]): string {
  if (memory.length === 0) {
    return `## 对话历史\n\n暂无对话历史（这是对话的开始）\n`
  }

  let section = `## 对话历史\n\n`
  section += `以下是之前的对话内容（供你参考）：\n\n`

  memory.forEach((msg, index) => {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 助手'
    section += `**${role}**：${msg.content}\n\n`
  })

  return section
}


