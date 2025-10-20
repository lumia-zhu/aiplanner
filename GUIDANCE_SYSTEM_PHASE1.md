# 智能引导系统 Phase 1 文档

## 📋 改造概述

本次改造实现了智能引导系统的Phase 1（规则引导），为用户在关键操作节点提供基于上下文的智能建议，替换原有的机械化提示，显著提升用户体验。

---

## 🎯 改造目标

**改造前**：
- ❌ 机械化："已取消任务澄清，回到上一级选择。"
- ❌ 缺少引导：不告诉用户"接下来应该做什么"
- ❌ 缺少上下文：不考虑任务状态和计划完成度

**改造后**：
- ✅ 智能化：根据任务状态给出具体建议
- ✅ 有引导：提供2-3个可能的下一步
- ✅ 有上下文：分析任务缺失信息和紧急程度

---

## 📁 修改文件清单

### 1. `src/lib/guidanceService.ts` ⭐ 新文件
**功能**：智能引导服务（Phase 1：规则引导）

**核心类型**：
```typescript
export type GuidanceScenario = 
  | 'action-cancelled-clarify'    // 取消任务澄清
  | 'action-cancelled-decompose'  // 取消任务拆解
  | 'action-cancelled-estimate'   // 取消时间估算
  | 'action-completed-clarify'    // 完成任务澄清
  | 'action-completed-decompose'  // 完成任务拆解
  | 'action-completed-estimate'   // 完成时间估算
  | 'task-selected'               // 选择任务后
  | 'return-to-action-select'     // 返回到操作选择
```

**核心函数**：
- `analyzeTask(task)` - 分析任务状态，识别缺失信息
- `analyzeTodayTasks(tasks)` - 分析今日任务概况
- `generateRuleBasedGuidance(scenario, context)` - 生成规则引导消息
- `getGuidanceMessage(scenario, context)` - 主入口函数

**设计特点**：
- 🎯 **任务状态分析**：自动识别缺失字段（描述、截止时间、时间估算）
- 📊 **复杂度判断**：根据标签和子任务判断任务复杂度
- ⚠️ **紧急度识别**：判断任务是否临近截止时间
- 💡 **智能建议**：根据分析结果给出具体可行的建议

---

### 2. `src/hooks/useWorkflowAssistant.ts`
**修改内容**：在6个关键节点集成智能引导

**修改的函数**：
1. `cancelTaskContext` - 取消任务拆解
2. `cancelClarificationAnswer` - 取消任务澄清
3. `cancelEstimation` - 取消时间估算
4. `confirmClarification` - 完成任务澄清
5. `confirmEstimation` - 完成时间估算

**集成方式**：
```typescript
// 在操作完成/取消时，生成智能引导
const guidanceMessage = getGuidanceMessage(scenario, {
  currentTask: task,
  allTasks: tasks
})

streamAIMessage(guidanceMessage)
```

---

### 3. `src/app/dashboard/page.tsx`
**修改内容**：在子任务创建成功后添加智能引导

**修改位置**：
- 子任务创建成功的消息提示（第782-800行）

**集成方式**：
```typescript
const guidanceMessage = getGuidanceMessage('action-completed-decompose', {
  currentTask: updatedTask || decomposingTask,
  allTasks: tasks
})

setChatMessages([...prev, {
  role: 'assistant',
  content: [{ type: 'text', text: `✅ 成功...${guidanceMessage}` }]
}])
```

---

## 🎨 引导消息示例

### 场景1：取消任务澄清

**任务状态**：「和导师Meeting」缺少截止时间、时间估算

**改造前**：
> ❌ 已取消任务澄清，回到上一级选择。

**改造后**：
> ✅ 没关系！「和导师Meeting」还缺少截止时间、时间估算。你可以：
> • 先拆解这个任务看看包含哪些步骤
> • 或者估算一下大概需要多久
> • 也可以选择其他任务

---

### 场景2：取消任务拆解

**任务状态**：「项目汇报PPT」缺少时间估算

**改造前**：
> ❌ 已取消任务拆解，回到上一级选择。

**改造后**：
> ✅ 没关系！「项目汇报PPT」可以先估算一下时间，这样更好规划。
> 也可以选择其他任务或操作。

---

### 场景3：完成任务澄清

**任务状态**：「准备年度总结」标记为复杂，无子任务

**改造前**：
> ❌ 太好了！我已经理解了你的任务。你可以继续对这个任务进行拆解，或者选择其他操作。

**改造后**：
> ✅ 很好！「准备年度总结」的信息更完整了。
> 
> 💡 建议：这个任务看起来比较复杂，可以拆解成小步骤更好执行。

---

### 场景4：完成任务拆解

**任务状态**：「准备项目汇报」拆分为3个子任务，缺少时间估算

**改造前**：
> ❌ 太好了！任务拆解完成。

**改造后**：
> ✅ 很好！「准备项目汇报」已经拆分为3个子任务了。
> 
> 💡 建议：给每个子任务估算时间，整体规划会更清晰。
> 
> 你还有4个任务待处理，要继续完善吗？

---

### 场景5：完成时间估算

**任务状态**：「数据分析报告」标记为复杂，无子任务，无截止时间

