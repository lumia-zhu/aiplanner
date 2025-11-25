# 🌟 **MindTrack——基于 GenAI 的元认知反思任务规划原型设计**

> **核心目标：**
> 通过结构化的 AI 反思提示（reflective prompts）提升 ADHD 大学生的元认知能力，使他们能够更清晰地定义任务、更现实地评估时间、更明确地设定优先级，从而改善任务规划质量。

---

## 研究问题（Research Questions）

- **RQ1**: What metacognitive challenges do university students with ADHD encounter during academic task planning, and how are these challenges expressed in how they define tasks, estimate duration, and determine priorities?

- **RQ2**: How does a GenAI-powered metacognitive scaffold that prompts reflection during planning (e.g., when decomposing tasks, estimating task duration, or setting priorities) shape the task-planning processes of university students with ADHD?

- **RQ3**: How does ongoing interaction with this GenAI-driven metacognitive scaffold influence the quality and structure of students' task plans and the metacognitive abilities during planning?

---

# 1. 系统整体概述

MindTrack 是一款围绕"**当天任务规划**"的 web 原型。

用户在页面中央的 **"今天的任务（Today's Tasks）"文本框**中自由输入当天要完成的事项；
系统允许用户输入跨日任务（如"周三交作业"），**所有当天输入的任务都会纳入反思范围**（包括跨天任务）。

整个系统包含三个协同模块：

1. **任务输入区（用户自由规划）**
2. **AI 反思侧栏（LLM 驱动的元认知 scaffold）**
3. **任务操作工具（可选，由用户决定是否触发）**

其设计使我们能够：

* 提取 **RQ1：原始规划行为（未干预）**
* 观察 **RQ2：AI 提示如何 reshape 规划过程**
* 追踪 **RQ3：随时间推进元认知能力是否增强**

---

# 2. 完整工作流程（Workflow）

```
Step 0：用户输入任务（Today's Tasks）
    ↓
Step 1：用户展开 AI 侧栏 → 自动触发反思流程
    ↓
Step 2：Global Scan → 任务总览小结（视觉化、3-4行）
    ↓
Step 3：三轮反思（澄清 → 时间 → 优先级）
    ↓  （用户可随时修改任务、跳过、结束）
Step 4：反思总结 + 执行建议（一条消息）
    ↓
Step 5：用户可回到任务区自行调整
```

---

### **Step 0：用户在"今天的任务"文本框自由输入计划**

* 不限制格式
* 用户可以写多条任务，也可以写多天任务
* 无 AI 干预 → 这是研究 RQ1 的 baseline

---

### **Step 1：用户展开 AI 侧栏 → 自动触发反思流程**

**触发方式：展开右侧 AI 反思侧栏**（更自然，无需额外按钮）

系统会立即：

1. 冻结用户当前的任务列表（**PlanSnapshot**）
2. 记录时间戳
3. 将任务内容传给 LLM 做 Global Scan
4. **持久化反思会话状态**（用户关闭页面后可恢复）

这一步为后续 RQ2、RQ3 分析提供基线数据。

---

### **Step 2：Global Scan + "任务总览小结"**

LLM 对 **当天输入的所有任务**（包括跨天任务）做一次全面分析，分析维度包括：

* 模糊任务
* 未估时任务
* 过于庞大/笼统任务
* 当天任务负载（轻/中/重）
* 跨天任务情况
* deadline 聚集
* 未指定优先级的任务
* 用户过往规划历史（如有）

系统生成一段**轻量、视觉化的"任务总览小结"**（控制在 3-4 行）：

> 👀 **今天的计划一览**
> 📝 5 个任务 | ⏱️ 3 个未估时 | ⚡ 下午较密集
>
> 接下来我带你做三轮轻量反思，每轮最多 3 个问题～

---

# 3. 三轮元认知反思流程

三轮默认执行，但 AI 会在每轮开始前**快速预判是否有必要**：
- 如果某轮没有可反思的内容 → AI 说明并自动跳过
- 例如：所有任务都已有时间估计 → "你的时间安排看起来很清晰，我们跳过这轮"

**用户在反思过程中可以随时修改任务**，AI 会感知变化并调整后续问题。

---

## 🟦 **Round 1：任务澄清（Task Clarity Reflection）**

AI 基于 Global Scan 生成 1–3 个反思性问题，可能针对：

* 整体计划
* 某一类任务
* 某一个具体任务

**示例问题：**

