# Phase 5: P0 核心工具开发计划 V2（笔记系统版）

## 🎯 重要澄清

### ✅ 系统架构（正确理解）

**任务存储方式**：
- 任务存储在**笔记**中（notes 表）
- 笔记内容是 Tiptap JSON 格式
- 任务是 `taskItem` 节点
- 每个日期有一个笔记，笔记中包含多个任务

**数据流**：
```
用户在 notes-dashboard 编辑笔记
   ↓
笔记中包含 taskItem 节点（Tiptap TaskList）
   ↓
保存到 notes 表（content 字段）
   ↓
解析任务并同步到 daily_tasks 表（用于统计）
```

**示例笔记 JSON 结构**：
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "content": [{ "type": "text", "text": "今天的任务" }]
    },
    {
      "type": "taskList",
      "content": [
        {
          "type": "taskItem",
          "attrs": { "checked": false },
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "完成报告 " },
                { 
                  "type": "text", 
                  "text": "工作",
                  "marks": [
                    { 
                      "type": "taskTag",
                      "attrs": { "label": "工作", "color": "#7FA1C3" }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 📦 现有基础设施

### ✅ 已实现的函数

**src/lib/notes.ts**：
1. **`appendTaskToNote(userId, date, taskTitle)`** - 第98行
   - 功能：在指定日期的笔记中追加任务
   - 支持标签解析（#工作）
   - 自动创建笔记（如果不存在）

2. **`getNoteByDate(userId, date)`**
   - 获取指定日期的笔记

3. **`saveNote(userId, noteId, content)`**
   - 保存笔记内容

4. **`extractMetadata(content)`** - 第36行
   - 提取笔记元数据（任务统计、标签等）

**src/lib/taskSync.ts**：
1. **`parseTasksFromNote(noteContent)`** - 第28行
   - 从笔记中解析任务列表

2. **`syncTasksFromNote(userId, noteDate, noteContent)`**
   - 将笔记中的任务同步到 daily_tasks 表

---

## 🛠️ 需要实现的工具

### 工具 1: `create_task` - 在笔记中创建任务 ✅
**状态**：基础设施已完备，只需包装

**实现方式**：
```typescript
execute(params) {
  // 1. 解析日期（如果用户说"明天"，需要转换）
  // 2. 构建任务标题（包含标签等）
  // 3. 调用 appendTaskToNote(userId, date, taskTitle)
  // 4. 返回成功消息
}
```

**难度**：⭐⭐ （简单，基础设施已有）

---

### 工具 2: `update_task` - 更新笔记中的任务 ⚠️
**状态**：需要新增函数

**挑战**：
- 如何定位任务？（笔记中可能有多个任务）
- 如何修改 JSON 树中的特定节点？

**实现方案**：

#### 方案 A：基于任务位置（推荐）
```typescript
// 新增函数：updateTaskInNote(userId, date, taskPosition, updates)
// taskPosition = 任务在笔记中的索引（第几个任务）

function updateTaskInNote(noteContent, taskPosition, updates) {
  // 1. 遍历 JSON 树，找到第 N 个 taskItem 节点
  // 2. 修改节点属性（checked、content等）
  // 3. 返回新的 noteContent
}
```

**使用流程**：
```
用户：把第一个任务标记为完成
Agent：[调用 get_tasks 获取任务列表] → 确定 taskPosition=0
Agent：[调用 update_task(taskPosition=0, checked=true)]
```

#### 方案 B：基于任务标题模糊匹配
```typescript
// 根据标题查找任务
function findTaskByTitle(noteContent, titleKeyword) {
  // 返回匹配的任务位置
}
```

**推荐**：先实现方案 A（精确），后续再添加方案 B（智能）

---

### 工具 3: `delete_task` - 删除笔记中的任务 ⚠️
**状态**：需要新增函数

**实现方案**：
```typescript
// 新增函数：deleteTaskFromNote(userId, date, taskPosition)

function deleteTaskFromNote(noteContent, taskPosition) {
  // 1. 遍历 JSON 树，找到第 N 个 taskItem 节点
  // 2. 从父节点的 content 数组中移除
  // 3. 返回新的 noteContent
}
```

**交互式确认流程**：
```
用户：删除第一个任务
Agent：[查询任务详情]
Agent：[返回 need_input] 确定要删除任务"完成报告"吗？
用户：确认
Agent：[调用 delete_task] 删除成功
```

---

## 📋 详细开发步骤

### 阶段 1：创建辅助函数（核心基础设施）

#### Step 1.1: 创建 `src/lib/noteTaskOperations.ts`

**功能**：操作笔记中任务的底层函数

```typescript
/**
 * 笔记任务操作函数库
 * 提供对笔记中 taskItem 节点的 CRUD 操作
 */

import type { JSONContent } from '@tiptap/core'

/**
 * 在笔记中查找所有 taskItem 节点
 */
export function findAllTasks(noteContent: JSONContent): Array<{
  node: JSONContent,
  position: number,
  title: string,
  checked: boolean
}> {
  // 遍历 JSON 树，收集所有 taskItem
}

/**
 * 更新笔记中的任务
 */
export function updateTaskInNote(
  noteContent: JSONContent,
  taskPosition: number,
  updates: {
    checked?: boolean,
    title?: string
  }
): JSONContent {
  // 修改第 N 个 taskItem 节点
  // 返回新的 noteContent
}

/**
 * 删除笔记中的任务
 */
export function deleteTaskFromNote(
  noteContent: JSONContent,
  taskPosition: number
): JSONContent {
  // 移除第 N 个 taskItem 节点
  // 返回新的 noteContent
}
```

**预计时间**：1.5 小时

---

#### Step 1.2: 测试辅助函数

**测试文件**：`src/lib/__tests__/noteTaskOperations.test.ts`

**测试用例**：
1. ✅ 查找笔记中的所有任务
2. ✅ 更新任务的 checked 状态
3. ✅ 更新任务的标题
4. ✅ 删除任务
5. ✅ 处理空笔记
6. ✅ 处理不存在的任务位置

**预计时间**：30 分钟

---

### 阶段 2：实现 Agent 工具

#### Step 2.1: 实现 CreateTaskTool（简化版）

**文件**：`src/lib/agent/tools/CreateTaskTool.ts`

**参数**：
```typescript
{
  userId: string,
  taskTitle: string,  // 可以包含标签，如"完成报告 #工作"
  targetDate?: string  // YYYY-MM-DD，默认今天
}
```

**执行逻辑**：
```typescript
async execute(params) {
  // 1. 解析日期（默认今天）
  const date = params.targetDate ? new Date(params.targetDate) : new Date()
  
  // 2. 调用 appendTaskToNote
  const note = await appendTaskToNote(params.userId, date, params.taskTitle)
  
  // 3. 返回成功消息
  return {
    type: 'success',
    data: { message: `✅ 已创建任务：${params.taskTitle}` }
  }
}
```

**预计时间**：30 分钟

---

#### Step 2.2: 实现 UpdateTaskTool

**文件**：`src/lib/agent/tools/UpdateTaskTool.ts`

**参数**：
```typescript
{
  userId: string,
  noteDate: string,        // YYYY-MM-DD
  taskPosition: number,    // 第几个任务（从 0 开始）
  updates: {
    checked?: boolean,
    title?: string
  }
}
```

**执行逻辑**：
```typescript
async execute(params) {
  // 1. 获取笔记
  const note = await getNoteByDate(params.userId, new Date(params.noteDate))
  if (!note) return { type: 'error', message: '笔记不存在' }
  
  // 2. 更新任务
  const newContent = updateTaskInNote(note.content, params.taskPosition, params.updates)
  
  // 3. 保存笔记
  await saveNote(params.userId, note.id, newContent)
  
  // 4. 返回成功消息
  return { type: 'success', data: { message: '✅ 任务已更新' } }
}
```

**预计时间**：40 分钟

---

#### Step 2.3: 实现 DeleteTaskTool（含确认）

**文件**：`src/lib/agent/tools/DeleteTaskTool.ts`

**参数**：
```typescript
{
  userId: string,
  noteDate: string,
  taskPosition: number,
  confirmed?: boolean  // 第二轮调用时使用
}
```

**执行逻辑**：
```typescript
async execute(params, context) {
  // 第一轮：查询任务详情，请求确认
  if (!params.confirmed) {
    const note = await getNoteByDate(params.userId, new Date(params.noteDate))
    const tasks = findAllTasks(note.content)
    const task = tasks[params.taskPosition]
    
    return {
      type: 'need_input',
      prompt: `确定要删除任务吗？\n\n任务：${task.title}\n状态：${task.checked ? '已完成' : '未完成'}\n\n请回复 "确认" 或 "取消"`
    }
  }
  
  // 第二轮：执行删除
  const note = await getNoteByDate(params.userId, new Date(params.noteDate))
  const newContent = deleteTaskFromNote(note.content, params.taskPosition)
  await saveNote(params.userId, note.id, newContent)
  
  return { type: 'success', data: { message: '✅ 任务已删除' } }
}
```

**预计时间**：50 分钟

---

### 阶段 3：集成和测试

#### Step 3.1: 注册工具到 Agent

**文件**：`src/lib/agent/tools/index.ts`

```typescript
import { CreateTaskTool } from './CreateTaskTool'
import { UpdateTaskTool } from './UpdateTaskTool'
import { DeleteTaskTool } from './DeleteTaskTool'

toolsCache = [
  // ... 现有工具
  new CreateTaskTool(),
  new UpdateTaskTool(),
  new DeleteTaskTool(),
]
```

**预计时间**：5 分钟

---

#### Step 3.2: 手动测试（在 notes-dashboard 中）

**测试场景**：

**场景 1：创建任务**
```
用户：帮我创建一个任务：买菜
Agent：[调用 create_task] ✅ 已创建任务：买菜
[刷新页面，检查笔记中是否出现新任务]
```

**场景 2：更新任务（标记完成）**
```
用户：我今天有哪些任务？
Agent：[列出任务，包括位置]
用户：把第一个任务标记为完成
Agent：[调用 update_task] ✅ 任务已更新
[刷新页面，检查任务是否被勾选]
```

**场景 3：删除任务（含确认）**
```
用户：删除第一个任务
Agent：[请求确认] 确定要删除任务吗？任务：买菜...
用户：确认
Agent：[调用 delete_task] ✅ 任务已删除
[刷新页面，检查任务是否消失]
```

**预计时间**：30 分钟

---

### 阶段 4：添加 NLP 增强（智能解析）

#### Step 4.1: 实现 `parseTaskIntent`

**文件**：`src/lib/agent/parseTaskIntent.ts`

**功能**：从自然语言中提取任务信息

**输入**：
```typescript
{
  userMessage: "明天下午3点前完成报告，工作相关，高优先级",
  currentDate: "2025-11-08"
}
```

**输出**：
```typescript
{
  taskTitle: "完成报告 #工作",
  targetDate: "2025-11-09",  // 明天
  metadata: {
    deadline: "2025-11-09T15:00:00",
    priority: "high"
  }
}
```

**实现方式**：使用 LLM

**LLM Prompt**：
```
你是一个任务信息提取助手。从用户的自然语言中提取任务信息。

当前时间：2025-11-08 14:30（星期五）

用户消息：明天下午3点前完成报告，工作相关，高优先级

请返回 JSON：
{
  "taskTitle": "完成报告 #工作",  // 标题要简短（5-15字），标签用 # 标记
  "targetDate": "2025-11-09",     // 任务所属日期（YYYY-MM-DD）
  "metadata": {
    "deadline": "2025-11-09T15:00:00",  // 具体截止时间（可选）
    "priority": "high|medium|low"        // 优先级（可选）
  }
}

规则：
1. 标题要简短，去掉时间、优先级等描述
2. 标签用 # 标记，如 #工作、#学习
3. 时间要转换为绝对时间（ISO 格式）
4. 如果没有明确信息，不要猜测，返回 null
```

**预计时间**：1.5 小时

---

#### Step 4.2: 集成到 CreateTaskTool

**修改 CreateTaskTool**：
```typescript
parameters: {
  // ... 现有参数
  userMessage?: string,  // 新增：自然语言描述
  parseIntent?: boolean  // 新增：是否需要解析
}

async execute(params) {
  let taskTitle = params.taskTitle
  let targetDate = params.targetDate
  
  // 如果需要解析
  if (params.parseIntent && params.userMessage) {
    const parsed = await parseTaskIntent({
      userMessage: params.userMessage,
      currentDate: new Date().toISOString()
    })
    taskTitle = parsed.taskTitle
    targetDate = parsed.targetDate
  }
  
  // ... 继续原有逻辑
}
```

**预计时间**：30 分钟

---

#### Step 4.3: 添加智能任务查找

**新增函数**：`src/lib/agent/tools/findTaskByKeyword.ts`

**功能**：根据关键词查找任务

```typescript
export async function findTaskByKeyword(
  userId: string,
  keyword: string,
  dateRange?: { start: string, end: string }
): Promise<Array<{
  noteDate: string,
  taskPosition: number,
  taskTitle: string
}>> {
  // 1. 获取日期范围内的笔记
  // 2. 解析每个笔记的任务
  // 3. 模糊匹配关键词
  // 4. 返回匹配的任务列表
}
```

**使用场景**：
```
用户：把"写报告"这个任务标记为完成
Agent：[调用 findTaskByKeyword("写报告")]
Agent：找到 1 个任务：2025-11-08 的第 2 个任务
Agent：[调用 update_task(noteDate="2025-11-08", taskPosition=1, checked=true)]
```

**预计时间**：1 小时

---

## ⏱️ 时间估算总结

### 最小可行版本（MVP）

| 阶段 | 步骤 | 预计时间 |
|------|------|----------|
| **阶段 1** | 创建辅助函数 + 测试 | 2 小时 |
| **阶段 2** | 实现 3 个 Agent 工具 | 2 小时 |
| **阶段 3** | 集成和手动测试 | 35 分钟 |
| **总计** | | **约 4.5 小时** |

### 完整版（含 NLP 智能功能）

| 阶段 | 步骤 | 预计时间 |
|------|------|----------|
| **阶段 4** | NLP 解析 + 智能查找 | 3 小时 |
| **总计** | | **约 7.5 小时** |

---

## 🎯 关键差异对比

### ❌ 旧方案（错误）
- 操作独立的 tasks 表
- 使用 `createTask()`, `updateTask()`, `deleteTask()` 函数
- 任务是独立的数据库记录

### ✅ 新方案（正确）
- 操作笔记中的 taskItem 节点
- 使用 `appendTaskToNote()`, `updateTaskInNote()`, `deleteTaskFromNote()`
- 任务是笔记内容的一部分（Tiptap JSON）

---

## 📝 开发检查清单

### 准备阶段
- [ ] 理解 Tiptap JSON 结构
- [ ] 理解 taskItem 节点格式
- [ ] 阅读 `src/lib/notes.ts`
- [ ] 阅读 `src/lib/taskSync.ts`
- [ ] 测试 `appendTaskToNote` 函数

### 阶段 1
- [ ] 创建 `noteTaskOperations.ts`
- [ ] 实现 `findAllTasks()`
- [ ] 实现 `updateTaskInNote()`
- [ ] 实现 `deleteTaskFromNote()`
- [ ] 编写单元测试
- [ ] 测试通过

### 阶段 2
- [ ] 实现 CreateTaskTool
- [ ] 实现 UpdateTaskTool
- [ ] 实现 DeleteTaskTool
- [ ] 检查 linter 错误
- [ ] 注册到工具列表

### 阶段 3
- [ ] 测试场景 1（创建）
- [ ] 测试场景 2（更新）
- [ ] 测试场景 3（删除）
- [ ] 验证笔记内容正确
- [ ] 验证任务同步正确

### 阶段 4（可选）
- [ ] 实现 parseTaskIntent
- [ ] 测试 NLP 解析准确性
- [ ] 实现 findTaskByKeyword
- [ ] 测试智能查找

---

## 🚀 立即开始

**我们现在做什么？**

**选项 A（推荐）**：先做 MVP（4.5小时）
- 快速实现核心功能
- 验证架构正确性
- 让用户先用起来

**选项 B**：直接做完整版（7.5小时）
- 一次性实现所有功能
- 用户体验更好
- 开发时间更长

**我的建议**：选项 A！先做 MVP，验证后再添加智能功能。

---

**准备好了吗？回复 "开始 MVP" 或 "开始完整版"！** 🚀




