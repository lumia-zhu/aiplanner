# Phase 1 执行计划 - 基础设施搭建

## 🎯 目标
创建 Agent 框架的基础设施，**不影响现有功能**，为后续开发打好基础。

---

## ✅ 第一步：创建目录结构和基础文件

### 步骤 1.1: 创建目录结构（5分钟）

```bash
# 进入项目目录
cd task-manager

# 创建 Agent 目录结构
mkdir -p src/lib/agent/tools
mkdir -p src/lib/agent/adapters

# 验证目录创建成功
ls -la src/lib/agent
```

**预期输出**:
```
src/lib/agent/
├── tools/
└── adapters/
```

---

### 步骤 1.2: 创建类型定义文件（15分钟）

创建 `src/lib/agent/AgentTypes.ts`:

```typescript
/**
 * Agent 核心类型定义
 * 
 * 这个文件定义了 Agent 系统中所有核心类型，包括：
 * - 工具接口（AgentTool）
 * - 工具执行结果（ToolResult）
 * - Agent 上下文（AgentContext）
 * - Agent 响应（AgentResponse）
 */

import type { Task, UserProfile, DateScope } from '@/types'

// ==================== 工具相关类型 ====================

/**
 * 工具执行结果
 * 
 * 支持三种类型：
 * 1. success: 执行成功，返回数据
 * 2. need_input: 需要用户输入（暂停 ReAct 循环）
 * 3. error: 执行失败
 */
export type ToolResult = 
  | {
      type: 'success'
      data: any
    }
  | {
      type: 'need_input'
      prompt: string      // 要询问用户的问题
      context: any        // 上下文信息（用于恢复流程）
    }
  | {
      type: 'error'
      message: string
    }

/**
 * 工具参数定义
 */
export interface ParameterSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    required?: boolean
  }>
  required?: string[]
}

/**
 * Agent 工具接口
 * 
 * 所有工具必须实现这个接口
 */
export interface AgentTool {
  /** 工具名称（唯一标识） */
  name: string
  
  /** 工具描述（供 LLM 理解工具用途） */
  description: string
  
  /** 参数定义 */
  parameters: ParameterSchema
  
  /** 执行工具 */
  execute(params: any): Promise<ToolResult>
}

// ==================== Agent 相关类型 ====================

/**
 * Agent 上下文
 * 
 * 包含 Agent 运行所需的所有上下文信息
 */
export interface AgentContext {
  /** 用户 ID */
  userId: string
  
  /** 用户资料 */
  userProfile: UserProfile | null
  
  /** 日期范围 */
  dateScope: DateScope
  
  /** 当前任务列表（可选，用于优化性能） */
  tasks?: Task[]
}

/**
 * Agent 响应类型
 */
export type AgentResponse = 
  | {
      type: 'text'
      content: string
      metadata?: {
        iterations: number
        thoughts: string[]
      }
    }
  | {
      type: 'need_user_input'
      prompt: string
      context: any
      metadata?: {
        iterations: number
        pendingTool: string
        toolInput: any
      }
    }
  | {
      type: 'error'
      content: string
      metadata?: {
        iterations?: number
        error?: Error
      }
    }

// ==================== ReAct 相关类型 ====================

/**
 * Thought: Agent 的思考过程
 */
export interface Thought {
  content: string
  timestamp: Date
}

/**
 * Action: Agent 的行动
 */
export interface Action {
  tool: string
  input: any
  timestamp: Date
}

/**
 * Observation: 工具执行的观察结果
 */
export interface Observation {
  result: ToolResult
  timestamp: Date
}

/**
 * ReAct 循环的一个步骤
 */
export interface ReActStep {
  thought: Thought
  action: Action
  observation: Observation
}

/**
 * 解析后的 LLM 输出
 */
export type ParsedOutput = 
  | {
      type: 'response'
      thought: string
      response: string
    }
  | {
      type: 'action'
      thought: string
      action: string
      actionInput: any
    }

// ==================== 配置相关类型 ====================

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** 是否启用 Agent 模式 */
  enabled: boolean
  
  /** 最大迭代次数 */
  maxIterations: number
  
  /** LLM 配置 */
  llm: {
    model: string
    temperature: number
    maxTokens: number
  }
  
  /** 工具列表 */
  tools: string[]
  
  /** 是否启用 Fallback */
  fallbackToLegacy: boolean
}

/**
 * Agent 记忆接口
 */
export interface IAgentMemory {
  /** 添加对话消息 */
  addMessage(message: { role: 'user' | 'assistant'; content: string }): void
  
  /** 添加思考 */
  addThought(thought: string): void
  
  /** 添加 ReAct 步骤 */
  addStep(step: { action: string; input: any; observation: any }): void
  
  /** 获取对话历史 */
  getHistory(): Array<{ role: string; content: string }>
  
  /** 获取思考历史 */
  getThoughts(): string[]
  
  /** 获取 ReAct 步骤历史 */
  getSteps(): ReActStep[]
  
  /** 清空记忆 */
  clear(): void
}
```

