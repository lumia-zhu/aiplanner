# Phase 5: P0 核心工具开发计划

## 📋 目标

实现 3 个核心 CRUD 工具，让 Agent 能真正帮用户管理任务：
1. **`create_task`** - 创建任务
2. **`update_task`** - 更新任务
3. **`delete_task`** - 删除任务

---

## 🔍 现状分析

### ✅ 好消息：底层函数已实现！

在 `src/lib/tasks.ts` 中已有以下函数：
- **`createTask(userId, taskData)`** - 第84行
- **`updateTask(taskId, updates)`** - 第158行
- **`deleteTask(taskId)`** - 第250行

**这意味着我们只需要：**
1. 为这些函数创建 Agent Tool 包装器
2. 添加参数验证和错误处理
3. 对于 `create_task`，增加**自然语言解析**能力

### 📊 现有函数能力分析

#### `createTask` 支持的参数：
```typescript
{
  title: string                   // ✅ 必需
  description?: string            // ✅ 可选
  deadline_time?: string          // ✅ 可选（支持多种格式）
  priority?: 'low' | 'medium' | 'high'  // ✅ 可选
  parent_id?: string              // ✅ 可选（子任务）
  estimated_duration?: number     // ✅ 可选（分钟数）
  subtask_order?: number          // ✅ 可选
  tags?: string[]                 // ✅ 可选
}
```

#### `updateTask` 支持的参数：
```typescript
{
  title?: string
  description?: string
  deadline_time?: string
  priority?: 'low' | 'medium' | 'high'
  completed?: boolean
  tags?: string[]
  estimated_duration?: number
}
```

#### `deleteTask` 支持的参数：
```typescript
taskId: string  // 任务 ID
```

---

## 🎯 开发方案（分3个工具，每个工具又分多个步骤）

---

## 工具 1: `create_task` - 创建任务

### 🌟 核心挑战：自然语言解析

**问题**：用户可能这样说话：
- "帮我创建一个任务，明天下午3点前完成报告，高优先级"
- "新建任务：学习 React，估计需要 2 小时"
- "加个任务：买菜"

**解决方案**：使用 LLM 提取结构化信息

### Step 1: 创建基础工具类（不含 NLP）

**文件**: `src/lib/agent/tools/CreateTaskTool.ts`

**功能**：
- 定义工具元数据（name, description, parameters）
- 实现 `execute()` 方法，直接调用 `createTask()`
- 参数验证：至少需要 `title`

**参数 Schema**：
```typescript
{
  type: 'object',
  properties: {
    userId: { type: 'string', description: '用户 ID' },
    title: { type: 'string', description: '任务标题（必需）' },
    description: { type: 'string', description: '任务描述（可选）' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'], description: '优先级（可选，默认 medium）' },
    deadline_time: { type: 'string', description: '截止时间（可选），格式：YYYY-MM-DDTHH:MM:SS 或 HH:MM' },
    estimated_duration: { type: 'number', description: '估算时长（分钟，可选）' },
    tags: { type: 'array', items: { type: 'string' }, description: '标签列表（可选）' }
  },
  required: ['userId', 'title']
}
```

**返回格式**：
```typescript
{
  type: 'success',
  data: {
    taskId: string,
    title: string,
    message: "✅ 已创建任务：[标题]"
  }
}
```

**预期时间**：30 分钟

---

### Step 2: 添加单元测试（基础版）

**文件**: `src/lib/agent/tools/__tests__/CreateTaskTool.test.ts`

**测试用例**：
1. ✅ 创建最简单的任务（只有 title）
2. ✅ 创建完整任务（所有字段）
3. ❌ 缺少 userId 应报错
4. ❌ 缺少 title 应报错
5. ✅ 处理空的可选字段
6. ✅ 时间格式转换（`"15:00"` → ISO 格式）

**预期时间**：20 分钟

---

### Step 3: 添加到工具注册中心并测试

**修改文件**: `src/lib/agent/tools/index.ts`

**操作**：
```typescript
import { CreateTaskTool } from './CreateTaskTool'

toolsCache = [
  new LoadTaskContextTool(),
  new GetTasksTool(),
  new AnalyzeTasksTool(),
  new ClarifyTaskTool(),
  new DecomposeTaskTool(),
  new EstimateTimeTool(),
  new CreateTaskTool(),  // ⭐ 新增
]
```

