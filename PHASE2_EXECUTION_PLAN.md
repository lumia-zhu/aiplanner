# Phase 2 执行计划 - 工具层开发

## 📋 **总览**

**目标**：实现 6 个核心工具，让 Agent 能感知任务、分析状态、调用现有 AI 服务

**时间估算**：2-3 天

**难度**：⭐⭐⭐（中等 - 需要理解现有业务逻辑）

**前置条件**：
- ✅ Phase 1 已完成（类型定义、配置管理、记忆管理、UI 切换开关）
- ✅ 现有 AI 服务可用（`clarificationAI`, `decompositionAI`, `timeEstimationAI`）
- ✅ 数据库查询函数可用（`getTasks`, `getNotes`）

---

## 🎯 **核心原则**

### 1. **"足够用"原则**
- ❌ 不追求完整性：不返回所有任务字段
- ✅ 只返回对 Agent 决策有帮助的信息
- ✅ 简化数据结构，减少 LLM token 消耗

**示例**：
```typescript
// ❌ 不好：返回完整任务对象（包含 created_at, updated_at, 等无关字段）
return { tasks: allTasks }

// ✅ 好：只返回关键信息
return {
  tasks: tasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    hasDeadline: !!t.deadline_datetime,
    hasEstimation: !!t.estimated_duration,
    needsClarification: !t.description || t.description.length < 10
  }))
}
```

### 2. **交互式流程支持**
- ✅ 工具可以返回 `need_input`，暂停 Agent 循环
- ✅ 用户提供输入后，Agent 恢复并继续执行
- ✅ 保持上下文（通过 `context` 字段传递状态）

### 3. **复用现有服务**
- ✅ 不重复造轮子，包装已有的 AI 服务
- ✅ 保持接口简洁，适配 Agent 使用
- ✅ 处理错误，返回友好的错误信息

### 4. **Long-term Memory 集成**
- ✅ 实现 `LoadTaskContextTool`，填充 `TaskContext`
- ✅ 定期刷新缓存（5分钟有效期）
- ✅ 优化查询性能（限制任务数量）

---

## 📝 **工具清单**

| 工具名称 | 功能 | 交互式 | 复用服务 | 优先级 |
|---------|------|--------|---------|--------|
| `LoadTaskContextTool` | 加载任务上下文（填充 Long-term Memory） | ❌ | `getTasks`, `getNotes` | 🔴 P0 |
| `GetTasksTool` | 查询任务列表 | ❌ | `getTasks` | 🔴 P0 |
| `AnalyzeTasksTool` | 分析任务状态 | ❌ | `workflowAnalyzer` | 🔴 P0 |
| `ClarifyTaskTool` | 生成澄清问题 | ✅ | `clarificationAI` | 🟡 P1 |
| `DecomposeTaskTool` | 拆解任务 | ✅ | `decompositionAI` | 🟡 P1 |
| `EstimateTimeTool` | 时间估算 | ✅ | `timeEstimationAI` | 🟢 P2 |

**优先级说明**：
- 🔴 **P0**：必须实现，Phase 2 核心功能
- 🟡 **P1**：重要，但可在 Phase 3 测试时完善
- 🟢 **P2**：可选，Phase 3 稳定后再补充

---

## 🔧 **实施步骤**

### **Step 1: 创建工具基类和工具注册中心**（1-2小时）

#### 1.1 更新 `tools/index.ts` - 工具注册和管理

