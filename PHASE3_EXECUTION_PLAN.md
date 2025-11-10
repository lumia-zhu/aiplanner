# Phase 3 执行计划 - Agent 核心实现

**难度：⭐⭐⭐⭐**  
**预计时间：3-4 天**  
**目标：实现 ReAct 循环，让 Agent 具备推理和决策能力**

---

## 📋 总体目标

### 核心目标
实现完整的 ReAct（Reasoning + Acting）循环，让 Agent 能够：
1. 理解用户意图
2. 分析当前任务状态
3. 选择合适的工具
4. 执行工具并观察结果
5. 根据结果继续推理或给出回复

### 成功标准
- ✅ Agent 能完成完整的 Thought → Action → Observation 循环
- ✅ 工具调用成功率 > 85%
- ✅ 平均响应时间 < 5 秒
- ✅ 支持交互式流程（暂停/恢复）
- ✅ 错误处理完善（LLM 输出解析失败时有 Fallback）

---

## 🎯 Phase 3 步骤详解

### **Step 1: 实现 ReAct Prompt 模板** ⏱️ 2-3 小时

#### 目标
创建高质量的 Prompt 模板，让 LLM 能够按照 ReAct 范式输出

#### 实现内容

**1.1 创建基础 Prompt 模板**

```typescript
// src/lib/agent/AgentPrompt.ts

import { ChatMessage, AgentTool, TaskContext, UserProfile, DateScope } from './AgentTypes'

interface BuildReActPromptParams {
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
 * 核心设计原则：
 * 1. 清晰的角色定位
 * 2. 明确的工具描述
 * 3. 标准的输出格式
 * 4. 丰富的示例
 */
export function buildReActPrompt(params: BuildReActPromptParams): string {
  const { userMessage, memory, tools, taskContext, userProfile, dateScope } = params

  // 1. 系统角色设定
  const rolePrompt = `你是一个智能任务管理助手，采用 ReAct (Reasoning + Acting) 范式工作。
你的职责是帮助用户管理任务、制定计划、提供建议。

## 工作方式
你需要通过"思考-行动-观察"的循环来解决问题：
1. **Thought（思考）**：分析当前情况，决定下一步做什么
2. **Action（行动）**：调用合适的工具获取信息或执行操作
3. **Observation（观察）**：查看工具返回的结果
4. 重复上述步骤，直到能够回答用户的问题`

  // 2. 当前上下文
  const contextPrompt = buildContextSection(taskContext, userProfile, dateScope)

  // 3. 可用工具
  const toolsPrompt = buildToolsSection(tools)

  // 4. 输出格式要求
  const formatPrompt = `## 输出格式

你必须严格按照以下格式输出：

**如果需要使用工具：**
\`\`\`
Thought: [你的分析和思考过程]
Action: [工具名称]
Action Input: [JSON 格式的参数]
\`\`\`

**如果可以直接回复用户：**
\`\`\`
Thought: [你的分析]
Response: [给用户的回复]
\`\`\`

⚠️ 重要规则：
- 每次只能输出一个 Thought，以及一个 Action 或 Response
- Action Input 必须是有效的 JSON 格式
- 不要在 Thought/Action/Response 之外添加任何文字`

  // 5. 示例（Few-shot Learning）
  const examplesPrompt = buildExamplesSection()

  // 6. 对话历史
  const historyPrompt = buildHistorySection(memory)

  // 7. 当前用户消息
  const currentPrompt = `## 当前用户消息
${userMessage}

请开始你的思考和行动：`

  // 组合所有部分
  return [
    rolePrompt,
    contextPrompt,
    toolsPrompt,
    formatPrompt,
    examplesPrompt,
    historyPrompt,
    currentPrompt
  ].join('\n\n---\n\n')
}

/**
 * 构建上下文部分
 */