* 全局：
  > "回头看今天的任务，有没有哪一项做起来会不知道从何开始？"

* 针对某类任务：
  > "你的几个'复习任务'都比较大，你愿不愿意挑一个具体化一下？"

* 针对单任务：
  > "如果把'写报告'拆成第一步，你觉得那一步是什么？"

**用户可以：**
* 回答问题
* 跳过这一轮
* 点击"结束反思"
* 补充个人诉求（如"我今天其实只有 1 小时能用"）→ AI 自动纳入 context
* **直接去修改任务** → AI 感知变化

---

## 🟩 **Round 2：时间估计（Time Estimation Reflection）**

根据当天任务情况自动调整反思方向。

**示例问题：**

* 全局：
  > "你今天安排了 5 个任务，其中只有 1 个有预计时长。你觉得要不要给其中一项试着定个时间？"

* 任务级：
  > "'写论文'预计 30 分钟，你觉得这个时长现实吗？你以前完成类似任务大概多久？"

**用户可以：**
* 回答
* 跳过
* 提出自己的 context（如"今天只有晚上有空"）
* **直接去修改任务**

---

## 🟧 **Round 3：优先级排序（Priority Reflection）**

默认执行（除当天只有一个任务）。

**示例问题：**

* 全局：
  > "如果今天只能做两件，你最想先完成哪两件？为什么？"

* 针对 conflict：
  > "你有两个明天截止的任务却标成了低优先级，你怎么看？"

**用户可以：**
* 回答
* 跳过
* 结束反思
* 提出自己的优先级逻辑 → AI 将其整合入 reasoning
* **直接去修改任务**

---

# 4. 反思结束：总结 + 执行建议（一条消息）

反思结束后，AI 输出**一条完整消息**，包含：

1. **Mini Summary**（归纳用户的反思内容）
2. **执行建议**（1-2 条，基于用户反思生成）

**不自动执行任何任务操作。** 用户可以回到任务区自行调整。

---

## 执行建议的类型（LLM 自动选择 1-2 条）

| 类型 | 说明 | 示例 |
|------|------|------|
| **起点建议** | 帮助突破"开始困难" | "你可以先做 5 分钟的'最小行动'，比如先打开文档、列三条要点。" |
| **时间段建议** | 找合适的执行窗口 | "你提到晚上更专注，也许可以把'读文献'安排在晚饭后 30 分钟。" |
| **分段执行策略** | 避免任务太大而拖延 | "把报告分成两段完成：下午 40 分钟 + 晚上 30 分钟。" |
| **预判障碍** | 提前意识到可能卡住的地方 | "你可能会在找资料上卡住，不如事先收藏好三篇相关论文。" |
| **专注策略** | 降低分心风险 | "做这类任务时，你可以用 20 分钟专注 + 5 分钟休息的节奏。" |
| **情绪调节策略** | 应对焦虑/回避情绪 | "如果觉得有点压力，可以先做最简单的部分，让自己慢慢进入状态。" |

---

## 完整示例输出

> ### 🌟 小结一下你的今天
>
> * 你觉得"准备课程"还可以更具体
> * "写报告"需要两个时间段
> * 今天你最想先完成明天截止的两件任务
>
> ### 💡 下一步执行的轻量建议
>
> * **从小步开始：** 你可以先花 5 分钟处理"准备课程"的第一步，比如先列一个提纲。
> * **合理安排时间：** 报告可以在下午做 40 分钟、晚上再做 30 分钟，会比一次做更轻松。
>
> 你可以回到任务列表里根据需要自行调整，也可以直接开始执行，我会在你需要的时候继续支持你 😊

**注意：** 即使用户提前结束反思，也会输出基于已有信息的总结和建议。

---

# 5. 数据持久化设计

## 5.1 PlanSnapshot（计划快照）

在用户展开侧栏时冻结，用于 RQ1 分析。

```typescript
interface PlanSnapshot {
  id: string
  userId: string
  createdAt: Date
  tasks: {
    id: string
    title: string
    priority?: string
    estimatedDuration?: number
    deadline?: Date
    isCompleted: boolean
  }[]
}
```

## 5.2 ReflectionSession（反思会话）

**需要持久化**，用户关闭页面后可恢复。