**测试步骤**：
1. 在 Agent UI 中测试："帮我创建一个任务：测试任务"
2. 检查是否成功调用工具
3. 检查数据库是否插入成功
4. 检查返回消息是否清晰

**预期时间**：15 分钟

---

### Step 4: 添加自然语言解析能力（可选，P1）

**新建文件**: `src/lib/agent/tools/parseTaskIntent.ts`

**功能**：使用 LLM 从用户消息中提取任务信息

**输入**：
```typescript
{
  userMessage: "明天下午3点前完成报告，高优先级，估计2小时"
}
```

**输出**：
```typescript
{
  title: "完成报告",
  description: null,
  priority: "high",
  deadline_time: "2025-11-09T15:00:00",  // 明天下午3点
  estimated_duration: 120  // 2小时 = 120分钟
}
```

**LLM Prompt 示例**：
```
你是一个任务信息提取助手。请从用户的自然语言中提取任务信息。

当前时间：2025-11-08 14:30

用户消息：明天下午3点前完成报告，高优先级，估计2小时

请返回 JSON 格式：
{
  "title": "任务标题（必需，简短明确）",
  "description": "任务描述（可选）",
  "priority": "low|medium|high（可选，默认medium）",
  "deadline_time": "YYYY-MM-DDTHH:MM:SS（可选）",
  "estimated_duration": 数字（分钟，可选）
}

注意：
- 标题要简短（5-15字）
- 时间要转换为绝对时间（ISO格式）
- 如果没有明确信息，不要猜测，返回 null
```

**修改 CreateTaskTool**：
- 添加 `parseUserMessage?: boolean` 参数
- 如果为 true，先调用 `parseTaskIntent()`
- 再调用 `createTask()`

**预期时间**：1 小时（这个功能较复杂，可以放到后面做）

**优先级**：**P1（第一阶段可以不做）**

---

## 工具 2: `update_task` - 更新任务

### 🌟 核心挑战：识别任务和更新字段

**问题**：用户可能这样说话：
- "把'写报告'的 deadline 改到明天"
- "标记任务完成"
- "把优先级改成高"

**解决方案**：
- 第一阶段：要求用户提供 `taskId`（明确）
- 第二阶段（P1）：从任务标题查找 `taskId`（智能）

### Step 1: 创建基础工具类

**文件**: `src/lib/agent/tools/UpdateTaskTool.ts`

**参数 Schema**：
```typescript
{
  type: 'object',
  properties: {
    taskId: { type: 'string', description: '任务 ID（必需）' },
    updates: {
      type: 'object',
      description: '要更新的字段',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        deadline_time: { type: 'string' },
        completed: { type: 'boolean' },
        estimated_duration: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  required: ['taskId', 'updates']
}
```

**返回格式**：
```typescript
{
  type: 'success',
  data: {
    taskId: string,
    updatedFields: string[],  // ['priority', 'deadline_time']
    message: "✅ 已更新任务：[标题]"
  }
}
```

**边界情况**：
- ❌ 任务 ID 不存在 → 返回错误
- ❌ updates 对象为空 → 返回错误 "没有指定要更新的字段"
- ✅ 只更新部分字段 → 成功
- ⚠️ 权限检查：任务必须属于当前用户（RLS 会自动处理）

**预期时间**：30 分钟

---

### Step 2: 添加单元测试

**文件**: `src/lib/agent/tools/__tests__/UpdateTaskTool.test.ts`

**测试用例**：
1. ✅ 更新单个字段（如 priority）
2. ✅ 更新多个字段
3. ✅ 标记任务完成/未完成
4. ❌ 空的 updates 对象
5. ❌ 任务 ID 不存在
6. ✅ 清空可选字段（如 description: null）

**预期时间**：20 分钟

---

### Step 3: 集成并测试

**测试步骤**：
1. 先用 `get_tasks` 查询任务列表（获取 taskId）
2. 用 Agent 执行："把任务 [ID] 的优先级改成高"
3. 再次查询验证是否更新成功

**预期时间**：15 分钟

---

### Step 4: 添加智能任务查找（可选，P1）

**新建文件**: `src/lib/agent/tools/findTaskByTitle.ts`

**功能**：根据任务标题查找任务 ID