---

### 步骤 1.3: 创建配置文件（5分钟）

创建 `src/lib/agent/AgentConfig.ts`:

```typescript
/**
 * Agent 配置
 * 
 * 控制 Agent 模式的启用、行为参数等
 */

import type { AgentConfig } from './AgentTypes'

/**
 * 默认配置
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  // 是否启用 Agent 模式（默认关闭，通过环境变量或 UI 开启）
  enabled: process.env.NEXT_PUBLIC_AGENT_MODE === 'true',
  
  // 最大迭代次数（防止死循环）
  maxIterations: 5,
  
  // LLM 配置
  llm: {
    model: 'doubao-seed-1-6-vision-250815',
    temperature: 0.7,
    maxTokens: 1000
  },
  
  // 可用工具列表（Phase 2 会实现这些工具）
  tools: [
    'get_tasks',
    'analyze_tasks',
    'decompose_task',
    'clarify_task',
    'estimate_time'
  ],
  
  // 如果 Agent 出错，自动回退到旧流程
  fallbackToLegacy: true
}

/**
 * 获取当前配置
 */
export function getAgentConfig(): AgentConfig {
  return DEFAULT_AGENT_CONFIG
}

/**
 * 更新配置（用于测试和调试）
 */
export function updateAgentConfig(partial: Partial<AgentConfig>): AgentConfig {
  Object.assign(DEFAULT_AGENT_CONFIG, partial)
  return DEFAULT_AGENT_CONFIG
}
```

---

### 步骤 1.4: 创建占位文件（5分钟）

这些文件现在只是占位符，Phase 2/3 会实现具体逻辑：

#### 创建 `src/lib/agent/ReactAgent.ts`:

```typescript
/**
 * ReAct Agent 核心
 * 
 * TODO: Phase 3 实现
 */

import type { AgentContext, AgentResponse } from './AgentTypes'

export class ReactAgent {
  constructor() {
    console.log('ReactAgent 初始化（占位符）')
  }
  
  async run(message: string, context: AgentContext): Promise<AgentResponse> {
    // 占位符：返回错误，提示功能未实现
    return {
      type: 'error',
      content: 'Agent 功能正在开发中，请切换到普通模式'
    }
  }
  
  async resume(userInput: string, context: any): Promise<AgentResponse> {
    return {
      type: 'error',
      content: 'Agent 功能正在开发中'
    }
  }
}
```

#### 创建 `src/lib/agent/AgentMemory.ts`:

```typescript
/**
 * Agent 记忆管理
 * 
 * TODO: Phase 3 实现
 */

import type { IAgentMemory, ReActStep } from './AgentTypes'

export class AgentMemory implements IAgentMemory {
  private messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  private thoughts: string[] = []
  private steps: ReActStep[] = []
  
  addMessage(message: { role: 'user' | 'assistant'; content: string }): void {
    this.messages.push(message)
  }
  
  addThought(thought: string): void {
    this.thoughts.push(thought)
  }
  
  addStep(step: { action: string; input: any; observation: any }): void {
    // 占位符实现
    console.log('添加 ReAct 步骤:', step)
  }
  
  getHistory() {
    return this.messages
  }
  
  getThoughts() {
    return this.thoughts
  }
  
  getSteps(): ReActStep[] {
    return this.steps
  }
  
  clear(): void {
    this.messages = []
    this.thoughts = []
    this.steps = []
  }
}
```

#### 创建 `src/lib/agent/AgentPrompt.ts`:

```typescript
/**
 * Agent Prompt 模板
 * 
 * TODO: Phase 3 实现
 */

export function buildReActPrompt(context: any): string {
  // 占位符
  return 'TODO: Phase 3 实现 ReAct prompt'
}

export function parseReActOutput(text: string): any {
  // 占位符
  throw new Error('TODO: Phase 3 实现输出解析')
}
```

#### 创建 `src/lib/agent/tools/index.ts`:

