下面我将你的所有最新要求全部整合，重新输出**一份完全中文、结构完整、可直接写进 CHI 论文 System Design 部分的“最终版原型方案”**。
方案已经充分考虑：

* **以当天文本框为核心**
* 但允许用户主动扩展到多天
* AI 主动引导反思
* 用户可随时补充想法、补充 context、或者提前结束
* 三轮反思全部执行（除明确不适用场景）
* 反思问题由 LLM 自动生成
* 系统逻辑围绕 RQ1–RQ3 收敛

这是你目前最完整、最成熟的一份设计方案。

---

# 🌟 **MindTrack（暂名）——基于 GenAI 的元认知反思任务规划原型设计（中文版）**

> **核心目标：**
> 通过结构化的 AI 反思提示（reflective prompts）提升 ADHD 大学生的元认知能力，使他们能够更清晰地定义任务、更现实地评估时间、更明确地设定优先级，从而改善任务规划质量。

---

# 1. 系统整体概述

MindTrack 是一款围绕“**当天任务规划**”的 web 原型。

用户在页面中央的 **“今天的任务（Today’s Tasks）”文本框**中自由输入当天要完成的事项；
系统允许用户输入跨日任务（如“周三交作业”），但整个反思交互流程**默认聚焦当日任务**。

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

### **Step 0：用户在“今天的任务”文本框自由输入计划**

* 不限制格式
* 用户可以写多条任务，也可以写多天任务
* 无 AI 干预 → 这是研究 RQ1 的 baseline

---

### **Step 1：用户表示“完成规划” → 自动触发反思流程**

可能的触发动作包括：

* 点击“完成规划”按钮
* 或者展开**右侧 AI 反思侧栏**（更自然）

系统会立即：

1. 冻结用户当前的任务列表（PlanSnapshot）
2. 记录时间
3. 将任务内容传给 LLM 做 global scan

这一步为后续 RQ2、RQ3 分析提供基线数据。

---

### **Step 2：Global Scan + “任务总览小结”（新增，非常关键）**

LLM 对 **当天任务内容**做一次全面分析（internal），分析维度包括：

* 模糊任务
* 未估时任务
* 过于庞大/笼统任务
* 当天任务负载（轻/中/重）
* 是否有跨天任务
* 是否出现 deadline 聚集
* 未指定优先级的任务
* 用户过往规划历史（如有）

系统不会一次性给大量建议，而是：

> **生成一段轻量、友好的“任务总览小结”（Summary Overview）**
> 帮助用户对自己的计划建立元认知视角。

示例：

> ### 👀 快速回顾你今天的计划
>
> * 有 2 个任务可能稍微笼统（例如：“准备明天课程”）
> * 有 3 个任务没有时间估计
> * 下午安排的任务有点密集
> * 明天截止的任务有 2 个
>
> 接下来我会带你做三轮轻量反思：
>
> 1. **任务是否描述得足够清晰？**
> 2. **这些任务的时间安排是否现实？**
> 3. **今天有哪些任务更值得优先处理？**
>
> 每轮最多 3 个问题，你可以随时跳过或结束反思。

---

# 3. 三轮元认知反思流程（默认执行）

你要求三轮都执行，除非明确不适用（例如当天只有一个任务 → 优先级轮可以跳过）。

以下是三轮的完整用户旅程：

---

## 🟦 **Round 1：任务澄清（Task Clarity Reflection）**

**默认执行。**

AI 会基于 Global Scan 生成 1–3 个反思性问题，可能针对：

* 整体计划
* 某一类任务
* 某一个具体任务

示例问题：

* 全局：

  > “回头看今天的任务，有没有哪一项做起来会不知道从何开始？”

* 针对某类任务：

  > “你的几个‘复习任务’都比较大，你愿不愿意挑一个具体化一下？”

* 针对单任务：

  > “如果把‘写报告’拆成第一步，你觉得那一步是什么？”

用户可以：

* 回答
* 跳过这一轮
* 点击“结束反思”
* 补充个人诉求（如“我今天其实只有 1 小时能用”）→ AI 自动纳入 context

---

## 🟩 **Round 2：时间估计（Time Estimation Reflection）**

**默认执行。**
但会根据当天任务情况自动调整反思方向。

如果没有任何任务设置时间 →
系统会询问“是否有必要对部分任务做预估时间”。

示例问题：

* 全局：

  > “你今天安排了 5 个任务，其中只有 1 个有预计时长。你觉得要不要给其中一项试着定个时间？”

* 任务级：

  > “‘写论文’预计 30 分钟，你觉得这个时长现实吗？你以前完成类似任务大概多久？”

用户可以：

* 回答
* 跳过
* 提出自己的 context（如“今天只有晚上有空”）

---