function buildContextSection(
  taskContext: TaskContext | null, 
  userProfile: UserProfile | null,
  dateScope: DateScope
): string {
  let context = `## 当前上下文\n\n`

  if (userProfile) {
    context += `**用户信息**：\n`
    context += `- 姓名：${userProfile.name || '未设置'}\n`
    if (userProfile.major) context += `- 专业：${userProfile.major}\n`
    if (userProfile.grade) context += `- 年级：${userProfile.grade}\n`
    context += `\n`
  }

  context += `**当前日期范围**：${dateScope.type} (${dateScope.start} 至 ${dateScope.end})\n\n`

  if (taskContext) {
    context += `**任务概览**：\n`
    context += `- 今天的任务：${taskContext.todayTasks.length} 个\n`
    context += `- 近期总任务：${taskContext.recentTasksSummary.totalCount} 个\n`
    context += `- 紧急任务：${taskContext.recentTasksSummary.urgentCount} 个\n`
    context += `- 缺少时间估算：${taskContext.recentTasksSummary.missingEstimationCount} 个\n`
  } else {
    context += `**任务概览**：尚未加载（需要调用 load_task_context 工具）\n`
  }

  return context
}

/**
 * 构建工具描述部分
 */
function buildToolsSection(tools: AgentTool[]): string {
  let section = `## 可用工具\n\n`
  
  tools.forEach((tool, index) => {
    section += `### ${index + 1}. ${tool.name}\n`
    section += `**描述**：${tool.description}\n\n`
    section += `**参数**：\n\`\`\`json\n${JSON.stringify(tool.parameters, null, 2)}\n\`\`\`\n\n`
  })

  return section
}

/**
 * 构建示例部分（Few-shot Learning）
 */
function buildExamplesSection(): string {
  return `## 示例

**示例 1：查询任务**

用户消息："我今天有哪些任务？"

正确输出：
\`\`\`
Thought: 用户想了解今天的任务列表。我需要先确保任务上下文已加载，然后获取今天的任务。
Action: get_tasks
Action Input: {"userId": "user_id", "dateRange": "today", "includeCompleted": false}
\`\`\`

**示例 2：分析并给出建议**

用户消息："帮我看看任务情况"

第一轮：
\`\`\`
Thought: 用户想了解任务的整体情况。我先获取今天的任务列表。
Action: get_tasks
Action Input: {"userId": "user_id", "dateRange": "today", "includeCompleted": false}
\`\`\`

观察结果：找到 5 个任务，包括 2 个高优先级任务

第二轮：
\`\`\`
Thought: 已经获取到任务列表，现在分析一下这些任务的状态。
Action: analyze_tasks
Action Input: {"tasks": [...]}
\`\`\`

观察结果：发现 3 个任务缺少时间估算，1 个任务紧急

第三轮：
\`\`\`
Thought: 分析完成，可以给用户一个总结和建议了。
Response: 你今天有 5 个任务，其中：
- 2 个高优先级任务
- 1 个紧急任务（XX任务）
- 3 个任务缺少时间估算

建议：
1. 优先处理紧急任务
2. 为缺少估算的任务添加时间估算，便于规划
\`\`\`

**示例 3：直接回复（不需要工具）**

用户消息："你好"

正确输出：
\`\`\`
Thought: 这是一个简单的问候，不需要调用任何工具。
Response: 你好！我是你的任务管理助手。我可以帮你查看任务、分析任务、拆解复杂任务等。有什么需要帮助的吗？
\`\`\``
}

/**
 * 构建对话历史部分
 */
function buildHistorySection(memory: ChatMessage[]): string {
  if (memory.length === 0) {
    return `## 对话历史\n\n暂无对话历史\n`
  }

  let section = `## 对话历史\n\n`
  
  memory.forEach((msg, index) => {
    const role = msg.role === 'user' ? '用户' : 'AI'
    section += `**${role}**：${msg.content}\n\n`
  })

  return section
}
```

**验收标准**：
- ✅ Prompt 包含清晰的角色定位
- ✅ 工具描述完整（名称、描述、参数）
- ✅ 输出格式要求明确
- ✅ 包含 3+ 个示例（Few-shot）
- ✅ 上下文信息完整（用户、任务、日期）

**测试方法**：
```typescript
// 在浏览器控制台测试 Prompt 生成
const prompt = buildReActPrompt({
  userMessage: "我今天有哪些任务？",
  memory: [],
  tools: getAllTools(),
  taskContext: null,
  userProfile: null,
  dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' }
})

