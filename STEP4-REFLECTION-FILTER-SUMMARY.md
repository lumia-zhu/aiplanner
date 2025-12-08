# ✅ 第四步完成：反思功能过滤子任务

## 📊 改动摘要

### 核心改动：只针对顶层任务进行反思

反思功能（澄清/时间估计/优先级排序）现在只针对**顶层任务**（`depth = 0`），子任务会被自动排除。

---

## 🔧 修改位置

### 1. **启动反思会话 - 恢复未完成会话**
```typescript
// src/app/notes-dashboard/page.tsx - startReflectionSession

// 从笔记中解析任务
const currentTasks = currentNote ? parseTasksFromNote(currentNote) : []

// 🆕 只保留顶层任务（过滤子任务）
const topLevelTasks = currentTasks.filter(task => (task.depth ?? 0) === 0)
console.log(`📋 从笔记中提取到 ${currentTasks.length} 个任务，其中顶层任务 ${topLevelTasks.length} 个`)

const taskSnapshots = createTaskSnapshots(topLevelTasks)  // ✅ 只使用顶层任务
```

### 2. **启动反思会话 - 创建新会话**
```typescript
// 从当前笔记内容中提取任务
const currentTasks = currentNote ? parseTasksFromNote(currentNote) : []

// 🆕 只保留顶层任务（过滤子任务）
const topLevelTasks = currentTasks.filter(task => (task.depth ?? 0) === 0)
const subtaskCount = currentTasks.length - topLevelTasks.length

console.log(`📋 从笔记中提取到 ${currentTasks.length} 个任务（${topLevelTasks.length} 个顶层任务，${subtaskCount} 个子任务）`)

if (topLevelTasks.length === 0) {
  // 没有顶层任务，不启动反思
}

// 创建计划快照（只包含顶层任务）
const taskSnapshots = createTaskSnapshots(topLevelTasks)  // ✅ 只使用顶层任务
```

### 3. **反思模式下监听任务变化**
```typescript
// 监听笔记内容变化
useEffect(() => {
  if (!isReflectionMode || !currentNote) return
  
  const currentTasks = parseTasksFromNote(currentNote)
  
  // 🆕 只保留顶层任务（反思功能只针对父任务）
  const topLevelTasks = currentTasks.filter(task => (task.depth ?? 0) === 0)
  const taskSnapshots = createTaskSnapshots(topLevelTasks)  // ✅ 只使用顶层任务
  
  // 检查变化并更新
  if (hasChanged) {
    setReflectionTasks(taskSnapshots)  // ✅ 只包含顶层任务
  }
}, [currentNote, isReflectionMode])
```

---

## 📋 任务选择界面

### 自动适配

由于 `reflectionTasks` 状态中只包含顶层任务，任务选择卡片会自动：
- ✅ 只显示顶层任务
- ✅ 不显示子任务
- ✅ 用户只能选择父任务进行反思

### 组件逻辑
```typescript
// ChatSidebar.tsx - ReflectionTaskSelectionCard

<ReflectionTaskSelectionCard
  tasks={availableTasksForSelection}  // ← 这里传入的已经是过滤后的顶层任务
  roundType={roundType}
  onConfirm={onTaskSelectionConfirm}
  onBack={onTaskSelectionBack}
/>
```

---

## 🎯 预期效果

### 笔记内容：
```
- [ ] 原型开发              ← 顶层任务（会出现在反思中）
  - [ ] 需求分析与规划       ← 子任务（不会出现）
  - [ ] 设计原型界面         ← 子任务（不会出现）
  - [ ] 开发原型功能         ← 子任务（不会出现）
- [ ] QE准备                ← 顶层任务（会出现在反思中）
  - [ ] 设计原型界面         ← 子任务（不会出现）
- [ ] 看看TA批改作业的要求   ← 顶层任务（会出现在反思中）
```