**逻辑**：
1. 用户说："把'写报告'的 deadline 改到明天"
2. Agent 解析出标题关键词："写报告"
3. 调用 `get_tasks` 查询用户所有任务
4. 使用模糊匹配找到最相关的任务
5. 如果找到多个，要求用户澄清
6. 如果找到1个，自动使用

**预期时间**：1 小时

**优先级**：**P1（第一阶段可以不做）**

---

## 工具 3: `delete_task` - 删除任务

### 🌟 核心挑战：确认机制

**问题**：删除是危险操作，需要用户确认

**解决方案**：
- 使用 `need_input` 机制，暂停并请求确认
- 第一轮：返回任务详情，询问是否确认删除
- 第二轮：接收用户确认，执行删除

### Step 1: 创建基础工具类（含确认机制）

**文件**: `src/lib/agent/tools/DeleteTaskTool.ts`

**参数 Schema**：
```typescript
{
  type: 'object',
  properties: {
    taskId: { type: 'string', description: '任务 ID（必需）' },
    confirmed: { type: 'boolean', description: '是否已确认删除（第二轮调用时使用）' }
  },
  required: ['taskId']
}
```

**执行逻辑**：
```typescript
async execute(params, context) {
  const { taskId, confirmed } = params
  
  // 第一轮：查询任务详情，请求确认
  if (!confirmed) {
    // 1. 查询任务详情
    const task = await getTaskById(taskId)
    
    if (!task) {
      return { type: 'error', message: '任务不存在' }
    }
    
    // 2. 返回 need_input，显示任务详情并请求确认
    return {
      type: 'need_input',
      prompt: `确定要删除任务吗？\n\n标题：${task.title}\n描述：${task.description || '无'}\n\n请回复 "确认" 或 "取消"`
    }
  }
  
  // 第二轮：执行删除
  const result = await deleteTask(taskId)
  
  if (result.error) {
    return { type: 'error', message: result.error }
  }
  
  return {
    type: 'success',
    data: { taskId, message: '✅ 任务已删除' }
  }
}
```

**返回格式**：

**第一轮（need_input）**：
```typescript
{
  type: 'need_input',
  prompt: "确定要删除任务吗？\n\n标题：写报告\n描述：完成Q4季度报告...",
  context: {
    taskId: "123-456-789"
  }
}
```

**第二轮（success）**：
```typescript
{
  type: 'success',
  data: {
    taskId: string,
    message: "✅ 任务已删除"
  }
}
```

**预期时间**：40 分钟（需要实现交互式流程）

---

### Step 2: 添加单元测试

**文件**: `src/lib/agent/tools/__tests__/DeleteTaskTool.test.ts`

**测试用例**：
1. ✅ 第一轮：返回 need_input
2. ✅ 第二轮（confirmed=true）：成功删除
3. ❌ 任务 ID 不存在
4. ✅ 用户取消删除（confirmed=false）
5. ⚠️ 删除后验证数据库确实删除

**预期时间**：25 分钟

---

### Step 3: 集成并测试

**测试步骤**：
1. Agent 模式下说："删除任务 [ID]"
2. Agent 返回确认提示（黄色 NeedInput 卡片）
3. 用户输入 "确认"
4. Agent 执行删除并返回成功消息
5. 验证任务列表中已不存在该任务

**预期时间**：15 分钟

---

### Step 4: 添加"批量删除"支持（可选，P2）

**功能**：删除多个任务

**参数**：
```typescript
{
  taskIds: string[]  // 任务 ID 列表
}
```

**预期时间**：30 分钟

**优先级**：**P2（低优先级）**

---

## 🗓️ 总体时间估算

### 最小可行版本（MVP）

| 工具 | 步骤 | 预计时间 |
|------|------|----------|
| **create_task** | Step 1-3 | 1小时15分钟 |
| **update_task** | Step 1-3 | 1小时5分钟 |
| **delete_task** | Step 1-3 | 1小时20分钟 |
| **集成测试** | 端到端测试 | 30分钟 |
| **文档** | 更新 README & 示例 | 20分钟 |
| **总计** | | **约 4.5 小时** |

### 完整版（含 NLP 和智能功能）

| 功能 | 额外时间 |
|------|----------|
| create_task NLP 解析 | +1小时 |
| update_task 智能查找 | +1小时 |
| delete_task 批量删除 | +30分钟 |
| **总计** | **约 7 小时** |