```typescript
interface ReflectionSession {
  id: string
  planSnapshotId: string
  userId: string
  createdAt: Date
  status: 'in_progress' | 'completed' | 'skipped'
  currentRound: 'clarity' | 'time' | 'priority' | 'summary'
  
  // Global Scan 结果
  scanResult: {
    vagueTaskCount: number
    unestimatedTaskCount: number
    workloadLevel: 'light' | 'medium' | 'heavy'
    crossDayTasks: string[]
    deadlineConflicts: string[]
  }
  
  // 三轮反思记录
  rounds: {
    clarity?: RoundRecord
    time?: RoundRecord
    priority?: RoundRecord
  }
  
  // 最终总结
  summary?: string
  executionSuggestions?: string[]
}

interface RoundRecord {
  status: 'completed' | 'skipped'
  questions: string[]
  userResponses: string[]
  startedAt: Date
  completedAt?: Date
}
```

## 5.3 ReflectionHistory（历史记录）

用于 RQ3 分析：用户元认知能力是否随时间提升。

```typescript
interface ReflectionHistory {
  userId: string
  sessions: ReflectionSession[]
  // 可分析的指标
  metrics: {
    avgClarityScore: number      // 任务清晰度趋势
    avgTimeEstimationAccuracy: number  // 时间估计准确度
    selfInitiatedReflections: number   // 用户主动发起的反思次数
  }
}
```

---

# 6. LLM / Agent 决策逻辑

```
Input:
    TodayTasks (all tasks entered today, including cross-day)
    UserProfile (from existing personal info module)
    UserContext (self-stated constraints during reflection)
    PlanSnapshot
    PastReflectionHistory

Process:

1. GlobalScan:
    analyze all tasks entered today:
        - clarity level
        - estimated time presence
        - workload balance
        - cross-day mentions
        - conflicts / deadlines
        - priority presence
    output → scan_result (structured)

2. SummarizePlanOverview(scan_result):
    generate visual, 3-4 line summary

3. RunReflectionRounds():
    For round in [clarity, time, priority]:
        # 预判是否有必要
        if round has_relevant_content(scan_result):
            target_selection = choose_target(scan_result, TodayTasks)
                → global / group / single-task
            question_generation = LLM.generate(1–3 reflective questions)
            user_response = wait for user input
            integrate user_response into context
            # 检测任务变化
            if tasks_modified:
                update scan_result
            allow skip or end-reflection
        else:
            notify user and skip round

4. FinalSummary + ExecutionSuggestions:
    generate mini summary based on user responses
    select 1-2 execution strategies
    output as single message

Output:
    - PlanSnapshot (frozen at start)
    - Reflection questions & user responses
    - Session summary with execution suggestions
    - All data persisted for RQ analysis
```

---

# 7. 设计决策总结

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 触发方式 | 展开侧栏自动触发 | 更自然，无需额外按钮 |
| 跨天任务 | 纳入反思范围 | 当天输入的都是用户关心的 |
| 反思中修改任务 | 允许 | 反思的目的就是促进调整 |
| 会话持久化 | 是 | 用户可能中途离开 |
| 执行建议位置 | 反思总结后（同一条消息） | 减少消息数量，降低认知负担 |
| 提前结束 | 仍输出总结和建议 | 用户不会觉得"什么都没得到" |
| UserProfile | 复用现有个人信息模块 | 避免重复开发 |
| 历史记录 | 新增数据库表 | RQ3 需要追踪元认知能力变化 |

---

# 8. 与研究问题的对应

### 对应 RQ1：
- **PlanSnapshot** = 最自然的 baseline
- 不加干预即可观察 ADHD 的原生规划挑战

### 对应 RQ2：
- 三轮反思 + 执行建议 → 观察 AI scaffold 如何 reshape planning
- 记录用户在反思过程中的任务修改行为

### 对应 RQ3：
- **ReflectionHistory** 追踪多日数据
- 分析用户是否开始：
  * 主动更清晰定义任务
  * 主动补充 context
  * 主动提早估计时间
  * 主动表达优先级策略
- 这些行为都反映了元认知能力的增长

---

# 9. 实现优先级

| 优先级 | 模块 | 说明 |
|--------|------|------|
| **P0** | PlanSnapshot 数据记录 | 研究数据收集核心 |
| **P0** | 反思会话状态管理（持久化） | 三轮结构的基础 |
| **P1** | Global Scan + 任务总览 | 反思流程的入口 |
| **P1** | 三轮反思流程改造 | 核心交互逻辑 |
| **P1** | 反思总结 + 执行建议 | 流程闭环 |
| **P2** | ReflectionHistory | RQ3 需要，但可以先手动分析 |