```typescript
// src/lib/agent/tools/index.ts
import { AgentTool } from '../AgentTypes'
import { LoadTaskContextTool } from './LoadTaskContextTool'
import { GetTasksTool } from './GetTasksTool'
import { AnalyzeTasksTool } from './AnalyzeTasksTool'
import { ClarifyTaskTool } from './ClarifyTaskTool'
import { DecomposeTaskTool } from './DecomposeTaskTool'
import { EstimateTimeTool } from './EstimateTimeTool'

// 工具实例缓存（避免重复创建）
let toolsCache: AgentTool[] | null = null

/**
 * 获取所有可用的 Agent 工具
 */
export function getAllTools(): AgentTool[] {
  if (toolsCache) {
    return toolsCache
  }

  toolsCache = [
    new LoadTaskContextTool(),
    new GetTasksTool(),
    new AnalyzeTasksTool(),
    new ClarifyTaskTool(),
    new DecomposeTaskTool(),
    new EstimateTimeTool(),
  ]

  console.log(`✅ Agent 工具已加载: ${toolsCache.map(t => t.name).join(', ')}`)
  return toolsCache
}

/**
 * 根据名称获取工具
 */
export function getTool(name: string): AgentTool {
  const tools = getAllTools()
  const tool = tools.find(t => t.name === name)
  
  if (!tool) {
    throw new Error(`工具 "${name}" 不存在。可用工具: ${tools.map(t => t.name).join(', ')}`)
  }
  
  return tool
}

/**
 * 重置工具缓存（主要用于测试）
 */
export function resetToolsCache() {
  toolsCache = null
  console.log('🧹 工具缓存已清空')
}
```

#### 1.2 验证

创建测试文件验证工具注册逻辑：

```typescript
// src/lib/agent/tools/__tests__/index.test.ts
import { getAllTools, getTool, resetToolsCache } from '../index'

describe('Agent Tools Registry', () => {
  beforeEach(() => {
    resetToolsCache()
  })

  test('getAllTools 应该返回所有工具', () => {
    const tools = getAllTools()
    expect(tools.length).toBeGreaterThanOrEqual(3) // 至少有 3 个 P0 工具
    expect(tools.every(t => t.name && t.description && t.execute)).toBe(true)
  })

  test('getTool 应该能根据名称查找工具', () => {
    const tool = getTool('get_tasks')
    expect(tool.name).toBe('get_tasks')
  })

  test('getTool 应该在工具不存在时抛出错误', () => {
    expect(() => getTool('non_existent')).toThrow()
  })
})
```

**验收标准**：
- ✅ `npm run test tools/index.test.ts` 通过
- ✅ 能正确注册和查找工具
- ✅ 错误处理完善

---

### **Step 2: 实现 P0 工具 - LoadTaskContextTool**（2-3小时）

**目标**：填充 `TaskContext`（Long-term Memory），让 Agent 了解用户的任务全貌

#### 2.1 创建文件

