# ✅ 第三步完成：同步逻辑改造

## 📊 改动摘要

### 核心改动：`syncTasksFromNote` 函数

在任务同步时，现在会：
1. **识别任务层级**：从 `parsedTask.depth` 获取层级信息
2. **建立父子关系**：维护一个"父任务栈"，自动找到每个子任务的父任务ID
3. **同步父子关系**：创建/更新任务时，设置 `parentTaskId` 和 `depth` 字段

---

## 🔧 核心算法：父任务栈

```typescript
// 父任务栈结构
const parentTaskStack: Array<{
  depth: number;    // 任务层级
  taskId: string;   // 任务ID
  position: number; // 在笔记中的位置
}> = []
```

### 工作原理

遍历任务时（按 position 顺序）：

1. **查找父任务**：
   ```typescript
   if (taskDepth > 0) {
     // 从栈中找到 depth = taskDepth - 1 的最近任务
     for (let i = stack.length - 1; i >= 0; i--) {
       if (stack[i].depth === taskDepth - 1) {
         parentTaskId = stack[i].taskId
         break
       }
     }
   }
   ```

2. **创建/更新任务**：
   ```typescript
   await createDailyTask(userId, {
     // ...其他字段
     parentTaskId: parentTaskId,  // 🆕 父任务ID
     depth: taskDepth,             // 🆕 任务层级
   })
   ```

3. **更新父任务栈**：
   ```typescript
   // 移除 >= 当前层级的任务
   while (stack.length > 0 && stack[stack.length - 1].depth >= taskDepth) {
     stack.pop()
   }
   // 将当前任务推入栈
   stack.push({ depth: taskDepth, taskId, position })
   ```

---

## 📋 示例场景

### 笔记结构：
```
- [ ] 原型开发 (position=0, depth=0)
  - [ ] 需求分析与规划 (position=1, depth=1)
  - [ ] 设计原型界面 (position=2, depth=1)
    - [ ] 设计登录页 (position=3, depth=2)
    - [ ] 设计主页面 (position=4, depth=2)
  - [ ] 开发原型功能 (position=5, depth=1)
- [ ] QE准备 (position=6, depth=0)
```

### 同步过程：

| Position | 任务标题 | Depth | 父任务栈（处理前） | 找到父任务 | 父任务栈（处理后） |
|----------|---------|-------|------------------|-----------|------------------|
| 0 | 原型开发 | 0 | `[]` | 无（顶层） | `[{d:0, id:A, p:0}]` |
| 1 | 需求分析 | 1 | `[{d:0, id:A}]` | A（depth=0） | `[{d:0, id:A}, {d:1, id:B, p:1}]` |
| 2 | 设计原型 | 1 | `[{d:0, id:A}, {d:1, id:B}]` | A（depth=0） | `[{d:0, id:A}, {d:1, id:C, p:2}]` |
| 3 | 设计登录 | 2 | `[{d:0, id:A}, {d:1, id:C}]` | C（depth=1） | `[{d:0, id:A}, {d:1, id:C}, {d:2, id:D, p:3}]` |
| 4 | 设计主页 | 2 | `[{d:0, id:A}, {d:1, id:C}, {d:2, id:D}]` | C（depth=1） | `[{d:0, id:A}, {d:1, id:C}, {d:2, id:E, p:4}]` |
| 5 | 开发功能 | 1 | `[{d:0, id:A}, {d:1, id:C}, {d:2, id:E}]` | A（depth=0） | `[{d:0, id:A}, {d:1, id:F, p:5}]` |
| 6 | QE准备 | 0 | `[{d:0, id:A}, {d:1, id:F}]` | 无（顶层） | `[{d:0, id:G, p:6}]` |

### 最终数据库结构：

| ID | 标题 | depth | parent_task_id |
|----|------|-------|---------------|
| A | 原型开发 | 0 | NULL |
| B | 需求分析 | 1 | A |
| C | 设计原型 | 1 | A |
| D | 设计登录 | 2 | C |
| E | 设计主页 | 2 | C |
| F | 开发功能 | 1 | A |
| G | QE准备 | 0 | NULL |

---

## ✅ 拆解任务兼容性

### 检查结果：拆解任务**无需改造**！

拆解任务的插入逻辑（`handleDecompositionConfirm`）：
```typescript
// 创建嵌套的 taskList
const nestedTaskList = {
  type: 'taskList',
  content: subtaskItems  // 子任务列表
}

// 插入到父任务的 content 中
taskItem.content.push(nestedTaskList)
```

**结果结构**：
```json
{
  "type": "taskItem",  // 父任务
  "content": [
    { "type": "paragraph", ... },  // 父任务标题
    {
      "type": "taskList",  // 嵌套的子任务列表
      "content": [
        { "type": "taskItem", ... },  // 子任务1
        { "type": "taskItem", ... }   // 子任务2
      ]
    }
  ]
}
```

这个结构会被 `parseTasksFromNote` 自动识别：
- 父任务：`depth = 0`
- 子任务：`depth = 1`（因为在嵌套的 taskList 中）

✅ **完美兼容，无需修改！**

---

## 🧪 测试建议

### 测试场景 1：手动创建子任务
1. 在笔记编辑器中创建一个任务
2. 按 Tab 键缩进，创建子任务
3. 保存笔记
4. 检查数据库：子任务的 `parent_task_id` 应指向父任务

### 测试场景 2：拆解任务
1. 选择一个任务进行拆解
2. 确认拆解建议
3. 子任务自动插入到笔记中
4. 检查数据库：子任务应正确关联父任务

### 测试场景 3：多层嵌套
1. 创建父任务
2. 创建子任务（Tab 一次）
3. 创建孙任务（Tab 两次）
4. 保存并检查数据库层级关系

### 测试场景 4：任务重新排列
1. 将子任务拖出父任务（变为顶层）
2. 将顶层任务拖入另一个任务（变为子任务）
3. 检查 `parent_task_id` 和 `depth` 是否正确更新

---

## 📊 日志输出

同步时会输出详细日志：
```
🔄 开始同步任务: noteDate=2025-12-08
📋 解析到 7 个任务（包含子任务）
📊 数据库中有 0 个任务
🔗 任务 "需求分析" (depth=1) 的父任务是 position=0
✅ 创建任务: 需求分析 (depth=1, parent=有)
🔗 任务 "设计原型" (depth=1) 的父任务是 position=0
✅ 创建任务: 设计原型 (depth=1, parent=有)
...
✅ 任务同步完成: 创建 7, 更新 0, 删除 0
📊 任务结构: 2 个顶层任务, 5 个子任务
```

---

## 🎯 下一步：第四步 - 反思功能过滤子任务

现在数据库、类型、同步逻辑都已支持父子关系。

下一步需要修改反思功能（澄清/时间估计/优先级排序），让它只针对**顶层任务**（`depth = 0`）。

准备好后告诉我，我们开始第四步！🚀