```typescript
/**
 * 工具注册中心
 * 
 * TODO: Phase 2 实现具体工具
 */

import type { AgentTool } from '../AgentTypes'

/**
 * 获取所有可用工具
 */
export function getAllTools(): AgentTool[] {
  // 占位符：返回空数组
  return []
}

/**
 * 根据名称获取工具
 */
export function getTool(name: string): AgentTool | undefined {
  const tools = getAllTools()
  return tools.find(t => t.name === name)
}
```

---

### 步骤 1.5: 验证编译（10分钟）

```bash
# 1. 检查 TypeScript 编译
cd task-manager
npm run build

# 2. 如果有错误，修复后再次编译
# 常见错误：
# - 类型导入路径错误 → 检查 @/types 是否正确
# - 缺少依赖 → npm install

# 3. 验证目录结构
tree src/lib/agent
```

**预期输出**（无编译错误）:
```
✓ Compiled successfully
```

**目录结构**:
```
src/lib/agent/
├── ReactAgent.ts
├── AgentMemory.ts
├── AgentPrompt.ts
├── AgentTypes.ts
├── AgentConfig.ts
├── tools/
│   └── index.ts
└── adapters/
```

---

## ✅ 第二步：添加 UI 切换开关

### 步骤 2.1: 修改 ChatSidebar（20分钟）

找到 `src/components/ChatSidebar.tsx`，添加以下内容：

#### 2.1.1 添加状态管理

在 `ChatSidebar` 组件顶部添加：

```typescript
import { getAgentConfig } from '@/lib/agent/AgentConfig'

// 在组件内部添加状态
const [isAgentMode, setIsAgentMode] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ai_assistant_mode')
    if (saved) {
      return saved === 'agent'
    }
  }
  return getAgentConfig().enabled
})

// 持久化状态
useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ai_assistant_mode', isAgentMode ? 'agent' : 'normal')
  }
}, [isAgentMode])
```

#### 2.1.2 添加切换开关 UI

在 ChatSidebar 的标题区域添加切换开关：