```typescript
// src/lib/agent/tools/LoadTaskContextTool.ts
import { AgentTool, ParameterSchema, ToolResult, TaskContext } from '../AgentTypes'
import { getTasks } from '@/lib/tasks'
import { getNotes } from '@/lib/notes'
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'
import type { Task } from '@/types'

interface LoadTaskContextParams {
  userId: string
  referenceDate: Date // 参考日期（通常是今天）
}

/**
 * 加载任务上下文工具
 * 填充 Agent 的 Long-term Memory（近3个月任务信息）
 */
export class LoadTaskContextTool implements AgentTool {
  name = 'load_task_context'
  description = '加载用户的任务上下文（近3个月任务统计和今天的任务详情），填充 Agent 长期记忆'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: '用户 ID'
      },
      referenceDate: {
        type: 'string',
        description: '参考日期（ISO 格式，如 2024-11-04），默认为今天'
      }
    },
    required: ['userId']
  }

  async execute(params: LoadTaskContextParams): Promise<ToolResult> {
    try {
      const referenceDate = params.referenceDate || new Date()
      const userId = params.userId

      // 计算日期范围：前1个月 + 当前月 + 后1个月
      const previousMonth = subMonths(referenceDate, 1)
      const nextMonth = addMonths(referenceDate, 1)
      
      const startDate = startOfMonth(previousMonth)
      const endDate = endOfMonth(nextMonth)

      console.log(`📊 加载任务上下文: ${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`)

      // 查询近3个月的所有任务
      const allTasks = await this.loadTasksInRange(userId, startDate, endDate)

      // 过滤今天的任务
      const today = format(referenceDate, 'yyyy-MM-dd')
      const todayTasks = allTasks.filter(t => {
        if (!t.note_date) return false
        return format(new Date(t.note_date), 'yyyy-MM-dd') === today
      })

      // 构建任务上下文
      const taskContext: TaskContext = {
        todayTasks,
        recentTasksSummary: this.buildSummary(allTasks, referenceDate),
        recentTasks: this.simplifyTasks(allTasks)
      }

      console.log(`✅ 任务上下文加载完成: 总任务 ${allTasks.length}, 今天 ${todayTasks.length}`)

      return {
        type: 'success',
        data: taskContext
      }

    } catch (error: any) {
      console.error('❌ 加载任务上下文失败:', error)
      return {
        type: 'error',
        message: `加载任务上下文失败: ${error.message}`
      }
    }
  }

  /**
   * 加载指定日期范围内的任务
   */
  private async loadTasksInRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
    // 这里需要根据实际的数据库查询逻辑实现
    // 由于 getTasks 可能不支持日期范围查询，我们可能需要：
    // 1. 查询近3个月的笔记
    // 2. 从笔记中提取任务

    // 简化实现：查询所有任务，然后过滤（后续可优化）
    const allTasks = await getTasks(userId, { 
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    })

    return allTasks.filter(t => {
      if (!t.note_date) return false
      const taskDate = new Date(t.note_date)
      return taskDate >= startDate && taskDate <= endDate
    })
  }

  /**
   * 构建任务统计信息
   */
  private buildSummary(tasks: Task[], referenceDate: Date) {
    const previousMonth = subMonths(referenceDate, 1)
    const nextMonth = addMonths(referenceDate, 1)

    const isInMonth = (task: Task, targetMonth: Date) => {
      if (!task.note_date) return false
      const taskDate = new Date(task.note_date)
      return (
        taskDate >= startOfMonth(targetMonth) &&
        taskDate <= endOfMonth(targetMonth)
      )
    }

    const previousMonthTasks = tasks.filter(t => isInMonth(t, previousMonth))
    const currentMonthTasks = tasks.filter(t => isInMonth(t, referenceDate))
    const nextMonthTasks = tasks.filter(t => isInMonth(t, nextMonth))

    return {
      totalCount: tasks.length,
      urgentCount: tasks.filter(t => t.priority === 'high' && !t.is_completed).length,
      missingEstimationCount: tasks.filter(t => !t.estimated_duration && !t.is_completed).length,
      byMonth: {
        previousMonth: {
          total: previousMonthTasks.length,
          completed: previousMonthTasks.filter(t => t.is_completed).length,
          date: format(previousMonth, 'yyyy-MM')
        },
        currentMonth: {
          total: currentMonthTasks.length,
          completed: currentMonthTasks.filter(t => t.is_completed).length,
          date: format(referenceDate, 'yyyy-MM')
        },
        nextMonth: {
          total: nextMonthTasks.length,
          completed: nextMonthTasks.filter(t => t.is_completed).length,
          date: format(nextMonth, 'yyyy-MM')
        }
      }
    }
  }

  /**
   * 简化任务列表（只保留关键信息，遵循"足够用"原则）
   */
  private simplifyTasks(tasks: Task[]) {
    return tasks.slice(0, 200).map(t => ({ // 限制最多 200 个任务
      id: t.id,
      title: t.title,
      priority: t.priority || 'low',
      deadline: t.deadline_datetime ? format(new Date(t.deadline_datetime), 'yyyy-MM-dd') : undefined,
      estimatedDuration: t.estimated_duration || undefined,
      isCompleted: t.is_completed || false,
      isToday: t.note_date ? format(new Date(t.note_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') : false
    }))
  }
}
```

#### 2.2 测试

```typescript
// src/lib/agent/tools/__tests__/LoadTaskContextTool.test.ts
import { LoadTaskContextTool } from '../LoadTaskContextTool'

describe('LoadTaskContextTool', () => {
  const tool = new LoadTaskContextTool()

  test('应该有正确的名称和描述', () => {
    expect(tool.name).toBe('load_task_context')
    expect(tool.description).toContain('任务上下文')
  })

  test('应该能加载任务上下文', async () => {
    // Mock getTasks
    // ...

    const result = await tool.execute({
      userId: 'test-user-id',
      referenceDate: new Date('2024-11-04')
    })

    expect(result.type).toBe('success')
    expect(result.data).toHaveProperty('todayTasks')
    expect(result.data).toHaveProperty('recentTasksSummary')
    expect(result.data).toHaveProperty('recentTasks')
  })
})
```

#### 2.3 集成到 AgentMemory

更新 `AgentMemory.ts`，在初始化时自动加载任务上下文：

```typescript
// src/lib/agent/AgentMemory.ts（新增方法）

import { LoadTaskContextTool } from './tools/LoadTaskContextTool'

export class AgentMemory implements IAgentMemory {
  // ... 现有代码 ...

  /**
   * 自动加载任务上下文（如果缓存过期或不存在）
   */
  async ensureTaskContext(userId: string, referenceDate?: Date): Promise<void> {
    // 检查缓存是否有效（5分钟内）
    const now = Date.now()
    const cacheAge = this.taskContextLoadedAt ? now - this.taskContextLoadedAt : Infinity
    
    if (this.taskContext && cacheAge < 5 * 60 * 1000) {
      console.log('✅ 任务上下文缓存有效，跳过加载')
      return
    }

    // 缓存过期，重新加载
    console.log('🔄 任务上下文缓存过期，重新加载...')
    const tool = new LoadTaskContextTool()
    const result = await tool.execute({ userId, referenceDate: referenceDate || new Date() })

    if (result.type === 'success') {
      this.updateTaskContext(result.data)
      this.taskContextLoadedAt = now
    } else {
      console.error('❌ 任务上下文加载失败:', result.message)
    }
  }

  private taskContextLoadedAt: number | null = null
}
```

**验收标准**：
- ✅ 工具能正确查询近3个月的任务
- ✅ 能正确识别今天的任务
- ✅ 统计信息准确（总数、紧急、缺少估算）
- ✅ 任务列表简化（最多200个）
- ✅ 缓存机制生效（5分钟内不重复查询）
- ✅ 单元测试通过

---

### **Step 3: 实现 P0 工具 - GetTasksTool**（1小时）

**目标**：查询任务列表（支持日期范围、优先级筛选）

```typescript
// src/lib/agent/tools/GetTasksTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { getTasks } from '@/lib/tasks'

interface GetTasksParams {
  userId: string
  dateRange?: {
    start: string // YYYY-MM-DD
    end: string   // YYYY-MM-DD
  }
  priority?: 'high' | 'medium' | 'low'
  includeCompleted?: boolean
}

export class GetTasksTool implements AgentTool {
  name = 'get_tasks'
  description = '查询用户的任务列表，支持按日期范围、优先级筛选'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { type: 'string', description: '用户 ID' },
      dateRange: {
        type: 'object',
        description: '日期范围（可选）',
        properties: {
          start: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          end: { type: 'string', description: '结束日期 YYYY-MM-DD' }
        }
      },
      priority: {
        type: 'string',
        description: '优先级筛选（可选）',
        enum: ['high', 'medium', 'low']
      },
      includeCompleted: {
        type: 'boolean',
        description: '是否包含已完成任务（默认 false）'
      }
    },
    required: ['userId']
  }

  async execute(params: GetTasksParams): Promise<ToolResult> {
    try {
      let tasks = await getTasks(params.userId, params.dateRange)

      // 筛选
      if (params.priority) {
        tasks = tasks.filter(t => t.priority === params.priority)
      }

      if (!params.includeCompleted) {
        tasks = tasks.filter(t => !t.is_completed)
      }

      console.log(`✅ 查询任务: ${tasks.length} 个`)

      // 遵循"足够用"原则：只返回关键信息
      return {
        type: 'success',
        data: {
          count: tasks.length,
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority || 'low',
            hasDeadline: !!t.deadline_datetime,
            deadline: t.deadline_datetime,
            hasEstimation: !!t.estimated_duration,
            estimatedMinutes: t.estimated_duration,
            needsClarification: !t.description || t.description.length < 10,
            isCompleted: t.is_completed || false
          }))
        }
      }

    } catch (error: any) {
      console.error('❌ 查询任务失败:', error)
      return {
        type: 'error',
        message: `查询任务失败: ${error.message}`
      }
    }
  }
}
```

**验收标准**：
- ✅ 能查询所有任务
- ✅ 能按日期范围筛选
- ✅ 能按优先级筛选
- ✅ 能排除已完成任务
- ✅ 返回数据简化（只包含关键字段）
- ✅ 单元测试通过

---

### **Step 4: 实现 P0 工具 - AnalyzeTasksTool**（1-2小时）

**目标**：分析任务状态，识别需要处理的问题

```typescript
// src/lib/agent/tools/AnalyzeTasksTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import type { Task } from '@/types'
import { isAfter, isBefore, addDays, parseISO } from 'date-fns'

interface AnalyzeTasksParams {
  tasks: Task[] // 可以从 TaskContext 或 GetTasksTool 获取
}

export class AnalyzeTasksTool implements AgentTool {
  name = 'analyze_tasks'
  description = '分析任务状态，识别紧急任务、缺少估算的任务、可拆解的任务等'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: '任务列表',
        items: { type: 'object' }
      }
    },
    required: ['tasks']
  }

  async execute(params: AnalyzeTasksParams): Promise<ToolResult> {
    try {
      const tasks = params.tasks
      const now = new Date()

      // 分析维度
      const analysis = {
        total: tasks.length,
        completed: tasks.filter(t => t.is_completed).length,
        
        // 紧急任务：deadline 在 3 天内
        urgent: tasks.filter(t => {
          if (t.is_completed || !t.deadline_datetime) return false
          const deadline = parseISO(t.deadline_datetime)
          return isBefore(deadline, addDays(now, 3))
        }).map(t => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline_datetime
        })),
        
        // 缺少时间估算
        needsEstimation: tasks.filter(t => 
          !t.is_completed && !t.estimated_duration
        ).map(t => ({
          id: t.id,
          title: t.title
        })),
        
        // 缺少描述/上下文（可能需要澄清）
        needsClarification: tasks.filter(t =>
          !t.is_completed && (!t.description || t.description.length < 10)
        ).map(t => ({
          id: t.id,
          title: t.title
        })),
        
        // 可能可以拆解（标题较长或包含"和"等连接词）
        canDecompose: tasks.filter(t =>
          !t.is_completed && (
            t.title.length > 30 ||
            /[和与及、，,]/.test(t.title)
          )
        ).map(t => ({
          id: t.id,
          title: t.title
        })),
        
        // 优先级分布
        byPriority: {
          high: tasks.filter(t => t.priority === 'high' && !t.is_completed).length,
          medium: tasks.filter(t => t.priority === 'medium' && !t.is_completed).length,
          low: tasks.filter(t => t.priority === 'low' && !t.is_completed).length
        }
      }

      console.log(`📊 任务分析完成: 总 ${analysis.total}, 紧急 ${analysis.urgent.length}, 需估算 ${analysis.needsEstimation.length}`)

      return {
        type: 'success',
        data: analysis
      }

    } catch (error: any) {
      console.error('❌ 任务分析失败:', error)
      return {
        type: 'error',
        message: `任务分析失败: ${error.message}`
      }
    }
  }
}
```

**验收标准**：
- ✅ 能识别紧急任务（3天内 deadline）
- ✅ 能识别缺少估算的任务
- ✅ 能识别缺少描述的任务
- ✅ 能识别可拆解的任务
- ✅ 优先级分布统计准确
- ✅ 单元测试通过

---

### **Step 5: 实现 P1 工具 - ClarifyTaskTool**（1小时）

**目标**：生成苏格拉底式问题，帮助用户澄清任务（复用 `clarificationAI`）

```typescript
// src/lib/agent/tools/ClarifyTaskTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { generateDynamicClarificationQuestions } from '@/lib/clarificationAI'
import type { Task } from '@/types'

interface ClarifyTaskParams {
  task: Task
  userContext?: string // 用户在上一轮提供的回答
}

export class ClarifyTaskTool implements AgentTool {
  name = 'clarify_task'
  description = '生成苏格拉底式问题，帮助用户澄清任务定义（支持交互式流程）'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要澄清的任务'
      },
      userContext: {
        type: 'string',
        description: '用户提供的回答（第二轮）'
      }
    },
    required: ['task']
  }

  async execute(params: ClarifyTaskParams): Promise<ToolResult> {
    try {
      // 第一轮：生成问题
      if (!params.userContext) {
        const questions = await generateDynamicClarificationQuestions(params.task)
        
        return {
          type: 'need_input',
          prompt: `为了更好地澄清「${params.task.title}」，我想了解一下：\n\n${questions.join('\n')}`,
          context: {
            taskId: params.task.id,
            step: 'clarification',
            questions
          }
        }
      }

      // 第二轮：用户已回答，保存澄清结果
      console.log(`✅ 任务「${params.task.title}」已澄清`)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          clarification: params.userContext,
          message: '澄清完成，可以继续处理任务了'
        }
      }

    } catch (error: any) {
      console.error('❌ 澄清任务失败:', error)
      return {
        type: 'error',
        message: `澄清任务失败: ${error.message}`
      }
    }
  }
}
```

**验收标准**：
- ✅ 能生成澄清问题
- ✅ 支持交互式流程（need_input）
- ✅ 能保存用户回答
- ✅ 单元测试通过

---

### **Step 6: 实现 P1 工具 - DecomposeTaskTool**（1-2小时）

**目标**：拆解复杂任务为子任务（复用 `decompositionAI`）

```typescript
// src/lib/agent/tools/DecomposeTaskTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { generateDynamicDecompositionQuestions } from '@/lib/decompositionAI'
import { decomposeTaskWithContext } from '@/utils/taskDecomposition'
import type { Task } from '@/types'

interface DecomposeTaskParams {
  task: Task
  userContext?: string // 用户提供的上下文
}

export class DecomposeTaskTool implements AgentTool {
  name = 'decompose_task'
  description = '将复杂任务拆解为子任务（支持交互式流程，会询问用户上下文）'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要拆解的任务'
      },
      userContext: {
        type: 'string',
        description: '用户提供的上下文（第二轮）'
      }
    },
    required: ['task']
  }

  async execute(params: DecomposeTaskParams): Promise<ToolResult> {
    try {
      // 第一轮：询问上下文
      if (!params.userContext) {
        const questions = await generateDynamicDecompositionQuestions(params.task)
        
        return {
          type: 'need_input',
          prompt: `为了更好地拆解「${params.task.title}」，我想了解一下：\n\n${questions.join('\n')}`,
          context: {
            taskId: params.task.id,
            step: 'decomposition',
            questions
          }
        }
      }

      // 第二轮：执行拆解
      const subtasks = await decomposeTaskWithContext(params.task, params.userContext)
      
      console.log(`✅ 任务「${params.task.title}」已拆解为 ${subtasks.length} 个子任务`)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          subtasks: subtasks.map(st => ({
            title: st.title,
            estimatedMinutes: st.estimatedDuration
          })),
          message: `已为你拆解出 ${subtasks.length} 个子任务`
        }
      }

    } catch (error: any) {
      console.error('❌ 拆解任务失败:', error)
      return {
        type: 'error',
        message: `拆解任务失败: ${error.message}`
      }
    }
  }
}
```

**验收标准**：
- ✅ 能生成拆解问题
- ✅ 支持交互式流程（need_input）
- ✅ 能执行任务拆解
- ✅ 返回子任务列表
- ✅ 单元测试通过

---

### **Step 7: 实现 P2 工具 - EstimateTimeTool**（0.5-1小时）

**目标**：帮助用户估算任务时间（复用 `timeEstimationAI`）

```typescript
// src/lib/agent/tools/EstimateTimeTool.ts
import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { generateTimeEstimation } from '@/lib/timeEstimationAI'
import type { Task } from '@/types'

interface EstimateTimeParams {
  task: Task
  userContext?: string
}

export class EstimateTimeTool implements AgentTool {
  name = 'estimate_time'
  description = '帮助用户估算任务所需时间（支持交互式流程）'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      task: {
        type: 'object',
        description: '要估算的任务'
      },
      userContext: {
        type: 'string',
        description: '用户提供的补充信息（可选）'
      }
    },
    required: ['task']
  }

  async execute(params: EstimateTimeParams): Promise<ToolResult> {
    try {
      // 生成时间估算
      const estimation = await generateTimeEstimation(params.task, params.userContext)
      
      console.log(`✅ 任务「${params.task.title}」估算时间: ${estimation.minutes} 分钟`)
      
      return {
        type: 'success',
        data: {
          taskId: params.task.id,
          estimatedMinutes: estimation.minutes,
          reasoning: estimation.reasoning,
          message: `预计需要 ${estimation.minutes} 分钟`
        }
      }

    } catch (error: any) {
      console.error('❌ 时间估算失败:', error)
      return {
        type: 'error',
        message: `时间估算失败: ${error.message}`
      }
    }
  }
}
```

**验收标准**：
- ✅ 能生成时间估算
- ✅ 返回估算理由
- ✅ 单元测试通过

---

## 🧪 **测试策略**

### 1. 单元测试（每个工具）

```bash
npm run test src/lib/agent/tools/
```

**测试覆盖**：
- ✅ 工具初始化（name, description, parameters）
- ✅ 正常执行流程
- ✅ 错误处理（参数缺失、数据库错误）
- ✅ 交互式流程（need_input 返回）

### 2. 集成测试（工具 + 数据库）

创建测试脚本：

```typescript
// scripts/test-tools.ts
import { getAllTools } from '@/lib/agent/tools'

async function testTools() {
  const tools = getAllTools()
  
  console.log('🧪 测试所有工具...\n')
  
  for (const tool of tools) {
    console.log(`测试工具: ${tool.name}`)
    
    // 根据工具类型执行测试
    // ...
  }
}

testTools()
```

### 3. 手动验证（浏览器控制台）

在 `notes-dashboard/page.tsx` 中添加临时测试代码：

```typescript
// 临时测试代码（Phase 2 完成后删除）
useEffect(() => {
  async function testToolsInBrowser() {
    if (!user) return
    
    const { getAllTools } = await import('@/lib/agent/tools')
    const tools = getAllTools()
    
    console.log('🧪 浏览器测试工具:', tools.map(t => t.name))
    
    // 测试 LoadTaskContextTool
    const loadTool = tools.find(t => t.name === 'load_task_context')
    const result = await loadTool?.execute({ userId: user.id })
    console.log('📊 任务上下文:', result)
  }
  
  testToolsInBrowser()
}, [user])
```

---

## ✅ **验收标准**

### Phase 2 完成标准

- ✅ **6 个工具全部实现**（至少 P0 + P1 工具）
- ✅ **单元测试通过**（覆盖率 > 70%）
- ✅ **集成测试通过**（工具能正确调用数据库和 AI 服务）
- ✅ **手动验证通过**（浏览器控制台测试）
- ✅ **Long-term Memory 填充成功**（TaskContext 加载正常）
- ✅ **交互式流程正常**（need_input 返回正确）
- ✅ **日志完善**（每个工具执行都有日志）
- ✅ **错误处理完善**（捕获所有异常）
- ✅ **代码编译通过**（`npm run build`）
- ✅ **文档完善**（README 更新）

---

## 📊 **进度检查点**

### Checkpoint 1: 工具注册中心（Step 1）
- ✅ `tools/index.ts` 完成
- ✅ 测试通过

### Checkpoint 2: P0 工具（Steps 2-4）
- ✅ `LoadTaskContextTool` 完成
- ✅ `GetTasksTool` 完成
- ✅ `AnalyzeTasksTool` 完成
- ✅ 测试通过
- ✅ Long-term Memory 填充成功

### Checkpoint 3: P1 工具（Steps 5-6）
- ✅ `ClarifyTaskTool` 完成
- ✅ `DecomposeTaskTool` 完成
- ✅ 交互式流程测试通过

### Checkpoint 4: P2 工具（Step 7，可选）
- ✅ `EstimateTimeTool` 完成

### Checkpoint 5: 集成测试
- ✅ 所有工具集成测试通过
- ✅ 浏览器手动验证通过

---

## 🚧 **风险与应对**

### 风险 1: 现有 API 不支持日期范围查询
**影响**: `LoadTaskContextTool` 无法高效查询近3个月任务

**应对方案**:
1. **临时方案**: 查询所有任务，在内存中过滤（性能较差但可用）
2. **优化方案**: 修改 `getTasks` 支持日期范围参数
3. **最优方案**: 直接查询笔记表（`notes` table），从笔记中提取任务

### 风险 2: AI 服务不稳定（clarificationAI, decompositionAI）
**影响**: 交互式工具返回错误

**应对方案**:
1. 增加重试机制（最多3次）
2. 提供 fallback 提示（"AI 服务暂时不可用，请手动输入"）
3. 记录错误日志，便于排查

### 风险 3: 测试覆盖不足
**影响**: 工具有隐藏 bug，Phase 3 集成时才发现

**应对方案**:
1. 每个工具完成后立即测试
2. 编写集成测试脚本
3. 浏览器手动验证

---

## 📚 **下一步决策点**

### Phase 2 完成后

**情况 1: 所有工具正常 ✅**
→ 进入 Phase 3（Agent 核心实现）

**情况 2: 交互式流程有问题 ⚠️**
→ 优化 `need_input` 机制，调整工具接口

**情况 3: Long-term Memory 加载性能差 ⚠️**
→ 优化数据库查询，考虑引入缓存层

**情况 4: 工具接口设计不合理 🔴**
→ 重构工具接口，可能需要回到 Phase 1 调整类型定义

---

## 💡 **优化建议**

### 性能优化
1. **任务查询缓存**: `LoadTaskContextTool` 结果缓存 5 分钟
2. **批量查询**: 一次查询近3个月所有笔记，而不是逐月查询
3. **限制任务数量**: 最多返回 200 个任务（遵循"足够用"原则）

### 代码质量
1. **统一错误处理**: 所有工具使用相同的错误处理模式
2. **日志规范**: 统一日志格式（emoji + 工具名 + 操作 + 结果）
3. **类型安全**: 所有参数和返回值都有 TypeScript 类型

### 用户体验
1. **友好的错误提示**: 不直接暴露技术错误，提供可操作的建议
2. **进度反馈**: 长时间操作（如任务拆解）提供进度提示
3. **交互式流程优化**: 问题清晰、简洁，不超过 3 个

---

## 📝 **Phase 2 完成后的文档更新**

1. **更新 AGENT_REFACTORING_PLAN.md**
   - 标记 Phase 2 为已完成
   - 记录遇到的问题和解决方案
   - 更新时间估算（实际耗时 vs 计划耗时）

2. **创建工具文档**
   - `TOOLS_README.md`: 每个工具的详细说明
   - 包含参数、返回值、使用示例

3. **更新主 README**
   - Agent 开发进度
   - 如何测试工具层

---

## 🎯 **总结**

Phase 2 的核心目标是让 Agent **具备感知能力**：
- ✅ 通过 `LoadTaskContextTool` 获得 Long-term Memory
- ✅ 通过 `GetTasksTool` 查询任务
- ✅ 通过 `AnalyzeTasksTool` 分析任务状态
- ✅ 通过交互式工具（Clarify, Decompose, Estimate）调用现有 AI 服务

完成 Phase 2 后，我们将进入 Phase 3（Agent 核心实现），让 Agent 能够**自主推理和决策**。

---

**预计时间**: 2-3 天
**实际进度**: 待更新
**风险等级**: ⭐⭐⭐（中等）

**准备好了吗？让我们开始 Phase 2！** 🚀

