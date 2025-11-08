# 🛠️ Agent 工具清单

## 📦 当前已实现的工具（6个）

### 1. 🔄 `load_task_context` - 加载任务上下文
**功能**：填充 Agent 的长期记忆（近3个月任务信息）

**用途**：
- 加载今天的任务详情
- 统计近3个月的任务数据（总数、完成数、紧急数等）
- 提供月度任务统计（上月、本月、下月）

**参数**：
```typescript
{
  userId: string          // 用户 ID
  referenceDate?: string  // 参考日期（默认今天）
}
```

**使用场景**：
- Agent 首次运行时自动调用
- 用户询问整体任务情况时调用

---

### 2. 📋 `get_tasks` - 查询任务列表
**功能**：查询用户的任务列表，支持按日期范围、优先级筛选

**用途**：
- 查询特定日期范围的任务
- 按优先级筛选任务
- 查询已完成/未完成任务

**参数**：
```typescript
{
  userId: string                         // 用户 ID
  dateRange?: {                          // 日期范围（可选）
    start: "YYYY-MM-DD"
    end: "YYYY-MM-DD"
  }
  priority?: 'high' | 'medium' | 'low'  // 优先级筛选（可选）
  includeCompleted?: boolean             // 是否包含已完成任务（默认 false）
}
```

**使用场景**：
- 用户问："我今天有哪些任务？"
- 用户问："我这周有什么高优先级任务？"
- 用户问："查看本月的任务"

---

### 3. 📊 `analyze_tasks` - 分析任务状态
**功能**：分析任务状态，识别需要处理的问题

**用途**：
- 识别紧急任务（deadline 在 3 天内）
- 识别缺少时间估算的任务
- 识别需要澄清的任务（缺少描述）
- 识别可能可以拆解的任务（标题较长）
- 提供优先级分布统计

**参数**：
```typescript
{
  tasks: Task[]  // 任务列表（可从 get_tasks 获取）
}
```

**使用场景**：
- 用户问："帮我分析今天的任务"
- 用户问："我的任务有什么问题吗？"
- 用户问："检查一下任务状态"

**⚠️ 重要**：这个工具**不应该**在用户只是查询任务列表时自动调用！

---

### 4. 🤔 `clarify_task` - 澄清任务
**功能**：生成苏格拉底式问题，帮助用户澄清任务定义（交互式）

**用途**：
- 第一轮：生成 3-5 个澄清问题
- 第二轮：接收用户回答，保存澄清结果

**参数**：
```typescript
{
  task: Task           // 要澄清的任务对象
  userContext?: string // 用户的回答（第二轮）
}
```

**使用场景**：
- 用户问："帮我澄清任务：完成项目报告"
- Agent 自动识别到任务缺少描述时提议澄清

**流程**：
```
用户：帮我澄清任务：完成项目报告
Agent：[调用 clarify_task] → 返回 3 个问题
用户：[回答问题]
Agent：[再次调用 clarify_task 并传入回答] → 保存澄清结果
```

---

### 5. ✂️ `decompose_task` - 拆解任务
**功能**：将复杂任务拆解为多个可执行的子任务（交互式）

**用途**：
- 第一轮：生成拆解问题，询问任务背景
- 第二轮：根据用户回答，执行任务拆解

**参数**：
```typescript
{
  task: Task           // 要拆解的任务对象
  userContext?: string // 用户提供的背景信息（第二轮）
}
```

**使用场景**：
- 用户问："帮我把'学习 React'这个任务拆成小步骤"
- Agent 自动识别到任务较复杂时提议拆解

**流程**：
```
用户：帮我拆解任务：学习 React
Agent：[调用 decompose_task] → 询问背景（经验、目标等）
用户：[提供背景]
Agent：[再次调用并传入背景] → 返回子任务列表
```

---

### 6. ⏱️ `estimate_time` - 估算时间
**功能**：帮助用户估算任务所需时间

**用途**：
- 基于任务复杂度估算时间
- 考虑用户经验和历史数据
- 提供估算理由和建议

**参数**：
```typescript
{
  task: Task           // 要估算的任务对象
  userContext?: string // 用户补充信息（可选，如特殊情况、难点等）
}
```

**使用场景**：
- 用户问："完成这个任务大概需要多久？"
- 用户问："估算一下'写论文'的时间"

---

## 🚧 建议添加的工具

### 高优先级（P0 - 核心功能）

#### 7. ➕ `create_task` - 创建任务
**功能**：帮助用户创建新任务

**用途**：
- 从用户的自然语言中提取任务信息
- 自动识别标题、描述、deadline、优先级
- 保存到数据库

**参数**：
```typescript
{
  userId: string
  title: string              // 任务标题
  description?: string       // 任务描述
  priority?: string          // 优先级
  deadline_date?: string     // 截止日期
  deadline_time?: string     // 截止时间
  estimated_duration?: number // 估算时长（分钟）
}
```

**使用场景**：
- 用户说："帮我创建一个任务：明天下午3点前完成报告"
- Agent 自动解析并创建任务

---

#### 8. ✏️ `update_task` - 更新任务
**功能**：修改现有任务的信息

**用途**：
- 更新任务标题、描述
- 修改 deadline、优先级
- 标记任务完成/未完成

**参数**：
```typescript
{
  taskId: string
  updates: {
    title?: string
    description?: string
    priority?: string
    deadline_date?: string
    deadline_time?: string
    completed?: boolean
  }
}
```

**使用场景**：
- 用户说："把'写报告'的 deadline 改到明天"
- 用户说："标记任务完成"

---