### 反思任务选择界面显示：
```
📝 请选择要进行「澄清」的任务：

○ 原型开发
○ QE准备
○ 看看TA批改作业的要求

[确认选择] [返回]
```

**✅ 只显示 3 个顶层任务，子任务被自动排除**

---

## 🧪 测试方案

### 测试场景 1：启动反思（包含子任务）
1. 创建笔记：
   ```
   - [ ] 父任务1
     - [ ] 子任务1-1
     - [ ] 子任务1-2
   - [ ] 父任务2
   ```
2. 点击 AI 助手图标
3. 查看任务分析消息

**预期**：
- 消息显示"2 个顶层任务"
- 任务选择界面只显示"父任务1"和"父任务2"
- 子任务不出现

### 测试场景 2：澄清父任务
1. 选择"澄清任务" → 选择"父任务1"
2. 回答澄清问题
3. 完成澄清

**预期**：
- 澄清问题针对"父任务1"
- 子任务不受影响
- 子任务仍然存在于笔记中

### 测试场景 3：只有子任务的情况
1. 笔记只有子任务（通过复制粘贴，或者删除了父任务）：
   ```
     - [ ] 子任务1
     - [ ] 子任务2
   ```
2. 点击 AI 助手图标

**预期**：
- 提示"还没有任务"（因为没有顶层任务）

### 测试场景 4：混合任务列表
1. 创建复杂任务结构：
   ```
   - [ ] 任务A
   - [ ] 任务B
     - [ ] 子任务B1
     - [ ] 子任务B2
       - [ ] 孙任务B2a
   - [ ] 任务C
   ```
2. 启动反思

**预期**：
- 任务选择界面显示：任务A、任务B、任务C
- 不显示：子任务B1、子任务B2、孙任务B2a

---

## 🔍 查询验证

### 查看数据库中的任务结构
```sql
-- 查看所有任务及其父子关系
SELECT 
  t.id,
  t.title,
  t.depth,
  t.parent_task_id,
  parent.title as parent_title
FROM daily_tasks t
LEFT JOIN daily_tasks parent ON t.parent_task_id = parent.id
WHERE t.note_date = '2025-12-08'
ORDER BY t.note_position;
```

### 只查询顶层任务（反思功能使用的）
```sql
SELECT id, title, depth, parent_task_id
FROM daily_tasks
WHERE note_date = '2025-12-08' 
  AND depth = 0
ORDER BY note_position;
```

### 查询某个父任务的所有子任务
```sql
SELECT id, title, depth, parent_task_id
FROM daily_tasks
WHERE parent_task_id = '父任务ID'
ORDER BY note_position;
```

---

## 📝 日志输出

启动反思时会输出：
```
📋 从笔记中提取到 7 个任务（3 个顶层任务，4 个子任务）
🔍 执行 GlobalScan...
📊 扫描结果: 3 个任务（只针对顶层任务）
```

反思模式下任务变化时：
```
📝 反思模式：检测到任务变化，更新 reflectionTasks（7 个任务 → 3 个顶层任务）
```

---

## ✅ 完成标志

**第四步已完成！** 现在：
- ✅ 数据库支持父子关系
- ✅ TypeScript 类型已更新
- ✅ 同步逻辑自动建立父子关系
- ✅ 反思功能只针对顶层任务
- ✅ 任务选择界面只显示顶层任务

---

## 🎯 可选的第五步：UI 优化

如果需要，可以进一步优化：

1. **显示子任务数量提示**
   ```
   ○ 原型开发 (包含 3 个子任务)
   ○ QE准备 (包含 1 个子任务)
   ```

2. **任务树视图**
   - 在某些界面展开显示父子结构
   - 但在反思选择时仍然只能选父任务

3. **时间估算聚合**
   - 父任务的总时长 = 自身时长 + 所有子任务时长

这些优化不影响核心功能，可以后续根据需要添加。

---

**测试完成后告诉我结果！** 🚀

