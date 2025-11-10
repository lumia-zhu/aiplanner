# Phase 5: 完整版执行计划（包含充分测试）

## 🎯 目标

实现 3 个 P0 核心 Agent 工具，操作**笔记中的任务**（taskItem 节点），包含完整的 NLP 智能功能和充分测试。

---

## 📋 总体架构

### 核心理念
```
用户自然语言
    ↓
Agent 解析意图
    ↓
调用工具操作笔记
    ↓
修改 Tiptap JSON 中的 taskItem 节点
    ↓
保存笔记并同步到 daily_tasks 表
```

### 层次结构
```
Layer 1: Agent Tools (create_task, update_task, delete_task)
    ↓ 调用
Layer 2: 辅助函数 (noteTaskOperations.ts)
    ↓ 调用
Layer 3: 基础 API (notes.ts, taskSync.ts)
    ↓ 操作
Layer 4: 数据库 (notes 表)
```

---

## 🗓️ 详细步骤（共 15 步）

---

## 阶段 1: 基础设施（辅助函数） - 2.5小时

### Step 1: 创建 noteTaskOperations.ts（核心函数）⭐⭐⭐
**文件**: `src/lib/noteTaskOperations.ts`

**功能**: 操作笔记中 taskItem 节点的底层函数

**要实现的函数**:

#### 1.1 `findAllTasks(noteContent: JSONContent)`
```typescript
/**
 * 在笔记中查找所有 taskItem 节点
 * 返回: Array<{
 *   node: JSONContent,           // 任务节点
 *   position: number,            // 任务位置（第几个任务）
 *   title: string,               // 任务标题（纯文本）
 *   checked: boolean,            // 是否完成
 *   path: number[]               // JSON 树中的路径（用于精确定位）
 * }>
 */
```

**实现要点**:
- 递归遍历 JSON 树
- 记录每个 taskItem 的路径（如 `[1, 0, 2]` 表示第1个子节点的第0个子节点的第2个子节点）
- 提取纯文本（去除标签 marks）
- 按 position 排序返回

#### 1.2 `updateTaskInNote(noteContent, taskPosition, updates)`
```typescript
/**
 * 更新笔记中的任务
 * @param noteContent - 笔记内容（Tiptap JSON）
 * @param taskPosition - 任务位置（第几个任务，从 0 开始）
 * @param updates - 更新内容 { checked?: boolean, title?: string }
 * @returns 新的笔记内容
 */
```

**实现要点**:
- 先调用 `findAllTasks` 找到目标任务
- 使用 `path` 定位到具体节点
- 深拷贝 noteContent（不修改原对象）
- 修改目标节点
  - 如果更新 `checked`，修改 `attrs.checked`
  - 如果更新 `title`，替换 `content[0].content` 数组
- 返回新的 noteContent

#### 1.3 `deleteTaskFromNote(noteContent, taskPosition)`
```typescript
/**
 * 删除笔记中的任务
 * @param noteContent - 笔记内容
 * @param taskPosition - 任务位置
 * @returns 新的笔记内容
 */
```

**实现要点**:
- 先调用 `findAllTasks` 找到目标任务
- 深拷贝 noteContent
- 使用 `path` 定位到父节点
- 从父节点的 `content` 数组中移除
- 如果 taskList 变空，移除整个 taskList 节点
- 返回新的 noteContent

**预计时间**: 1.5 小时

---

### Step 2: 为 noteTaskOperations.ts 编写单元测试 ⭐⭐⭐
**文件**: `src/lib/__tests__/noteTaskOperations.test.ts`

**测试用例**:

#### 2.1 `findAllTasks` 测试
```typescript
describe('findAllTasks', () => {
  test('空笔记返回空数组', () => {})
  test('查找单个任务', () => {})
  test('查找多个任务', () => {})
  test('任务在不同的 taskList 中', () => {})
  test('正确提取任务标题（去除标签 marks）', () => {})
  test('正确识别 checked 状态', () => {})
  test('正确记录任务位置', () => {})
})
```