```typescript
{/* 在 ChatSidebar 顶部添加 */}
<div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
  <h3 className="text-lg font-semibold text-gray-900">AI 助手</h3>
  
  {/* Agent 模式切换开关 */}
  <div className="flex items-center gap-2">
    <span className={`text-xs font-medium ${
      isAgentMode ? 'text-blue-600' : 'text-gray-500'
    }`}>
      {isAgentMode ? 'Agent 模式' : '普通模式'}
    </span>
    <button
      onClick={() => setIsAgentMode(!isAgentMode)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isAgentMode ? 'bg-blue-600' : 'bg-gray-300'
      }`}
      title={isAgentMode ? '切换到普通模式' : '切换到 Agent 模式（开发中）'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isAgentMode ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
</div>
```

#### 2.1.3 添加模式提示

在消息输入框上方添加当前模式的提示：

```typescript
{/* 在输入框上方添加 */}
{isAgentMode && (
  <div className="px-4 py-2 bg-blue-50 border-l-4 border-blue-500 text-sm">
    <p className="text-blue-700">
      <span className="font-semibold">🤖 Agent 模式</span>
      <span className="ml-2">（开发中，当前为占位功能）</span>
    </p>
  </div>
)}
```

---

### 步骤 2.2: 验证 UI（5分钟）

```bash
# 启动开发服务器
npm run dev

# 打开浏览器，访问 http://localhost:3000
# 1. 打开 AI 助手侧边栏
# 2. 查看顶部是否有切换开关
# 3. 点击切换开关，验证状态切换
# 4. 刷新页面，验证状态是否保持
```

**验证清单**:
- ✅ 切换开关显示正常
- ✅ 点击切换开关，文字和颜色正确变化
- ✅ 刷新页面后，状态保持
- ✅ Agent 模式下显示蓝色提示条
- ✅ 现有聊天功能不受影响

---

## ✅ 第三步：创建测试文件

### 步骤 3.1: 创建单元测试（15分钟）

创建 `src/lib/agent/__tests__/AgentTypes.test.ts`:

```typescript
/**
 * Agent 类型测试
 */

import type { ToolResult, AgentResponse } from '../AgentTypes'

describe('AgentTypes', () => {
  describe('ToolResult', () => {
    it('应该支持 success 类型', () => {
      const result: ToolResult = {
        type: 'success',
        data: { tasks: [] }
      }
      
      expect(result.type).toBe('success')
    })
    
    it('应该支持 need_input 类型', () => {
      const result: ToolResult = {
        type: 'need_input',
        prompt: '请输入任务上下文',
        context: { taskId: '123' }
      }
      
      expect(result.type).toBe('need_input')
      expect(result.prompt).toBeDefined()
    })
    
    it('应该支持 error 类型', () => {
      const result: ToolResult = {
        type: 'error',
        message: '工具执行失败'
      }
      
      expect(result.type).toBe('error')
    })
  })
  
  describe('AgentResponse', () => {
    it('应该支持 text 类型', () => {
      const response: AgentResponse = {
        type: 'text',
        content: '你好'
      }
      
      expect(response.type).toBe('text')
    })
    
    it('应该支持 need_user_input 类型', () => {
      const response: AgentResponse = {
        type: 'need_user_input',
        prompt: '请回答问题',
        context: {}
      }
      
      expect(response.type).toBe('need_user_input')
    })
  })
})
```

创建 `src/lib/agent/__tests__/AgentConfig.test.ts`:

```typescript
/**
 * Agent 配置测试
 */

import { getAgentConfig, updateAgentConfig } from '../AgentConfig'

describe('AgentConfig', () => {
  it('应该返回默认配置', () => {
    const config = getAgentConfig()
    
    expect(config).toBeDefined()
    expect(config.maxIterations).toBe(5)
    expect(config.fallbackToLegacy).toBe(true)
  })
  
  it('应该能更新配置', () => {
    const config = updateAgentConfig({ maxIterations: 10 })
    
    expect(config.maxIterations).toBe(10)
  })
})
```

---

### 步骤 3.2: 运行测试（5分钟）

```bash
# 运行测试
npm run test src/lib/agent/__tests__/

# 预期输出：所有测试通过
```

---

## ✅ 阶段验收（Phase 1 完成标志）

### 验收清单

#### 1. 目录结构 ✅
```bash
tree src/lib/agent
```
应该看到完整的目录结构和所有文件

#### 2. 编译通过 ✅
```bash
npm run build
```
无错误输出

#### 3. 类型检查通过 ✅
```bash
npm run type-check
```
无类型错误

#### 4. UI 功能正常 ✅
- [ ] 切换开关显示正常
- [ ] 点击切换正常工作
- [ ] 状态持久化（刷新后保持）
- [ ] 现有功能不受影响

#### 5. 测试通过 ✅
```bash
npm run test
```
所有测试用例通过

---

## 📊 Phase 1 回顾

完成上述所有步骤后，进行回顾：

### 回顾问题
1. ✅ 基础设施是否完整？
   - [ ] 所有文件都创建了
   - [ ] 类型定义清晰完整
   - [ ] 配置文件正确

2. ✅ 类型定义是否清晰？
   - [ ] `AgentTool` 接口合理
   - [ ] `ToolResult` 支持交互式流程
   - [ ] `AgentResponse` 覆盖所有场景

3. ✅ UI 切换开关是否好用？
   - [ ] 用户能轻松切换模式
   - [ ] 状态持久化正常
   - [ ] 提示信息清晰

### 问题记录

在这里记录 Phase 1 遇到的问题：

- **问题1**: _______________
  - **解决方案**: _______________

- **问题2**: _______________
  - **解决方案**: _______________

### 经验总结

在这里记录有用的经验：

- **经验1**: _______________
- **经验2**: _______________

---

## 🎯 下一步决策

Phase 1 完成后，根据情况决定：

### ✅ 如果一切顺利
→ **进入 Phase 2**: 工具层开发
→ 预计时间：2-3 天
→ 目标：实现 5 个核心工具

### ⚠️ 如果发现问题
→ **调整方案**: 
  - 类型定义有问题 → 重新设计类型
  - UI 交互不好 → 优化切换开关
  - 编译有问题 → 修复配置

### 📝 方案调整记录

如果需要调整后续方案，在这里记录：

- **调整1**: _______________
  - **原因**: _______________
  - **影响**: _______________

---

## 🚀 准备开始 Phase 2

确认以下条件满足后，可以进入 Phase 2：

- [x] 所有文件已创建
- [x] 编译通过
- [x] UI 切换开关工作正常
- [x] 测试通过
- [x] 团队对 Phase 1 结果满意

**Phase 2 预览**:
- 实现 `GetTasksTool`（获取任务）
- 实现 `AnalyzeTasksTool`（分析任务）
- 实现 `DecomposeTaskTool`（拆解任务，支持交互）
- 实现 `ClarifyTaskTool`（澄清任务）
- 实现 `EstimateTimeTool`（时间估算）

---

**祝开发顺利！💪**