---

## 📋 开发步骤总结（推荐顺序）

### 阶段 1：最小可行版本（MVP） - 推荐先做这个！

```
Day 1 上午（2小时）：
✅ Step 1: 创建 CreateTaskTool（基础版）
✅ Step 2: 单元测试
✅ Step 3: 集成测试

Day 1 下午（2小时）：
✅ Step 4: 创建 UpdateTaskTool（基础版）
✅ Step 5: 单元测试
✅ Step 6: 集成测试

Day 2 上午（1.5小时）：
✅ Step 7: 创建 DeleteTaskTool（含确认）
✅ Step 8: 单元测试
✅ Step 9: 集成测试

Day 2 下午（1小时）：
✅ Step 10: 端到端测试（所有工具）
✅ Step 11: 更新文档
✅ Step 12: 提交代码
```

### 阶段 2：智能增强（可选）

```
Day 3：
✅ 添加 NLP 解析到 create_task
✅ 添加智能查找到 update_task
✅ 测试和优化
```

---

## ⚠️ 潜在问题和解决方案

### 问题 1：如何获取任务 ID？

**问题**：用户通常不知道任务 ID

**解决方案**：
1. **短期**：Agent 先调用 `get_tasks` 查询任务列表，然后使用返回的 taskId
2. **长期**：实现智能查找，根据标题模糊匹配

**示例对话（短期方案）**：
```
用户：把"写报告"的优先级改成高
Agent：[Thought] 需要先找到任务 ID
Agent：[Action] get_tasks（查询所有任务）
Agent：[Observation] 找到任务：id=123, title="写报告"
Agent：[Action] update_task（taskId=123, priority=high）
Agent：[Response] ✅ 已更新任务"写报告"的优先级为高
```

---

### 问题 2：时间格式转换

**问题**：用户说"明天下午3点"，如何转换成 ISO 格式？

**解决方案**：
- 在 NLP 解析时（`parseTaskIntent`）使用 LLM 理解时间
- LLM Prompt 中明确当前时间，让 LLM 计算相对时间
- 验证生成的时间是否合理（不能是过去的时间）

**示例 Prompt**：
```
当前时间：2025-11-08 14:30（周五）

用户说："明天下午3点"
请转换为 ISO 格式：2025-11-09T15:00:00

用户说："下周一上午10点"
请转换为 ISO 格式：2025-11-11T10:00:00
```

---

### 问题 3：权限和安全

**问题**：如何防止用户删除/修改别人的任务？

**解决方案**：
- ✅ **数据库层 RLS**：Supabase 已配置 RLS 策略，自动过滤
- ✅ **Tool 层验证**：确保传入的 `userId` 与当前登录用户一致
- ✅ **错误处理**：当 RLS 拒绝操作时，返回清晰的错误消息

---

### 问题 4：删除确认的用户体验

**问题**：确认流程会打断对话，体验不好

**解决方案**：
- **方案 A**（推荐）：实现交互式确认（已在 Step 1 中设计）
- **方案 B**：添加"强制删除"参数 `force=true`，跳过确认（危险）
- **方案 C**：只对重要任务（有子任务、未完成且过期）请求确认

---

## 🧪 测试策略

### 单元测试（每个工具独立测试）

**工具**：Jest / Vitest

**覆盖率目标**：> 80%

**测试文件位置**：`src/lib/agent/tools/__tests__/`

---

### 集成测试（在 Agent 上下文中测试）

**测试场景**：
1. 创建 → 查询 → 验证
2. 创建 → 更新 → 查询 → 验证
3. 创建 → 删除（确认）→ 查询 → 验证已删除
4. 错误处理（如任务不存在、缺少参数）

**测试页面**：创建 `src/app/test-crud-tools/page.tsx`

---

### 端到端测试（真实场景）

**测试场景**：
```
场景 1：快速创建任务
用户：帮我创建一个任务：买菜
Agent：✅ 已创建任务：买菜

场景 2：创建复杂任务
用户：新建任务：完成报告，明天下午3点截止，高优先级，估计2小时
Agent：✅ 已创建任务：完成报告
      - 截止时间：2025-11-09 15:00
      - 优先级：高
      - 估算时长：2小时

场景 3：更新任务
用户：我今天有哪些任务？
Agent：[列出任务，包含 ID]
用户：把第一个任务的优先级改成高
Agent：✅ 已更新任务"买菜"的优先级为高

场景 4：删除任务
用户：删除"买菜"这个任务
Agent：确定要删除任务吗？
      标题：买菜
      请回复 "确认" 或 "取消"
用户：确认
Agent：✅ 任务已删除
```