#### 2.2 `updateTaskInNote` 测试
```typescript
describe('updateTaskInNote', () => {
  test('更新任务的 checked 状态', () => {})
  test('更新任务标题', () => {})
  test('同时更新 checked 和 title', () => {})
  test('更新不存在的任务位置应抛出错误', () => {})
  test('不修改原始 noteContent 对象', () => {})
  test('保留任务的标签 marks', () => {})
})
```

#### 2.3 `deleteTaskFromNote` 测试
```typescript
describe('deleteTaskFromNote', () => {
  test('删除第一个任务', () => {})
  test('删除中间的任务', () => {})
  test('删除最后一个任务', () => {})
  test('删除唯一的任务应移除 taskList', () => {})
  test('删除不存在的任务位置应抛出错误', () => {})
  test('不修改原始 noteContent 对象', () => {})
})
```

**预计时间**: 1 小时

---

## 阶段 2: Agent 工具（基础版）- 2.5小时

### Step 3: 创建 CreateTaskTool（基础版）⭐⭐
**文件**: `src/lib/agent/tools/CreateTaskTool.ts`

**参数**:
```typescript
{
  userId: string,
  taskTitle: string,      // 可以包含标签，如"完成报告 #工作"
  targetDate?: string,    // YYYY-MM-DD，默认今天
  parseIntent?: boolean   // 是否使用 NLP 解析（后续实现）
}
```

**执行逻辑**:
```typescript
async execute(params) {
  console.log('➕ 创建任务:', params)
  
  // 1. 验证参数
  if (!params.taskTitle || params.taskTitle.trim().length === 0) {
    return { type: 'error', message: '任务标题不能为空' }
  }
  
  // 2. 解析日期
  const targetDate = params.targetDate 
    ? new Date(params.targetDate) 
    : new Date()
  
  // 3. 调用 appendTaskToNote
  const { appendTaskToNote } = await import('@/lib/notes')
  const note = await appendTaskToNote(
    params.userId, 
    targetDate, 
    params.taskTitle.trim()
  )
  
  // 4. 返回成功消息
  return {
    type: 'success',
    data: {
      noteDate: formatNoteDate(targetDate),
      taskTitle: params.taskTitle,
      message: `✅ 已创建任务：${params.taskTitle}`
    }
  }
}
```

**预计时间**: 30 分钟

---

### Step 4: 创建 UpdateTaskTool（基础版）⭐⭐
**文件**: `src/lib/agent/tools/UpdateTaskTool.ts`

**参数**:
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

**执行逻辑**:
```typescript
async execute(params) {
  console.log('✏️ 更新任务:', params)
  
  // 1. 验证参数
  if (params.updates.checked === undefined && !params.updates.title) {
    return { type: 'error', message: '没有指定要更新的字段' }
  }
  
  // 2. 获取笔记
  const { getNoteByDate } = await import('@/lib/notes')
  const date = new Date(params.noteDate)
  const note = await getNoteByDate(params.userId, date)
  
  if (!note) {
    return { type: 'error', message: '笔记不存在' }
  }
  
  // 3. 更新任务
  const { updateTaskInNote } = await import('@/lib/noteTaskOperations')
  
  try {
    const newContent = updateTaskInNote(
      note.content, 
      params.taskPosition, 
      params.updates
    )
    
    // 4. 保存笔记
    const { saveNote } = await import('@/lib/notes')
    await saveNote(params.userId, note.id, newContent)
    
    // 5. 返回成功消息
    const updatedFields = []
    if (params.updates.checked !== undefined) {
      updatedFields.push(params.updates.checked ? '已完成' : '未完成')
    }
    if (params.updates.title) {
      updatedFields.push(`新标题："${params.updates.title}"`)
    }
    
    return {
      type: 'success',
      data: {
        message: `✅ 任务已更新：${updatedFields.join('，')}`
      }
    }
  } catch (error) {
    return {
      type: 'error',
      message: `更新任务失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}