## 🟧 **Round 3：优先级排序（Priority Reflection）**

**默认执行**（除当天只有一个任务）。

示例问题：

* 全局：

  > “如果今天只能做两件，你最想先完成哪两件？为什么？”

* 针对 conflict：

  > “你有两个明天截止的任务却标成了低优先级，你怎么看？”

用户可以：

* 回答
* 跳过
* 结束反思
* 提出自己的优先级逻辑 → AI 将其整合入下一轮 reasoning

---

# 4. 反思流程结束：AI 输出“反思整体总结”

**不自动执行任何任务操作。**
仅输出总结，供用户自行修改任务。

示例：

> ### 🌟 小结一下刚才的反思
>
> * 你觉得“准备课程”还需要具体化
> * 你认为“写报告”至少需要 1–2 小时
> * 你想先完成明天截止的两个任务
>
> 如果你愿意，你可以回到任务栏自己调整。
> 我会继续陪你规划接下来的几天。

此输出可作为 RQ2 和 RQ3 的分析依据。

4. 反思流程结束后的建议性输出（Suggested Next Steps）

在三轮反思结束后，AI 会输出一个轻量、非强制、文字型的建议列表，目的是帮助用户对自己的反思进行进一步整合（metacognitive regulation），而不是直接帮他们改任务。

系统不会自动调用任何任务操作工具。
用户如果想修改，会回到任务栏自己操作，这是研究所需的关键行为数据。

🍀 建议性输出的结构
1. Mini Summary（AI 归纳用户的反思内容）

“你刚才提到：
-『准备课程』需要更细化
-『写报告』可能需要两个时间段来完成

今天你最优先想处理明天截止的两个任务
这些都体现了你对任务清晰度、时间现实性、优先程度的主动觉察 👍”

作用：
帮助用户看到自己的元认知表达 → 对应 RQ3（能力提升）

2. Optional Suggestions（非强制、供用户参考）

例如：

“你可以考虑把『准备课程』拆成一个 10 分钟的起始步骤，如果你愿意的话。”

“你提到写报告至少需要 2 小时，也许可以把它拆分为两段在下午/晚上进行。”

“你刚才说想优先完成明天截止的任务，也许可以把它们移动到列表最上方。”

特点：

全部是“你-可以-考虑（you might consider）”

全部基于用户自己说过的话（反思来源）

全部是人类容易理解且不突兀的“轻建议”

不包含任何自动执行命令

目的：
强化元认知调节意识（control/adjustment）

---

# 5. LLM / Agent 决策逻辑（完整）

以下为系统内部逻辑（精炼为可直接写进论文的风格）：

```
Input:
    TodayTasks
    UserProfile
    UserContext (self-stated constraints)
    PlanSnapshot
    PastReflectionHistory

Process:

1. GlobalScan:
    analyze tasks:
        - clarity level
        - estimated time presence
        - workload balance
        - cross-day mentions
        - conflicts / deadlines
        - priority presence
    output → scan_result (structured)

2. SummarizePlanOverview(scan_result):
    generate light-weight, friendly high-level summary

3. RunReflectionRounds():
    For round in [clarity, time, priority]:
        if round applicable:
            target_selection = choose_target(scan_result, TodayTasks)
                → global / group / single-task
            question_generation = LLM.generate(1–3 reflective questions)
            user_response = wait for user input
            integrate user_response into context
            allow skip or end-reflection
        else:
            skip round

4. FinalSummary:
    generate overall reflection summary

Output:
    Reflection questions
    User responses
    Session summary
```

---

# 6. 为什么整个流程围绕“当天任务文本框”设计？

符合你的三个研究问题：

### 对应 RQ1：

当天任务文本框 = 最自然的 baseline
不加干预即可观察 ADHD 的原生规划挑战。

### 对应 RQ2：

在当天任务基础上引导 3 轮反思 →
可以观察 AI scaffold 如何 reshape planning。

### 对应 RQ3：

连续多天实验 →
可以分析用户是否开始：

* 主动更清晰定义任务
* 主动补充 context
* 主动提早估计时间
* 主动表达优先级策略

这是元认知能力提升的关键指标。

---

# 7. 这份方案能解决你之前担忧的所有点：

✔ 不会无穷无尽地开发功能
→ 整个系统严格收敛在 RQ 所需的反思能力上

✔ 用户有自主权
→ 可以随时补充 context、跳过、结束反思

✔ AI 有主动性
→ 三轮反思自动触发

✔ 不会过度认知负担
→ 每轮最多 3 个问题、可以跳过

✔ 全部反思“基于当天任务”
→ 清晰、可控、可分析

✔ 数据结构干净
→ PlanSnapshot + 每轮用户回答 + AI summary → 可做对比分析

✔ LLM 逻辑统一
→ 易于工程实现