**改造前**：
> ❌ ✅ 已记录！任务「数据分析报告」的预估时长为：120分钟

**改造后**：
> ✅ ✅ 已记录！任务「数据分析报告」的预估时长为：120分钟
> 
> 很好！「数据分析报告」的时间规划更清晰了。
> 
> 💡 建议：这个任务比较复杂，拆解成小步骤会更好执行。
> 
> 📅 建议：设置一个截止时间，避免拖延。

---

### 场景6：取消时间估算

**任务状态**：「买菜」简单任务

**改造前**：
> ❌ 好的，已取消。请重新选择操作：

**改造后**：
> ✅ 没关系！「买菜」可以之后再估算时间。
> 你可以先拆解任务或选择其他操作。

---

## 🧠 智能分析逻辑

### 任务状态分析
```typescript
function analyzeTask(task: Task): TaskAnalysis {
  // 1. 识别缺失字段
  const missingFields = []
  if (!task.description) missingFields.push('详细描述')
  if (!task.deadline_datetime) missingFields.push('截止时间')
  if (!task.estimated_duration) missingFields.push('时间估算')
  
  // 2. 判断复杂度
  let complexity = 'medium'
  if (task.tags?.includes('easy')) complexity = 'simple'
  if (task.tags?.includes('difficult') || hasSubtasks) complexity = 'complex'
  
  // 3. 判断紧急度
  const hoursUntilDeadline = /* 计算剩余时间 */
  const isUrgent = hoursUntilDeadline < 24
  
  return { missingFields, complexity, isUrgent, hasSubtasks }
}
```

### 引导策略

**取消操作时**：
1. 优先提示缺失信息
2. 建议下一步可能的操作（2-3个选项）
3. 保持友好的语气（"没关系！"）

**完成操作时**：
1. 肯定用户的进度
2. 根据任务状态给出建议：
   - 复杂任务 → 建议拆解
   - 缺少时间估算 → 建议估时
   - 缺少截止时间 → 建议设置
   - 紧急任务 → 提醒尽快开始
3. 提示其他待处理任务数量

---

## 📊 Phase对比

| 维度 | Phase 1（当前） | Phase 2（计划） | Phase 3（未来） |
|------|----------------|----------------|----------------|
| **实现方式** | 规则引导 | 规则+任务分析 | 规则+AI混合 |
| **响应速度** | 即时 | 即时 | 1-2秒（AI） |
| **个性化** | ⭐ 低 | ⭐⭐ 中 | ⭐⭐⭐ 高 |
| **维护成本** | 中（规则增多） | 中 | 低（prompt调优） |
| **用户体验** | ⭐⭐ 良好 | ⭐⭐⭐ 很好 | ⭐⭐⭐ 优秀 |

---

## 🧪 测试场景

### 测试1：取消任务澄清
**步骤**：
1. 选择一个缺少多个属性的任务
2. 点击"任务澄清"
3. 看到AI问题后，点击"取消"

**预期结果**：
- ✅ 显示缺失的具体字段
- ✅ 给出2-3个建议操作
- ✅ 语气友好

---

### 测试2：完成任务拆解
**步骤**：
1. 选择一个标记为"困难"的任务
2. 完成拆解，创建3个子任务
3. 观察AI消息

**预期结果**：
- ✅ 肯定用户进度（"很好！...已经拆分为3个子任务了"）
- ✅ 根据任务状态给出建议（如：估算时间）
- ✅ 提示其他待处理任务数量

---

### 测试3：多种任务状态
**准备**：
- 任务A：完整信息（描述、时间、估时都有）
- 任务B：仅标题
- 任务C：复杂任务，无子任务

**测试**：对每个任务执行取消/完成操作

**预期结果**：
- ✅ 任务A：提示"信息已比较完整"
- ✅ 任务B：提示"缺少描述、截止时间、时间估算"
- ✅ 任务C：建议"拆解成小步骤"

---

## ✅ 验收标准

- [x] 8个引导场景全部实现
- [x] 智能分析任务状态（缺失信息、复杂度、紧急度）
- [x] 6个关键节点集成引导
- [x] 无linter错误
- [x] 保持向后兼容
- [x] 消息语气友好、具体、可操作

---

## 🚀 后续优化方向（Phase 2+）

### Phase 2：规则+任务分析
1. ✅ 添加用户画像（完成数、习惯时间）
2. ✅ 分析历史操作模式
3. ✅ 更丰富的建议选项

### Phase 3：AI驱动
1. ✅ 复杂场景用AI生成个性化建议
2. ✅ 简单场景保留规则（快速响应）
3. ✅ 混合策略（平衡体验和性能）

---

## 📝 注意事项

1. **工作流结束不做引导**：按用户要求，"workflow-end"场景不实现
2. **响应速度**：规则引导即时响应，无需等待
3. **可扩展性**：`getGuidanceMessage`是主入口，Phase 2/3可以在此基础上扩展
4. **降级方案**：当前就是降级方案（规则），非常稳定

---

**改造完成日期**：2025-10-17
**改造负责人**：AI Assistant
**当前阶段**：Phase 1（规则引导）✅
**下一阶段**：Phase 2（规则+分析）📅