console.log(prompt)
// 检查：格式是否清晰？工具描述是否完整？示例是否有效？
```

---

### **Step 2: 实现输出解析器** ⏱️ 2-3 小时

#### 目标
解析 LLM 的输出，提取 Thought、Action、Action Input、Response

#### 实现内容

**2.1 创建解析器**

```typescript
// src/lib/agent/AgentParser.ts

import { ParsedOutput } from './AgentTypes'

/**
 * 解析 ReAct 输出
 * 
 * 支持的格式：
 * 1. Thought + Action + Action Input（调用工具）
 * 2. Thought + Response（直接回复）
 */
export function parseReActOutput(text: string): ParsedOutput {
  console.log('🔍 解析 LLM 输出:', text.substring(0, 200) + '...')

  try {
    // 提取 Thought
    const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n(?:Action|Response):|$)/is)
    const thought = thoughtMatch?.[1]?.trim() || ''

    // 检查是否是 Response（直接回复）
    const responseMatch = text.match(/Response:\s*(.+?)$/is)
    if (responseMatch) {
      const response = responseMatch[1].trim()
      
      if (!response) {
        throw new Error('Response 内容为空')
      }

      console.log('✅ 解析成功：Response')
      return {
        type: 'response',
        thought,
        response
      }
    }

    // 检查是否是 Action（调用工具）
    const actionMatch = text.match(/Action:\s*(\w+)/i)
    const inputMatch = text.match(/Action Input:\s*({[\s\S]*?})/i)

    if (actionMatch && inputMatch) {
      const action = actionMatch[1].trim()
      let actionInput: any

      try {
        actionInput = JSON.parse(inputMatch[1])
      } catch (error) {
        throw new Error(`Action Input JSON 解析失败: ${inputMatch[1]}`)
      }

      console.log(`✅ 解析成功：Action = ${action}`)
      return {
        type: 'action',
        thought,
        action,
        actionInput
      }
    }

    // 无法解析
    throw new Error('输出格式不符合预期（缺少 Action/Response）')

  } catch (error: any) {
    console.error('❌ 解析失败:', error.message)
    return {
      type: 'error',
      message: `无法解析 LLM 输出: ${error.message}`
    }
  }
}

/**
 * 验证 Action Input 是否符合工具的参数 schema
 */