```

**预计时间**: 40 分钟

---

### Step 5: 创建 DeleteTaskTool（含确认机制）⭐⭐⭐
**文件**: `src/lib/agent/tools/DeleteTaskTool.ts`

**参数**:
```typescript
{
  userId: string,
  noteDate: string,
  taskPosition: number,
  confirmed?: boolean  // 第二轮调用时使用
}
```

**执行逻辑**:
```typescript
async execute(params, context) {
  console.log('🗑️ 删除任务:', params)
  
  // 1. 获取笔记
  const { getNoteByDate } = await import('@/lib/notes')
  const date = new Date(params.noteDate)
  const note = await getNoteByDate(params.userId, date)
  
  if (!note) {
    return { type: 'error', message: '笔记不存在' }
  }
  
  // 2. 查找任务详情
  const { findAllTasks } = await import('@/lib/noteTaskOperations')
  const tasks = findAllTasks(note.content)
  
  if (params.taskPosition < 0 || params.taskPosition >= tasks.length) {
    return { type: 'error', message: '任务不存在' }
  }
  
  const task = tasks[params.taskPosition]
  
  // 第一轮：请求确认
  if (!params.confirmed) {
    return {
      type: 'need_input',
      prompt: `确定要删除任务吗？\n\n📋 任务：${task.title}\n${task.checked ? '✅' : '⬜'} 状态：${task.checked ? '已完成' : '未完成'}\n\n请回复 "确认" 或 "取消"`
    }
  }
  
  // 第二轮：执行删除
  try {
    const { deleteTaskFromNote } = await import('@/lib/noteTaskOperations')
    const newContent = deleteTaskFromNote(note.content, params.taskPosition)
    
    const { saveNote } = await import('@/lib/notes')
    await saveNote(params.userId, note.id, newContent)
    
    return {
      type: 'success',
      data: {
        message: `✅ 任务已删除：${task.title}`
      }
    }
  } catch (error) {
    return {
      type: 'error',
      message: `删除任务失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}
```

**预计时间**: 50 分钟

---

### Step 6: 注册工具到 Agent
**文件**: `src/lib/agent/tools/index.ts`

**修改**:
```typescript
import { CreateTaskTool } from './CreateTaskTool'
import { UpdateTaskTool } from './UpdateTaskTool'
import { DeleteTaskTool } from './DeleteTaskTool'

toolsCache = [
  new LoadTaskContextTool(),
  new GetTasksTool(),
  new AnalyzeTasksTool(),
  new ClarifyTaskTool(),
  new DecomposeTaskTool(),
  new EstimateTimeTool(),
  new CreateTaskTool(),   // ⭐ 新增
  new UpdateTaskTool(),   // ⭐ 新增
  new DeleteTaskTool(),   // ⭐ 新增
]
```

**检查**:
- ✅ linter 无错误
- ✅ 工具数量从 6 个变为 9 个

**预计时间**: 10 分钟

---

### Step 7: 手动测试基础功能（在 notes-dashboard）⭐⭐⭐
**目标**: 验证 3 个工具的基础功能

**测试场景 1: 创建任务**
```
1. 打开 http://localhost:3000/notes-dashboard
2. 开启 Agent 模式
3. 发送："帮我创建一个任务：买菜"
4. 检查 Agent 是否调用 create_task 工具
5. 检查是否返回成功消息
6. 刷新页面，检查笔记中是否出现新任务
```

**测试场景 2: 更新任务（标记完成）**
```
1. 发送："我今天有哪些任务？"
2. 记录第一个任务的位置
3. 发送："把第一个任务标记为完成"
4. 检查 Agent 是否调用 update_task 工具
5. 刷新页面，检查任务是否被勾选
```

**测试场景 3: 删除任务（含确认）**
```
1. 发送："删除第一个任务"
2. 检查 Agent 是否显示确认提示（黄色 NeedInput 卡片）
3. 发送："确认"
4. 检查 Agent 是否调用 delete_task 工具
5. 刷新页面，检查任务是否消失
```

**验收标准**:
- ✅ 所有 3 个场景测试通过
- ✅ 笔记内容正确更新
- ✅ 页面刷新后数据一致
- ✅ 无控制台错误

**预计时间**: 30 分钟

---

## 阶段 3: NLP 智能功能 - 3小时

### Step 8: 创建 parseTaskIntent（自然语言解析）⭐⭐⭐
**文件**: `src/lib/agent/parseTaskIntent.ts`

**功能**: 从自然语言中提取任务信息

**函数签名**:
```typescript
export async function parseTaskIntent(params: {
  userMessage: string,
  currentDate: string  // ISO format
}): Promise<{
  taskTitle: string,      // 简短标题，包含标签（如"完成报告 #工作"）
  targetDate: string,     // YYYY-MM-DD
  metadata: {
    deadline?: string,    // 具体截止时间（ISO格式）
    priority?: 'high' | 'medium' | 'low'
  }
}>
```

**实现逻辑**:
```typescript
export async function parseTaskIntent(params) {
  const { userMessage, currentDate } = params
  
  // 构建 LLM Prompt
  const prompt = `你是一个任务信息提取助手。从用户的自然语言中提取任务信息。

当前时间：${new Date(currentDate).toLocaleString('zh-CN', { 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit', 
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit'
})}

用户消息：${userMessage}

请返回 JSON 格式（只返回 JSON，不要任何解释）：
{
  "taskTitle": "任务标题（5-15字，去掉时间/优先级描述，包含标签如 #工作）",
  "targetDate": "YYYY-MM-DD（任务所属日期）",
  "metadata": {
    "deadline": "YYYY-MM-DDTHH:MM:SS（具体截止时间，可选）",
    "priority": "high|medium|low（可选）"
  }
}

规则：
1. 标题要简短清晰，是任务本身的描述
2. 时间相关的描述（"明天"、"下周"）不要放在标题里
3. 优先级描述（"紧急"、"重要"）不要放在标题里
4. 标签用 # 标记，如 #工作、#学习、#生活
5. 时间要转换为绝对时间（ISO 格式）
6. targetDate 是任务所属日期（通常是最晚完成日期）
7. 如果没有明确信息，不要猜测，返回 null

示例：
输入："明天下午3点前完成报告，工作相关，很紧急"
输出：{
  "taskTitle": "完成报告 #工作",
  "targetDate": "2025-11-09",
  "metadata": {
    "deadline": "2025-11-09T15:00:00",
    "priority": "high"
  }
}

输入："买菜"
输出：{
  "taskTitle": "买菜",
  "targetDate": "${new Date(currentDate).toISOString().split('T')[0]}",
  "metadata": {}
}`

  // 调用 LLM
  const { doubaoService } = await import('@/lib/doubaoService')
  const response = await doubaoService.sendMessage([
    { role: 'user', content: prompt }
  ])
  
  // 解析 JSON
  try {
    // 提取 JSON（可能被包裹在代码块中）
    let jsonText = response.trim()
    
    // 移除 Markdown 代码块标记
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    
    const parsed = JSON.parse(jsonText)
    
    // 验证结果
    if (!parsed.taskTitle || !parsed.targetDate) {
      throw new Error('解析结果缺少必需字段')
    }
    
    console.log('✅ NLP 解析成功:', parsed)
    return parsed
    
  } catch (error) {
    console.error('❌ NLP 解析失败:', error)
    // 降级方案：返回原始消息作为标题
    return {
      taskTitle: userMessage.substring(0, 50),
      targetDate: new Date(currentDate).toISOString().split('T')[0],
      metadata: {}
    }
  }
}
```

**预计时间**: 1 小时

---

### Step 9: 为 parseTaskIntent 编写测试 ⭐⭐
**文件**: `src/lib/agent/__tests__/parseTaskIntent.test.ts`

**测试用例**:
```typescript
describe('parseTaskIntent', () => {
  test('简单任务（无时间）', async () => {
    const result = await parseTaskIntent({
      userMessage: '买菜',
      currentDate: '2025-11-08T14:30:00'
    })
    expect(result.taskTitle).toBe('买菜')
    expect(result.targetDate).toBe('2025-11-08')
  })
  
  test('带时间的任务（明天）', async () => {
    const result = await parseTaskIntent({
      userMessage: '明天下午3点前完成报告',
      currentDate: '2025-11-08T14:30:00'
    })
    expect(result.taskTitle).toContain('完成报告')
    expect(result.targetDate).toBe('2025-11-09')
    expect(result.metadata.deadline).toBe('2025-11-09T15:00:00')
  })
  
  test('带标签和优先级', async () => {
    const result = await parseTaskIntent({
      userMessage: '完成报告，工作相关，很紧急',
      currentDate: '2025-11-08T14:30:00'
    })
    expect(result.taskTitle).toContain('#工作')
    expect(result.metadata.priority).toBe('high')
  })
  
  test('复杂时间表达（下周一）', async () => {
    const result = await parseTaskIntent({
      userMessage: '下周一上午10点提交申请',
      currentDate: '2025-11-08T14:30:00'  // 周五
    })
    expect(result.targetDate).toBe('2025-11-11')  // 下周一
  })
  
  test('LLM 返回格式错误时的降级处理', async () => {
    // 模拟 LLM 返回非 JSON
    // ...
  })
})
```

**预计时间**: 40 分钟

---

### Step 10: 集成 NLP 到 CreateTaskTool ⭐⭐
**修改文件**: `src/lib/agent/tools/CreateTaskTool.ts`

**修改参数**:
```typescript
parameters: {
  type: 'object',
  properties: {
    userId: { type: 'string', description: '用户 ID' },
    
    // 方式 1：直接提供任务标题（明确）
    taskTitle: { type: 'string', description: '任务标题（可以包含标签）' },
    targetDate: { type: 'string', description: '目标日期 YYYY-MM-DD，默认今天' },
    
    // 方式 2：提供自然语言描述（智能）⭐ 新增
    userMessage: { type: 'string', description: '用户的自然语言描述（如"明天下午3点前完成报告"）' },
    parseIntent: { type: 'boolean', description: '是否使用 NLP 解析 userMessage（默认 false）' }
  },
  required: ['userId']  // taskTitle 或 userMessage 二选一
}
```

**修改执行逻辑**:
```typescript
async execute(params) {
  console.log('➕ 创建任务:', params)
  
  let taskTitle: string
  let targetDate: string
  
  // 方式 1：使用 NLP 解析
  if (params.parseIntent && params.userMessage) {
    console.log('🧠 使用 NLP 解析用户消息...')
    
    const { parseTaskIntent } = await import('@/lib/agent/parseTaskIntent')
    const parsed = await parseTaskIntent({
      userMessage: params.userMessage,
      currentDate: new Date().toISOString()
    })
    
    taskTitle = parsed.taskTitle
    targetDate = parsed.targetDate
    
    console.log('✅ NLP 解析结果:', { taskTitle, targetDate })
  }
  // 方式 2：直接使用提供的参数
  else {
    if (!params.taskTitle) {
      return { type: 'error', message: '缺少任务标题或自然语言描述' }
    }
    taskTitle = params.taskTitle
    targetDate = params.targetDate || new Date().toISOString().split('T')[0]
  }
  
  // ... 继续原有逻辑
}
```

**预计时间**: 30 分钟

---

### Step 11: 创建智能任务查找 findTaskByKeyword ⭐⭐⭐
**文件**: `src/lib/agent/findTaskByKeyword.ts`

**功能**: 根据关键词查找任务

**函数签名**:
```typescript
export async function findTaskByKeyword(params: {
  userId: string,
  keyword: string,
  dateRange?: { start: string, end: string }  // 默认最近7天
}): Promise<Array<{
  noteDate: string,
  taskPosition: number,
  taskTitle: string,
  checked: boolean,
  similarity: number  // 匹配度（0-1）
}>>
```

**实现逻辑**:
```typescript
export async function findTaskByKeyword(params) {
  const { userId, keyword, dateRange } = params
  
  console.log('🔍 智能查找任务:', { keyword, dateRange })
  
  // 1. 确定日期范围
  let startDate: Date, endDate: Date
  if (dateRange) {
    startDate = new Date(dateRange.start)
    endDate = new Date(dateRange.end)
  } else {
    // 默认最近 7 天
    endDate = new Date()
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
  }
  
  // 2. 获取日期范围内的笔记
  const { getNotesByDateRange } = await import('@/lib/notes')
  const notes = await getNotesByDateRange(userId, startDate, endDate)
  
  console.log(`📚 找到 ${notes.length} 个笔记`)
  
  // 3. 解析每个笔记的任务
  const { findAllTasks } = await import('@/lib/noteTaskOperations')
  const allMatches: Array<{
    noteDate: string,
    taskPosition: number,
    taskTitle: string,
    checked: boolean,
    similarity: number
  }> = []
  
  for (const note of notes) {
    const tasks = findAllTasks(note.content)
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      
      // 4. 模糊匹配
      const similarity = calculateSimilarity(task.title, keyword)
      
      if (similarity > 0.3) {  // 阈值：30% 相似度
        allMatches.push({
          noteDate: note.note_date,
          taskPosition: i,
          taskTitle: task.title,
          checked: task.checked,
          similarity
        })
      }
    }
  }
  
  // 5. 按相似度排序
  allMatches.sort((a, b) => b.similarity - a.similarity)
  
  console.log(`✅ 找到 ${allMatches.length} 个匹配任务`)
  
  return allMatches
}

/**
 * 计算两个字符串的相似度（简单版本：基于包含关系）
 */
function calculateSimilarity(text: string, keyword: string): number {
  const textLower = text.toLowerCase()
  const keywordLower = keyword.toLowerCase()
  
  // 完全匹配
  if (textLower === keywordLower) return 1.0
  
  // 包含关键词
  if (textLower.includes(keywordLower)) {
    return 0.8
  }
  
  // 分词匹配（简单版本）
  const textWords = textLower.split(/\s+/)
  const keywordWords = keywordLower.split(/\s+/)
  
  let matchCount = 0
  for (const kw of keywordWords) {
    if (textWords.some(tw => tw.includes(kw) || kw.includes(tw))) {
      matchCount++
    }
  }
  
  return matchCount / keywordWords.length * 0.6
}
```

**预计时间**: 1 小时

---

### Step 12: 集成智能查找到 UpdateTaskTool 和 DeleteTaskTool ⭐⭐
**修改文件**: 
- `src/lib/agent/tools/UpdateTaskTool.ts`
- `src/lib/agent/tools/DeleteTaskTool.ts`

**修改参数** (两个工具都修改):
```typescript
parameters: {
  // 方式 1：明确指定（精确）
  noteDate: { type: 'string', description: '笔记日期 YYYY-MM-DD' },
  taskPosition: { type: 'number', description: '任务位置（第几个任务）' },
  
  // 方式 2：智能查找（模糊）⭐ 新增
  taskKeyword: { type: 'string', description: '任务关键词（用于智能查找）' },
  useSmartSearch: { type: 'boolean', description: '是否使用智能查找（默认 false）' }
}
```

**修改执行逻辑** (UpdateTaskTool 示例):
```typescript
async execute(params) {
  let noteDate: string
  let taskPosition: number
  
  // 方式 1：使用智能查找
  if (params.useSmartSearch && params.taskKeyword) {
    console.log('🧠 使用智能查找任务...')
    
    const { findTaskByKeyword } = await import('@/lib/agent/findTaskByKeyword')
    const matches = await findTaskByKeyword({
      userId: params.userId,
      keyword: params.taskKeyword,
      dateRange: undefined  // 默认最近7天
    })
    
    if (matches.length === 0) {
      return { type: 'error', message: `未找到包含"${params.taskKeyword}"的任务` }
    }
    
    if (matches.length > 1) {
      // 找到多个，列出让用户选择
      const list = matches.slice(0, 5).map((m, i) => 
        `${i + 1}. ${m.taskTitle} (${m.noteDate})`
      ).join('\n')
      
      return {
        type: 'error',
        message: `找到 ${matches.length} 个匹配任务，请明确指定：\n\n${list}`
      }
    }
    
    // 只找到一个，直接使用
    const match = matches[0]
    noteDate = match.noteDate
    taskPosition = match.taskPosition
    
    console.log(`✅ 智能查找成功: ${match.taskTitle}`)
  }
  // 方式 2：直接使用提供的参数
  else {
    if (!params.noteDate || params.taskPosition === undefined) {
      return { type: 'error', message: '缺少 noteDate/taskPosition 或 taskKeyword' }
    }
    noteDate = params.noteDate
    taskPosition = params.taskPosition
  }
  
  // ... 继续原有逻辑
}
```

**预计时间**: 50 分钟

---

## 阶段 4: 综合测试 - 1.5小时

### Step 13: 端到端测试（E2E）⭐⭐⭐
**目标**: 测试所有功能（基础 + NLP + 智能查找）

**测试场景 1: 基础创建**
```
输入："帮我创建一个任务：买菜"
预期：✅ 已创建任务：买菜
验证：笔记中出现"买菜"任务
```

**测试场景 2: NLP 智能创建**
```
输入："明天下午3点前完成报告，工作相关，很紧急"
预期：
  - Agent 调用 create_task 并使用 NLP 解析
  - 任务标题："完成报告 #工作"
  - 任务日期：明天
验证：笔记中出现任务，标题包含 #工作 标签
```

**测试场景 3: 明确更新**
```
输入："把今天的第一个任务标记为完成"
预期：✅ 任务已更新
验证：任务被勾选
```

**测试场景 4: 智能查找 + 更新**
```
输入："把'完成报告'这个任务标记为完成"
预期：
  - Agent 使用智能查找找到任务
  - 更新任务状态
验证：任务被勾选
```

**测试场景 5: 删除（含确认）**
```
输入："删除'买菜'这个任务"
预期：
  - Agent 显示确认提示
输入："确认"
预期：✅ 任务已删除
验证：任务消失
```

**测试场景 6: 复杂场景**
```
1. 创建 3 个任务（混合使用基础和 NLP）
2. 更新第 2 个任务（使用智能查找）
3. 删除第 1 个任务（确认流程）
4. 验证最终状态正确
```

**预计时间**: 1 小时

---

### Step 14: 更新文档和示例 ⭐⭐
**文件**: 
- `task-manager/README.md`
- `task-manager/AGENT_TOOLS_OVERVIEW.md`

**内容**:

#### 更新 README.md
```markdown
## 🤖 如何使用 AI Agent

### CRUD 操作（创建、更新、删除任务）⭐ NEW

#### 创建任务（基础）
\`\`\`
你：帮我创建一个任务：买菜
Agent：✅ 已创建任务：买菜
\`\`\`

#### 创建任务（智能 NLP）
\`\`\`
你：明天下午3点前完成报告，工作相关，很紧急
Agent：[NLP 解析] ✅ 已创建任务：完成报告 #工作
      日期：明天
      优先级：高
\`\`\`

#### 更新任务（明确位置）
\`\`\`
你：把今天的第一个任务标记为完成
Agent：✅ 任务已更新
\`\`\`

#### 更新任务（智能查找）
\`\`\`
你：把"完成报告"标记为完成
Agent：[智能查找] 找到任务：完成报告 #工作
      ✅ 任务已更新
\`\`\`

#### 删除任务（含确认）
\`\`\`
你：删除"买菜"这个任务
Agent：确定要删除任务吗？
      📋 任务：买菜
      ⬜ 状态：未完成
你：确认
Agent：✅ 任务已删除
\`\`\`
```

#### 更新 AGENT_TOOLS_OVERVIEW.md
```markdown
## ✅ 已实现（9个）

### 7. ➕ `create_task` - 创建任务 ⭐ NEW
**功能**：在笔记中创建新任务

**特点**：
- 支持基础模式（明确标题）
- 支持 NLP 模式（自然语言解析）
- 自动解析标签（#工作、#学习等）

**使用场景**：
- 基础："创建任务：买菜"
- 智能："明天下午3点前完成报告，工作相关，很紧急"

### 8. ✏️ `update_task` - 更新任务 ⭐ NEW
**功能**：修改笔记中的任务

**特点**：
- 支持明确位置（第几个任务）
- 支持智能查找（根据关键词）
- 可更新完成状态和标题

**使用场景**：
- 明确："把第一个任务标记为完成"
- 智能："把'完成报告'标记为完成"

### 9. 🗑️ `delete_task` - 删除任务 ⭐ NEW
**功能**：删除笔记中的任务

**特点**：
- 交互式确认机制（防止误删）
- 支持明确位置和智能查找
- 删除后自动清理空 taskList

**使用场景**：
- "删除第一个任务"
- "删除'买菜'这个任务"
```

**预计时间**: 30 分钟

---

### Step 15: 提交代码并创建完成报告 ⭐
**操作**:

1. **提交代码**:
```bash
git add -A
git commit -m "✨ Feat: 实现 P0 CRUD 工具（完整版）

- 新增 noteTaskOperations.ts（操作笔记中的任务节点）
- 新增 CreateTaskTool（支持 NLP 智能解析）
- 新增 UpdateTaskTool（支持智能查找）
- 新增 DeleteTaskTool（含确认机制）
- 新增 parseTaskIntent（NLP 解析）
- 新增 findTaskByKeyword（智能查找）
- 完整单元测试和 E2E 测试
- 更新文档和示例"

git push origin feature/phase5-p0-crud-tools
```

2. **创建完成报告**: `PHASE5_COMPLETION_REPORT.md`

**预计时间**: 20 分钟

---

## ⏱️ 总时间估算

| 阶段 | 步骤 | 预计时间 |
|------|------|----------|
| **阶段 1** | Step 1-2（基础设施） | 2.5 小时 |
| **阶段 2** | Step 3-7（基础工具 + 测试） | 2.5 小时 |
| **阶段 3** | Step 8-12（NLP 智能） | 3 小时 |
| **阶段 4** | Step 13-15（测试 + 文档） | 1.5 小时 |
| **总计** | | **约 9.5 小时** |

**建议分配**:
- Day 1: 阶段 1 + 阶段 2（5小时）
- Day 2: 阶段 3 + 阶段 4（4.5小时）

---

## 🎯 验收标准

### 功能完整性
- ✅ 3 个工具全部实现并注册
- ✅ 基础 CRUD 功能正常
- ✅ NLP 解析功能正常
- ✅ 智能查找功能正常

### 代码质量
- ✅ 所有函数有完整注释
- ✅ 单元测试覆盖率 > 80%
- ✅ 无 linter 错误
- ✅ 无 TypeScript 类型错误

### 用户体验
- ✅ 错误提示清晰
- ✅ 成功消息友好
- ✅ 删除操作有确认
- ✅ 智能查找找到多个时会提示用户

### 文档完整性
- ✅ README 更新
- ✅ AGENT_TOOLS_OVERVIEW 更新
- ✅ 代码注释完整
- ✅ 完成报告详细

---

## 🚀 准备开始

**检查清单**:
- [ ] 已理解系统架构（笔记 + taskItem 节点）
- [ ] 已查看现有函数（notes.ts, taskSync.ts）
- [ ] 已删除错误的 CreateTaskTool
- [ ] 已创建开发分支
- [ ] 开发环境正常

**准备好了吗？回复 "开始执行" 我们立即从 Step 1 开始！** 🚀