#### 9. 🗑️ `delete_task` - 删除任务
**功能**：删除指定的任务

**参数**：
```typescript
{
  taskId: string
}
```

**使用场景**：
- 用户说："删除这个任务"
- 用户说："取消'学习 React'这个任务"

---

### 中优先级（P1 - 重要功能）

#### 10. 🔍 `search_tasks` - 搜索任务
**功能**：按关键词搜索任务

**参数**：
```typescript
{
  userId: string
  keyword: string           // 搜索关键词
  searchIn?: 'title' | 'description' | 'both'  // 搜索范围
}
```

**使用场景**：
- 用户说："找一下包含'报告'的任务"
- 用户说："搜索关于学习的任务"

---

#### 11. 🏷️ `manage_task_tags` - 管理任务标签
**功能**：为任务添加/删除标签（项目中已有 task_tags 功能）

**参数**：
```typescript
{
  taskId: string
  action: 'add' | 'remove' | 'list'
  tags?: string[]  // action 为 'add' 或 'remove' 时需要
}
```

**使用场景**：
- 用户说："给这个任务加上'工作'标签"
- 用户说："查看任务的标签"

---

#### 12. 📝 `manage_notes` - 管理笔记
**功能**：创建、编辑、搜索笔记（项目中已有笔记功能）

**参数**：
```typescript
{
  userId: string
  action: 'create' | 'update' | 'get' | 'search'
  noteDate?: string        // action 为 'create' 或 'get' 时使用
  content?: string         // action 为 'create' 或 'update' 时使用
  keyword?: string         // action 为 'search' 时使用
}
```

**使用场景**：
- 用户说："创建一个今天的笔记"
- 用户说："查看昨天的笔记"

---

### 低优先级（P2 - 增强功能）

#### 13. 📅 `import_calendar` - 导入日历
**功能**：从 Google Calendar、Outlook、Canvas 导入事件

**参数**：
```typescript
{
  userId: string
  source: 'google' | 'outlook' | 'canvas'
  dateRange?: {
    start: string
    end: string
  }
}
```

**使用场景**：
- 用户说："从 Google Calendar 导入本周的事件"
- 用户说："同步 Canvas 的课程表"

---

#### 14. 📈 `generate_report` - 生成报告
**功能**：生成任务完成情况报告

**参数**：
```typescript
{
  userId: string
  reportType: 'daily' | 'weekly' | 'monthly'
  date?: string  // 报告日期
}
```

**使用场景**：
- 用户说："生成本周的任务完成报告"
- 用户说："看看这个月完成了多少任务"

---

#### 15. 🎯 `recommend_tasks` - 推荐任务
**功能**：基于用户习惯和当前时间推荐应该做的任务

**参数**：
```typescript
{
  userId: string
  currentTime: string
}
```

**使用场景**：
- 用户说："我现在应该做什么？"
- 用户说："推荐一些任务给我"

---

## 📊 工具优先级总结

### ✅ 已实现（6个）
- ✅ `load_task_context` - P0
- ✅ `get_tasks` - P0
- ✅ `analyze_tasks` - P0
- ✅ `clarify_task` - P1
- ✅ `decompose_task` - P1
- ✅ `estimate_time` - P1

### 🚧 建议实现
**P0 - 核心功能（3个）**：
- ⬜ `create_task` - 创建任务
- ⬜ `update_task` - 更新任务
- ⬜ `delete_task` - 删除任务

**P1 - 重要功能（3个）**：
- ⬜ `search_tasks` - 搜索任务
- ⬜ `manage_task_tags` - 管理标签
- ⬜ `manage_notes` - 管理笔记

**P2 - 增强功能（3个）**：
- ⬜ `import_calendar` - 导入日历
- ⬜ `generate_report` - 生成报告
- ⬜ `recommend_tasks` - 推荐任务

---

## 🎯 下一步建议

**立即实现（让 Agent 更实用）**：
1. **`create_task`** - 用户可以直接用自然语言创建任务
2. **`update_task`** - 用户可以修改任务信息
3. **`delete_task`** - 用户可以删除任务

这 3 个工具会让 Agent 从"只能查询和分析"变成"真正能帮用户管理任务"！

**示例对话（实现后）**：
```
用户：帮我创建一个任务，明天下午3点前完成报告，高优先级
Agent：[调用 create_task] → "✅ 已创建任务：完成报告（明天 15:00，高优先级）"

用户：把 deadline 改到后天
Agent：[调用 update_task] → "✅ 已更新，新的 deadline 是后天 15:00"

用户：算了，取消这个任务
Agent：[调用 delete_task] → "✅ 已删除任务：完成报告"
```

---

## 📝 开发建议

### 实现新工具的步骤：
1. 在 `src/lib/agent/tools/` 创建工具文件（如 `CreateTaskTool.ts`）
2. 实现 `AgentTool` 接口：
   - `name`: 工具名称
   - `description`: 功能描述
   - `parameters`: 参数 schema
   - `execute()`: 执行逻辑
3. 在 `src/lib/agent/tools/index.ts` 中注册工具
4. 在 `src/lib/agent/tools/__tests__/` 中添加单元测试
5. 更新 `AgentPrompt.ts` 中的 Few-shot 示例（可选，但推荐）

### 工具设计原则：
- **单一职责**：每个工具只做一件事
- **明确参数**：参数类型清晰，必需/可选明确
- **足够用原则**：不返回冗余信息
- **交互式优先**：复杂流程使用 `need_input` 机制
- **错误友好**：返回清晰的错误信息

---

**你想先实现哪个工具？我可以帮你写代码！** 🚀