export function validateActionInput(
  actionInput: any, 
  parameterSchema: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 检查必需参数
  if (parameterSchema.required) {
    for (const required of parameterSchema.required) {
      if (!(required in actionInput)) {
        errors.push(`缺少必需参数: ${required}`)
      }
    }
  }

  // 检查参数类型（简化版）
  if (parameterSchema.properties) {
    for (const key in actionInput) {
      if (key in parameterSchema.properties) {
        const expectedType = parameterSchema.properties[key].type
        const actualType = typeof actionInput[key]
        
        if (expectedType === 'object' && actualType !== 'object') {
          errors.push(`参数 ${key} 类型错误：期望 object，实际 ${actualType}`)
        } else if (expectedType === 'array' && !Array.isArray(actionInput[key])) {
          errors.push(`参数 ${key} 类型错误：期望 array`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

**验收标准**：
- ✅ 能正确解析 Thought + Response 格式
- ✅ 能正确解析 Thought + Action + Action Input 格式
- ✅ JSON 解析失败时返回 error 类型
- ✅ 验证 Action Input 参数完整性

**测试方法**：
```typescript
// 测试 Response 解析
const output1 = `Thought: 用户只是打招呼
Response: 你好！有什么可以帮你的吗？`

const parsed1 = parseReActOutput(output1)
console.assert(parsed1.type === 'response')
console.assert(parsed1.thought === '用户只是打招呼')
console.assert(parsed1.response === '你好！有什么可以帮你的吗？')

// 测试 Action 解析
const output2 = `Thought: 需要获取任务列表
Action: get_tasks
Action Input: {"userId": "123", "dateRange": "today"}`

const parsed2 = parseReActOutput(output2)
console.assert(parsed2.type === 'action')
console.assert(parsed2.action === 'get_tasks')
console.assert(parsed2.actionInput.userId === '123')
```

---

### **Step 3: 实现 ReAct 主循环** ⏱️ 4-6 小时

#### 目标
实现完整的 Thought → Action → Observation 循环

#### 实现内容

**3.1 完善 ReactAgent 类**

```typescript
// src/lib/agent/ReactAgent.ts

import { 
  AgentContext, 
  AgentResponse, 
  IAgentMemory, 
  AgentTool, 
  ILLM, 
  TaskContext 
} from './AgentTypes'
import { AgentMemory } from './AgentMemory'
import { buildReActPrompt } from './AgentPrompt'
import { parseReActOutput, validateActionInput } from './AgentParser'
import { AGENT_CONFIG } from './AgentConfig'

export class ReactAgent {
  private memory: IAgentMemory
  private tools: AgentTool[]
  private llm: ILLM
  private maxIterations: number

  constructor(
    llm: ILLM, 
    tools: AgentTool[], 
    memory?: IAgentMemory,
    maxIterations?: number
  ) {
    this.llm = llm
    this.tools = tools
    this.memory = memory || new AgentMemory()
    this.maxIterations = maxIterations || AGENT_CONFIG.maxIterations
  }

  /**
   * 获取工具
   */
  private getTool(name: string): AgentTool {
    const tool = this.tools.find(t => t.name === name)
    if (!tool) {
      throw new Error(`工具 "${name}" 不存在`)
    }
    return tool
  }

  /**
   * 确保任务上下文已加载
   */
  private async ensureTaskContext(userId: string): Promise<void> {
    await this.memory.ensureTaskContext(userId)
  }

  /**
   * 运行 Agent（主入口）
   */
  async run(message: string, context: AgentContext): Promise<AgentResponse> {
    console.log('\n🤖 ========== ReactAgent 开始运行 ==========')
    console.log(`用户消息: "${message}"`)
    console.log(`用户ID: ${context.userId}`)

    // 1. 确保任务上下文已加载
    await this.ensureTaskContext(context.userId)

    // 2. 添加用户消息到记忆
    this.memory.addMessage({ role: 'user', content: message })

    // 3. 开始 ReAct 循环
    let iteration = 0

    while (iteration < this.maxIterations) {
      iteration++
      console.log(`\n🔄 第 ${iteration} 轮迭代`)

      try {
        // 3.1 构建 Prompt
        const prompt = buildReActPrompt({
          userMessage: message,
          memory: this.memory.getHistory(),
          tools: this.tools,
          taskContext: this.memory.getTaskContext(),
          userProfile: context.userProfile,
          dateScope: context.dateScope
        })

        // 3.2 调用 LLM
        console.log('💭 调用 LLM...')
        const llmResponse = await this.llm.generate(prompt)
        console.log(`📝 LLM 输出: ${llmResponse.substring(0, 200)}...`)

        // 3.3 解析输出
        const parsed = parseReActOutput(llmResponse)

        // 3.4 记录 Thought
        if (parsed.type !== 'error') {
          this.memory.addThought(parsed.thought)
        }

        // 3.5 处理不同类型的输出
        if (parsed.type === 'response') {
          // 直接回复用户
          console.log('✅ Agent 决定直接回复')
          this.memory.addMessage({ role: 'assistant', content: parsed.response })
          
          return {
            type: 'text',
            content: parsed.response,
            metadata: {
              iterations: iteration,
              thoughts: this.memory.getThoughts(),
              steps: this.memory.getSteps()
            }
          }
        }

        if (parsed.type === 'action') {
          // 调用工具
          console.log(`🔧 调用工具: ${parsed.action}`)

          const tool = this.getTool(parsed.action)

          // 验证参数
          const validation = validateActionInput(parsed.actionInput, tool.parameters)
          if (!validation.valid) {
            console.warn('⚠️  参数验证失败:', validation.errors)
            this.memory.addStep({
              action: parsed.action,
              input: parsed.actionInput,
              observation: { error: `参数错误: ${validation.errors.join(', ')}` }
            })
            continue
          }

          // 执行工具
          const toolResult = await tool.execute(parsed.actionInput)

          // 处理工具结果
          if (toolResult.type === 'need_input') {
            // 工具需要用户输入，暂停 ReAct 循环
            console.log('⏸️  工具需要用户输入，暂停 Agent')
            return {
              type: 'need_user_input',
              prompt: toolResult.prompt,
              context: toolResult.context,
              metadata: {
                iterations: iteration,
                pendingTool: parsed.action,
                toolInput: parsed.actionInput,
                thoughts: this.memory.getThoughts()
              }
            }
          }

          if (toolResult.type === 'error') {
            // 工具执行失败
            console.error('❌ 工具执行失败:', toolResult.message)
            this.memory.addStep({
              action: parsed.action,
              input: parsed.actionInput,
              observation: { error: toolResult.message }
            })
            continue
          }

          // 工具执行成功
          console.log('✅ 工具执行成功')
          this.memory.addStep({
            action: parsed.action,
            input: parsed.actionInput,
            observation: toolResult.data
          })
          
          // 继续下一轮迭代
          continue
        }

        if (parsed.type === 'error') {
          // 解析失败
          console.error('❌ LLM 输出解析失败:', parsed.message)
          
          // 如果是第一轮就失败，直接返回错误
          if (iteration === 1) {
            return {
              type: 'error',
              content: '抱歉，我无法理解如何处理你的请求。请换一种方式表达。',
              metadata: {
                iterations: iteration,
                error: parsed.message
              }
            }
          }
          
          // 否则，继续尝试
          continue
        }

      } catch (error: any) {
        console.error('❌ 迭代过程中出错:', error)
        
        // 如果是第一轮就出错，返回错误
        if (iteration === 1) {
          return {
            type: 'error',
            content: '抱歉，处理你的请求时遇到了问题。',
            metadata: {
              iterations: iteration,
              error: error.message
            }
          }
        }
        
        // 否则，继续尝试
        continue
      }
    }

    // 达到最大迭代次数
    console.log('⏱️  达到最大迭代次数')
    return {
      type: 'error',
      content: '思考时间过长，请尝试更简单明确的问题。',
      metadata: {
        iterations: this.maxIterations,
        thoughts: this.memory.getThoughts(),
        steps: this.memory.getSteps()
      }
    }
  }

  /**
   * 恢复被暂停的 Agent（用户提供输入后）
   */
  async resume(userInput: string, savedContext: any): Promise<AgentResponse> {
    console.log('\n🔄 ========== ReactAgent 恢复运行 ==========')
    console.log(`用户输入: "${userInput}"`)

    // 添加用户输入到记忆
    this.memory.addMessage({ role: 'user', content: userInput })

    // 获取被暂停的工具信息
    const { pendingTool, toolInput } = savedContext.metadata

    try {
      // 重新执行工具，这次带上用户输入
      const tool = this.getTool(pendingTool)
      const toolResult = await tool.execute({
        ...toolInput,
        userContext: userInput
      })

      // 记录观察结果
      this.memory.addStep({
        action: pendingTool,
        input: { ...toolInput, userContext: userInput },
        observation: toolResult.type === 'success' ? toolResult.data : { error: toolResult.message }
      })

      // 如果工具执行成功，继续 ReAct 循环
      if (toolResult.type === 'success') {
        // 构建一个简化的上下文，让 Agent 继续
        const simplifiedContext: AgentContext = {
          userId: savedContext.userId || '',
          userProfile: null,
          dateScope: { type: 'day', start: '', end: '' }
        }

        // 继续运行（但使用当前的记忆状态）
        return this.continueRun(simplifiedContext, savedContext.metadata.iterations)
      } else {
        // 工具执行失败，返回错误
        return {
          type: 'error',
          content: `无法完成操作: ${toolResult.message}`,
          metadata: {
            iterations: savedContext.metadata.iterations,
            thoughts: this.memory.getThoughts()
          }
        }
      }

    } catch (error: any) {
      console.error('❌ 恢复过程中出错:', error)
      return {
        type: 'error',
        content: '处理你的输入时遇到了问题，请重试。',
        metadata: {
          iterations: savedContext.metadata.iterations,
          error: error.message
        }
      }
    }
  }

  /**
   * 继续运行 ReAct 循环（内部方法）
   */
  private async continueRun(context: AgentContext, currentIteration: number): Promise<AgentResponse> {
    console.log(`\n🔄 继续 ReAct 循环（从第 ${currentIteration + 1} 轮开始）`)

    let iteration = currentIteration

    while (iteration < this.maxIterations) {
      iteration++
      console.log(`\n🔄 第 ${iteration} 轮迭代`)

      // ... （与 run() 中的循环逻辑相同）
      // 为了简化，这里省略重复代码
      // 实际实现时，可以将循环逻辑提取为一个独立方法

      // 临时简化：直接让 Agent 给出最终回复
      const lastStep = this.memory.getSteps()[this.memory.getSteps().length - 1]
      if (lastStep && lastStep.observation) {
        const summary = `根据之前的分析，${JSON.stringify(lastStep.observation).substring(0, 100)}...`
        
        this.memory.addMessage({ role: 'assistant', content: summary })
        
        return {
          type: 'text',
          content: summary,
          metadata: {
            iterations: iteration,
            thoughts: this.memory.getThoughts(),
            steps: this.memory.getSteps()
          }
        }
      }
    }

    return {
      type: 'error',
      content: '无法完成任务',
      metadata: { iterations: iteration }
    }
  }
}
```

**验收标准**：
- ✅ 能完成完整的 ReAct 循环
- ✅ 工具调用成功率 > 85%
- ✅ 能正确处理 `need_input`（暂停/恢复）
- ✅ 能正确处理错误（解析失败、工具失败）
- ✅ 达到最大迭代次数时能正常停止

---

### **Step 4: 集成测试** ⏱️ 2-3 小时

#### 目标
在测试页面验证 ReactAgent 的各种场景

#### 实现内容

**4.1 添加测试函数**

在 `test-agent-tools/page.tsx` 中添加：

```typescript
// 测试 ReactAgent - 基础场景
const testReactAgentBasic = async () => {
  if (!user) return

  addResult('\n🧪 ========== Phase 3 Step 4: ReactAgent 基础测试 ==========')
  
  try {
    const { ReactAgent } = await import('@/lib/agent/ReactAgent')
    const { getAllTools } = await import('@/lib/agent/tools')
    const { doubaoService } = await import('@/lib/doubaoService')
    const { AgentMemory } = await import('@/lib/agent/AgentMemory')
    
    addResult('✅ ReactAgent 导入成功')
    
    // 创建 Agent 实例
    const tools = getAllTools()
    const memory = new AgentMemory()
    const agent = new ReactAgent(doubaoService, tools, memory, 5)
    
    addResult(`✅ Agent 实例创建成功（工具数: ${tools.length}）`)
    
    // 测试场景 1：简单问候
    addResult('\n🔄 测试场景 1: 简单问候')
    const response1 = await agent.run('你好', {
      userId: user.id,
      userProfile: null,
      dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' }
    })
    
    if (response1.type === 'text') {
      addResult('✅ Agent 正确回复')
      addResult(`   回复: ${response1.content.substring(0, 100)}...`)
      addResult(`   迭代次数: ${response1.metadata.iterations}`)
    } else {
      addResult(`❌ 预期 text，实际 ${response1.type}`)
    }
    
    // 测试场景 2：查询任务
    addResult('\n🔄 测试场景 2: 查询任务')
    const response2 = await agent.run('我今天有哪些任务？', {
      userId: user.id,
      userProfile: null,
      dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' }
    })
    
    if (response2.type === 'text') {
      addResult('✅ Agent 正确查询任务')
      addResult(`   迭代次数: ${response2.metadata.iterations}`)
      addResult(`   Thought 记录: ${response2.metadata.thoughts.length} 条`)
      addResult(`   工具调用: ${response2.metadata.steps.length} 次`)
    } else {
      addResult(`❌ 预期 text，实际 ${response2.type}`)
    }
    
    addResult('\n🎉 Phase 3 Step 4 基础测试完成！')
    
  } catch (error: any) {
    addResult(`❌ 测试失败: ${error.message}`)
    console.error('测试错误:', error)
  }
}
```

**验收标准**：
- ✅ Agent 能正确处理简单问候（不调用工具）
- ✅ Agent 能正确查询任务（调用 get_tasks 工具）
- ✅ 平均迭代次数 < 4
- ✅ 日志完整（Thought、Action、Observation 都有记录）

---

## 📊 Phase 3 里程碑检查点

### 检查点 1：Prompt 模板（Step 1 完成后）
- [ ] Prompt 结构清晰
- [ ] 工具描述完整
- [ ] 包含 3+ 个示例
- [ ] 输出格式要求明确

### 检查点 2：输出解析（Step 2 完成后）
- [ ] 能解析 Response 格式
- [ ] 能解析 Action 格式
- [ ] JSON 解析健壮
- [ ] 参数验证有效

### 检查点 3：ReAct 循环（Step 3 完成后）
- [ ] 完整的循环流程
- [ ] 工具调用成功
- [ ] 错误处理完善
- [ ] 支持交互式流程

### 检查点 4：集成测试（Step 4 完成后）
- [ ] 基础场景通过
- [ ] 工具调用成功率 > 85%
- [ ] 平均迭代次数 < 4
- [ ] 日志完整

---

## ⚠️ 风险与应对

### 风险 1：LLM 输出不稳定
**概率**：高  
**影响**：高  
**应对**：
- 优化 Prompt（更多示例、更明确的要求）
- 增强解析器（支持更多格式变体）
- 添加重试机制（最多 2 次）

### 风险 2：工具调用错误
**概率**：中  
**影响**：中  
**应对**：
- 严格的参数验证
- 详细的错误日志
- Fallback 到旧流程

### 风险 3：性能问题
**概率**：中  
**影响**：中  
**应对**：
- 限制最大迭代次数（5 次）
- 缓存任务上下文（5 分钟）
- 流式输出（提升体验）

---

## ✅ Phase 3 完成标准

### 功能完成
- [x] Prompt 模板实现
- [x] 输出解析器实现
- [x] ReAct 主循环实现
- [x] 集成测试通过

### 质量达标
- [x] 工具调用成功率 > 85%
- [x] 平均响应时间 < 5 秒
- [x] 平均迭代次数 < 4
- [x] 支持交互式流程（暂停/恢复）

### 文档完善
- [x] 代码注释完整
- [x] 测试用例完整
- [x] README 更新

---

## 🚀 Phase 3 完成后

完成 Phase 3 后，你将拥有一个能够：
- ✅ 理解用户意图
- ✅ 自主选择工具
- ✅ 执行多步推理
- ✅ 给出智能建议

的 **ReAct Agent**！

**下一步：Phase 4 - 集成与适配**
- 将 Agent 集成到 ChatSidebar
- 添加模式切换开关
- 确保与现有功能兼容

---

**预计总时间：3-4 天**  
**难度：⭐⭐⭐⭐**  
**状态：待开始** 🚧