---

## 📚 文档和示例

### 更新 README.md

添加新工具的使用说明：

````markdown
#### 创建任务
```
你：帮我创建一个任务：完成报告，明天下午3点，高优先级
Agent：[调用 create_task] → 返回任务详情
```

#### 更新任务
```
你：把这个任务的优先级改成高
Agent：[调用 update_task] → 更新成功
```

#### 删除任务
```
你：删除这个任务
Agent：[调用 delete_task] → 请求确认
你：确认
Agent：[再次调用] → 删除成功
```
````

---

## 🎯 里程碑和验收标准

### Milestone 1：基础 CRUD 完成

**验收标准**：
- ✅ 3 个工具都能成功注册
- ✅ 单元测试全部通过
- ✅ 能在 Agent UI 中手动调用并成功执行
- ✅ 数据库操作成功（查询验证）
- ✅ 错误处理正确（如任务不存在）

---

### Milestone 2：端到端场景测试通过

**验收标准**：
- ✅ 场景 1-4 全部通过
- ✅ Agent 能自动选择正确的工具
- ✅ 交互式流程（删除确认）正常工作
- ✅ 用户反馈体验良好

---

### Milestone 3：智能增强（可选）

**验收标准**：
- ✅ NLP 解析准确率 > 85%
- ✅ 智能任务查找成功率 > 80%
- ✅ 复杂对话场景通过

---

## 🚀 开始前的准备

### 1. 代码审查

- ✅ 确认 `src/lib/tasks.ts` 中的函数都正常工作
- ✅ 确认数据库 RLS 策略正确配置
- ✅ 确认现有 Agent 工具的实现模式

### 2. 环境准备

- ✅ 安装测试依赖（如果还没有）
- ✅ 配置测试数据库（或使用开发数据库）
- ✅ 准备测试用户账号

### 3. 分支管理

```bash
git checkout -b feature/phase5-p0-crud-tools
```

---

## 🤔 决策点

在开始前，需要确认以下几点：

### 决策 1：是否包含 NLP 解析？

**选项 A**：只做基础版（明确参数）- **推荐 MVP**
- ✅ 快速实现（4.5小时）
- ✅ 稳定可靠
- ❌ 需要用户提供明确参数

**选项 B**：包含 NLP 解析（智能版）
- ✅ 用户体验更好
- ✅ 更自然的对话
- ❌ 开发时间更长（7小时）
- ❌ 可能有解析错误

**建议**：先做选项 A，验证后再做选项 B

---

### 决策 2：删除操作的确认机制？

**选项 A**：每次都确认（最安全）- **推荐**
**选项 B**：仅重要任务确认（智能）
**选项 C**：不确认（最快，但危险）

**建议**：选项 A

---

### 决策 3：测试范围？

**选项 A**：完整测试（单元 + 集成 + E2E）- **推荐**
**选项 B**：仅集成测试（快速）
**选项 C**：手动测试（最快，但不可靠）

**建议**：选项 A（至少要有单元测试和手动 E2E 测试）

---

## ✅ 准备就绪检查清单

开始开发前，请确认：

- [ ] 已阅读并理解整个开发计划
- [ ] 已确认 3 个决策点
- [ ] 已检查现有代码（tasks.ts）
- [ ] 已准备开发环境
- [ ] 已创建开发分支
- [ ] 清楚第一步要做什么（CreateTaskTool Step 1）

---

## 💬 你的决策

请告诉我：

1. **是否包含 NLP 解析？**（建议：先不包含，做 MVP）
2. **删除确认机制？**（建议：每次都确认）
3. **测试范围？**（建议：至少单元测试 + 手动 E2E）

**我建议的最佳路径**：
```
✅ 只做基础版（明确参数）
✅ 删除每次都确认
✅ 完整测试（单元 + E2E）
⏱️ 预计时间：5小时

完成后再考虑智能增强！
```

---

**准备好了吗？回复 "开始" 我们就从 CreateTaskTool Step 1 开始！** 🚀



