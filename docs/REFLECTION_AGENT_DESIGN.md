## 🌱 反思型 Agent 工具设计方案（元认知助理）

> 目标：通过生成式 AI 提出**高质量反思问题**，帮助用户觉察自己的任务状态、策略与动机，从而在**不显著增加认知负担**的前提下，提升任务管理质量。

---

## 1. 背景与核心定位

- 整个系统的核心：**生成式 AI 促进用户元认知 → 改善任务管理**。
- 当前已有能力：任务完善、任务拆解、时间估计、优先级调整等“操作型”工具。
- 新增工具角色：  
 不是替用户做决定，而是**引导用户思考**——像一个温和的教练，帮用户看清：
 1. 我现在在做什么（现状觉察）  
 2. 为什么要做（目标 / 动机）  
 3. 怎样做更合适（策略）  
 4. 做完后有什么经验（回顾与迁移）

> 简单说：这个 Agent 的产出主要是**问题**而不是**答案**：它更像一个“元认知教练”，而不是“替你做计划的秘书”。

---

## 2. 理论基础：元认知框架

这一工具不是“凭感觉瞎问问题”，而是显式地站在经典元认知理论上：

### 2.1 Flavell：元认知知识 & 元认知调节

- **Flavell (1979)** 将元认知拆成两部分：  
  - **Metacognitive Knowledge（元认知知识）**：\
    个体对“任务本身、策略、自己”这三类对象的认识。\
    - 对应到本项目：  
      - 对任务的认识：这个任务到底要做什么、难度如何、需要哪些资源；  
      - 对策略的认识：有哪些做法可选（一次做完 / 分段做、先预习 / 先练题…）；  
      - 对自我的认识：自己是早起型 / 夜猫子、容易在哪些地方拖延。
  - **Metacognitive Regulation（元认知调节）**：\
    围绕任务进行的 **计划（planning）- 监控（monitoring）- 调节（control）** 行为。

> 本工具提出的问题，核心目的就是：**激活和补全用户对“任务 / 策略 / 自我”的元认知知识，并推动其进行计划-监控-调节。**

例如：
- “完成后你希望看到怎样的结果？” → 补全对任务目标的认识（task knowledge）  
- “你更愿意一次做完还是拆成几段？” → 激活对策略和自身节奏的认识（strategy / person knowledge）  
- “如果本周不做，会有什么后果？” → 触发对任务重要性与时间敏感度的评估（regulation: planning & control）。

### 2.2 Nelson & Narens：meta-level ↔ object-level

- **Nelson & Narens (1990)** 提出经典的两层模型：  
  - **Object-level（客体层）**：正在进行的具体任务和行为（写作、学习、开会…）。  
  - **Meta-level（元层）**：对这些任务的抽象表征及其监控 / 控制过程。
- 二者通过两个方向的过程连接：  
  - **Monitoring（监控）**：meta-level 读取 object-level 的状态（进度、难度、情绪）。  
  - **Control（控制）**：meta-level 基于监控结果，对 object-level 发出调整指令（换策略、改时间、改优先级）。

> 在这个框架下，本工具的定位是：\
> **帮助用户在 meta-level 做更好的“监控 + 决策”，而不是直接改 object-level 上的任务。**

因此：
- 反思问题 = 对 meta-level 的轻量“ping”，促使用户**自己**完成监控和调节；  
- 具体的拆解 / 排期 / 调整优先级 = 仍然交给已有的“操作型工具”，并且**只有在用户明确愿意时**才触发。

### 2.3 为什么“反思问题”优先于“直接操作建议”？

1. **计划质量依赖于用户的隐性知识**  
   - 用户对自己节奏、偏好、真实约束条件最清楚，这些往往不会完整写在任务文本里。  
   - 直接替他们“算一个最优计划”，很容易基于错误假设优化“伪目标”。  
   - 通过元认知问题先挖出这些隐性知识，再去谈操作，会更稳健。

2. **反思是可迁移的，操作通常是一次性的**  
   - 一次好的反思问题，用户可以迁移到以后类似任务；  
   - 一次“帮你排好了优先级”，下次还得问 AI，从长期来看依赖性更强。

3. **减少决策疲劳，而不是增加**  
   - 反思问题控制在 1–3 个，帮助用户抓住“真正关键的那个维度”（例如目标是否清楚、时间是否现实），而不是让他们在一堆细节中选东选西。  
   - 相比之下，直接给出十几条操作建议，往往会让用户更难决定从哪里开始。

> 总结：**先帮用户看清，再提供可选的操作路径**，而不是直接替用户做完所有决策。

### 2.4 不是 CBT / Socratic therapy，而是任务导向的“metacognitive scaffolding”

我们刻意与“治疗性对话”划清边界：

- **区别 1：关注对象不同**  
  - CBT / 苏格拉底式问答：聚焦于 **认知歪曲、情绪和核心信念**；  
  - 本工具：只聚焦于 **任务、策略、时间安排和行为模式**，不介入深层心理议题。

- **区别 2：问题形态不同**  
  - 我们避免诸如“你为什么总是这样想？”、“这背后是不是有更深层的原因？”这类治疗向提问；  
  - 更偏向：“这次任务最可能卡住你的环节是哪一步？”、“在你目前的精力状态下，哪种做法更现实？”等**决策辅助型问题**。

- **区别 3：不会强迫、不会诊断**  
  - 用户可以完全不回答问题，问题本身就已经起到“提示 / 提醒”的作用；  
  - 系统不会对用户的回答做心理诊断或贴标签，只将其视为任务管理的上下文。

因此，可以把这个工具理解为：\
**在 Flavell 与 Nelson & Narens 的框架下，为任务管理场景搭建的“元认知脚手架（metacognitive scaffolding）”，而不是心理治疗工具。**

---

## 3. 设计原则

- **P1：低认知负担优先**  
  - 每次只问 **1–3 个关键问题**，避免长问卷式体验。  
  - 问题要“顺嘴好答”，尽量可用一句话回答。

- **P2：高度情境化**  
  - 问题必须基于：当前任务、笔记上下文、用户画像、时间压力等。  
  - 杜绝“模板式”空洞问题（例如：一味问“你有什么感受”）。

- **P3：可落地**  
  - 每个问题背后都有潜在的“下一步动作”（例如：拆解、调整时间、改优先级），但只有在用户同意时才调用具体工具。

- **P4：不重复、不打扰**  
    - 记住用户最近回答过的内容，避免高度重复。

- **P5：尊重用户自主性**  
  - 随时提供“**跳过本次反思**”选项。  
  - 把 AI 说的都当作建议，用户说了算。

---

## 4. 工具定位与接口草案

### 3.1 工具名称（暂定）

- `reflect_on_tasks`（反思任务工具）

### 3.2 输入信息（由宿主应用拼装）

- **用户信息（UserProfile 摘要）**
  - 身份 / 角色（学生 / 上班族 / 研究生…）
  - 典型作息（早型 / 夜猫子）
  - 每日可用时间、长期目标（如“期末考高分”、“提高英语”等）

- **任务上下文**
  - 触发类型：`'improve' | 'decompose' | 'estimate_time' | 'reprioritize' | 'review'`  
  - 目标任务列表：  
    - 标题、优先级、预计时长、截止时间、所属日期  
  - 所在笔记片段（截断后的 content / plain text）

- **情景信息**
  - 当前日期 & 时间（工作日 / 周末 / 深夜等）  
  - 本周任务负载（大概数量、紧急任务数）  
  - 已完成 vs 未完成统计（帮助判断是否“堆积”）

### 3.3 输出信息（给前端 / ChatSidebar）

- 一次调用返回 **一个反思会话建议对象**：

```text
{
  title: "关于「学习 30m」的小小反思",
  questions: [
    {
      id: "clarity",
      type: "clarity" | "strategy" | "motivation" | "scope" | "risk" | "time_fit",
      text: "如果把这个任务说给一个朋友听，他能立刻明白你具体要做什么吗？如果不能，你会怎么补一句？",
      hint: "可以简单说：我要完成哪一章 / 哪一类题目。",
      expectedAnswerStyle: "1-2 句自然语言"
    },
    ...
  ],
  followupOnAnswers: {
    // 可选：根据用户回答，后续可以选择调用哪些操作型工具
    possibleActions: ["decompose_task", "update_task_title", "time_estimation", "reprioritize_tasks"]
  }
}
```

> 注意：这个工具本身**不直接改任务**，只是给出“问题脚本”和“潜在操作建议”。

---

## 5. 触发时机设计

### 5.0 触发与问题生成的整体逻辑

从 Nelson & Narens 的视角，这个工具的工作流程可以简化为：

1. **收集 object-level 信息**  
   - 当前正在处理的任务 / 任务集；  
   - 相关笔记内容片段；  
   - 用户画像与时间情境（今天是工作日 / 周末、是否临近截止日期等）。

2. **在 meta-level 上建立“元认知状态向量”**（内部概念，不暴露给用户），例如：  
   - 目标清晰度（goal clarity）  
   - 范围界定程度（scope clarity）  
   - 策略可行性（strategy fit）  
   - 时间现实性（time realism）  
   - 风险感知度（risk awareness）  
   - 动机匹配度（motivation alignment）

3. **选择 1–2 个最关键 / 最不确定的维度**  
   - 比如：任务标题非常模糊 → 目标清晰度优先；  
   - 截止日期很近且预估时长偏大 → 时间现实性 & 风险感知优先。

4. **为每个维度由 LLM 生成 1–3 个问题**  
   - 不采用写死的问题列表，而是通过 Prompt 告诉 LLM：  
     - 当前需要关注的元认知维度（如 clarity / strategy / time_realism 等）；  
     - 用户上下文（任务标题、笔记片段、时间压力、用户画像摘要等）；  
     - 语言约束（简短、可一句话回答、不要治疗化提问等）。  
   - LLM 在这些约束下 **即时生成问题文本**，问题示例只作为 Prompt 中的 few-shot 参考，而不是硬编码问题池。

5. **只展示问题，不强制回答**  
   - UI 上以“轻量提醒卡片”的形式出现；  
   - 用户可以：略读后自己在脑子里想一想、在笔记里顺手改几笔、或者完全无视——**都算成功**，因为系统的目标是触发元认知，而不是收集答案。

> 也就是说：**“什么时候问什么问题”= 根据当前任务状态选择 1–2 个最值得激活的元认知维度，然后在 Prompt 里告诉 LLM 应该围绕这些维度、按我们的约束“现场出题”，而不是从固定问题列表里抽题。**

### 4.1 任务完善（improve）

- 触发示例：
  - 用户刚创建了一个非常粗糙的任务（例如“学习”、“写论文”）。  
  - 用户主动点击“需要一些反思问题”按钮。

- 典型问题类型：
  1. **目标澄清**：  
     - “完成这个任务后，你希望能看到一个怎样的‘结果’？一句话描述即可。”  
  2. **范围边界**：  
     - “这个任务是一次就能完成的，还是需要拆成几次的小步骤？”  
  3. **成功标准**：  
     - “你怎样知道它完成得还算满意？有没有一个简单标准？”

### 4.2 任务拆解（decompose）

- 触发示例：  
  - 用户使用“拆解任务”功能之前 / 之后。  

- 典型问题类型：
  1. **前置条件**：  
     - “在开始做之前，有没有什么前提条件需要先满足（比如资料、环境、工具）？”  
  2. **最小可行动步骤**：  
     - “如果只用 15 分钟做一点点，你会从哪里开始？”  
  3. **阻碍预判**：  
     - “过去做类似事情时，最容易卡住的地方通常是什么？”

### 4.3 时间估计（estimate_time）

- 触发示例：  
  - 用户设置或修改预估时长。  

- 典型问题类型：
  1. **参考经验**：  
     - “你之前完成类似任务，大概花了多久？这次有什么不同？”  
  2. **时间切块**：  
     - “你更希望一次性做完，还是拆成几段完成？每段多长更舒服？”  
  3. **现实匹配**：  
     - “结合你今天/这周的安排，这个时长放在什么时候最现实？”

### 4.4 优先级调整（reprioritize）

- 触发示例：  
  - 用户在矩阵或任务列表中频繁调整优先级。  

- 典型问题类型：
  1. **价值对齐**：  
     - “这个任务对你目前最重要的目标，有多直接的帮助？”  
  2. **时间敏感度**：  
     - “如果本周不做，它会带来什么后果？”  
  3. **机会成本**：  
     - “做它意味着你今天可能不能做什么？你是否接受这个取舍？”

### 4.5 任务回顾（review）

- 触发示例：  
  - 一天 / 一周结束时，用户查看已完成任务。  

- 典型问题类型：
  1. **成功经验提炼**：  
     - “今天完成的任务里，有哪一件是你觉得做得特别顺利的？为什么？”  
  2. **阻碍模式觉察**：  
     - “有没有一类任务，你总是会拖延？它们有什么共同点？”  
  3. **策略迁移**：  
     - “哪一个方法对你今天很有用，可以应用到以后类似的任务上？”

---

## 6. 元认知问题框架

可以把所有问题分为 4 层，对应经典元认知过程：

1. **计划 (Planning)**  
   - 在做之前：目标、策略、资源、时间安排。
2. **监控 (Monitoring)**  
   - 在进行中：进度感受、难度评估、专注状态。
3. **调节 (Control)**  
   - 根据监控结果调整：改计划、拆更小步、换时间段。
4. **反思 (Evaluation)**  
   - 做完之后：总结经验、迁移策略。

> 每次触发只挑 **1–2 层**，避免一次问太多维度。

---

## 7. 认知负担控制策略

1. **问题数量限制**  
   - 每次触发时，**最多 3 个元认知反思性问题**。  
   - 简单场景可以只问 1–2 个，但整体上控制在 3 个之内，让用户既能被温和“拉一拉视角”，又不会感觉像在填写问卷。

2. **语言风格**  
   - 口语化、贴近生活、避免专业术语。  
   - 多用选择式 / 半开放问题，例如：  
     - “更偏向 A 还是 B？”  
     - “用 1 句话说说就好。”

3. **上下文记忆**  
   - 记住用户最近 1–2 次反思的回答，在短时间内不再问同类问题。  
   - 对已经明确的信息（比如长期目标）只在关键节点简要引用，不反复追问。

4. **用户可控性**  
   - 问题区域提供：  
     - 「暂时不想思考这个」  
     - 「这个问题没有帮助」  
   - 用于后续调整提问策略（降低相似问题的出现概率）。

5. **渐进式体验**  
   - 新用户：先从**轻量问题**开始，例如“今天最想先搞定哪一件事？”  
   - 使用一段时间后，再逐步引入更深一点的元认知问题。

---

## 7.1 从使用情境再审视：典型使用路径

为了确保“以用户为中心”，这里从**具体使用情境和交互路径**出发，而不是贴标签定义用户类型。

### 7.1.1 典型使用路径（User Journey）

以“用户在笔记里写下一个模糊任务『学习』”为例：

1. 用户刚写完“学习 ⏳30m”  
2. 系统检测到：标题过于模糊 + 有时长但无具体目标 → 触发 `reflect_on_tasks`（improve + estimate_time 场景）  
3. 屏幕右侧轻量提示卡片出现（不抢焦点）：  
   - 标题：**“帮你想清楚一点点？”**  
   - 问题（举例）：  
     - “这 30 分钟结束时，你最希望具体完成什么？一句话说说就好。”  
   - 行为选项：`知道了`（直接收起） / `展开更多问题`（针对规划型用户）
4. 用户可能有 3 种行为：  
   - A. 完全不理：继续写笔记或开始计时 —— 系统不再追问，本次触发结束；  
   - B. 看了一眼，顺手把任务标题改成“学习数学第 3 章例题” —— 已完成一次有效的元认知调节；  
   - C. 点开“展开更多问题”，看到第二个问题，例如“如果发现 30 分钟不够，你打算怎么调整？”并在脑中快速想了一下，就算没有打字回答，也达成了“提前预演应对策略”的效果。

在整个流程中：  
- **没有任何一步要求“必须作答”**；  
- 问题的存在本身就起到“把 meta-level 的视角呈现给用户”的作用。

---

## 8. 与现有 Agent / 工具的协同

### 8.1 工具链关系

- `reflect_on_tasks` 本身**不直接修改数据**，而是：  
  - 产出问题 -> 用户回答 -> （可选）触发操作型工具：
    - `decompose_task`（任务拆解）  
    - `time_estimation`（时间估计）  
    - `update_task`（完善标题 / 备注）  
    - `reprioritize_tasks`（调整优先级）

### 8.2 典型链路示例

**例 1：从反思到拆解**

1. 反思问题：  
   - “如果只用 15 分钟做一点点，你会从哪里开始？”  
2. 用户回答：  
   - “先把论文目录列出来。”  
3. Agent 提示：  
   - “要不要我帮你把『论文目录』、『找3篇参考文献』这两步拆成子任务？”  
4. 用户确认后 → 调用 `decompose_task` 创建子任务。

**例 2：从反思到时间调整**

1. 反思问题：  
   - “结合你今天的状态，这个 2 小时的任务，你更想分成几段来做？”  
2. 用户回答：  
   - “分成两段，每段 1 小时。”  
3. Agent：  
   - “那我帮你把预估时长改成 2 × 1h，并建议分别安排在上午和下午，好吗？”

---

## 9. 实现步骤规划与难度评估

> 以下按"可独立交付、逐步增强"的原则拆分，每一步都可以单独上线验证效果。

---

### Step 1：创建 `ReflectOnTasksTool` 工具骨架

**目标**：让 Agent 能够调用这个工具，返回 LLM 生成的反思问题。

**涉及文件**：
- 新建：`src/lib/agent/tools/ReflectOnTasksTool.ts`
- 修改：`src/lib/agent/tools/index.ts`（注册工具）

**具体工作**：

1. **定义工具参数接口**（参考 `DecomposeTaskTool` 的模式）：
   ```typescript
   interface ReflectOnTasksParams {
     triggerType: 'improve' | 'decompose' | 'estimate_time' | 'reprioritize' | 'review'
     tasks: Array<{
       title: string
       priority?: string
       estimatedDuration?: number
       deadline?: string
       isCompleted?: boolean
     }>
     noteSnippet?: string      // 相关笔记片段（截断到 500 字）
     userProfileSummary?: string // 用户画像摘要（一句话）
     situationContext?: {
       currentDate: string
       isWeekend: boolean
       pendingTaskCount: number
       overdueTaskCount: number
     }
   }
   ```

2. **定义输出结构**：
   ```typescript
   interface ReflectionQuestion {
     id: string
     dimension: 'clarity' | 'strategy' | 'time_realism' | 'risk' | 'motivation' | 'scope'
     text: string
     hint?: string
   }
   
   // ToolResult.data 结构
   {
     title: string
     questions: ReflectionQuestion[]
     triggerType: string
   }
   ```

3. **实现 `execute` 方法**：
   - 构建 Prompt（调用 Step 2 设计的 Prompt 模板）
   - 调用 `doubaoService.chat()` 生成问题
   - 解析 LLM 输出，返回结构化的问题列表
   - 返回 `{ type: 'success', data: { title, questions, triggerType } }`

4. **在 `index.ts` 中注册**：
   ```typescript
   import { ReflectOnTasksTool } from './ReflectOnTasksTool'
   // ...
   new ReflectOnTasksTool(),
   ```

**难度**：⭐⭐ 中低  
- 主要是 Prompt 工程 + 参考现有工具（如 `DecomposeTaskTool`）的模式
- 不涉及数据库改动
- 不涉及 UI 改动

**预估时间**：2–3 小时

**依赖**：无，可以独立开始

---

### Step 2：设计 Prompt 模板

**目标**：让 LLM 能够根据不同触发场景生成高质量、情境化的反思问题。

**涉及文件**：
- 新建：`src/lib/reflectionPrompts.ts`（或直接写在 `ReflectOnTasksTool.ts` 内部）

**具体工作**：

1. **设计 System Prompt 结构**：
   ```
   你是一个任务管理元认知助手。你的职责是提出高质量的反思问题，
   帮助用户更清晰地思考他们的任务，而不是直接给出建议或替他们做决定。
   
   【理论框架】
   你基于 Flavell 的元认知理论工作：
   - 元认知知识：帮助用户认识任务本身、可用策略、自身特点
   - 元认知调节：支持用户进行计划、监控、调节
   
   【问题生成约束】
   - 每次生成 3 个问题
   - 问题必须简短、口语化、可一句话回答
   - 问题必须高度情境化，直接提及用户的任务标题和具体情况
   - 禁止空泛的"你有什么感受"类问题
   - 禁止治疗化提问（不问"为什么你总是..."）
   
   【当前触发场景】
   {triggerType} - {场景说明}
   
   【用户上下文】
   {任务信息、笔记片段、用户画像、时间情境}
   
   【输出格式】
   返回 JSON 数组，每个问题包含：
   - dimension: 元认知维度
   - text: 问题文本
   - hint: 可选的简短提示
   ```

2. **为每种 `triggerType` 设计场景说明和维度侧重**：

   | triggerType | 场景说明 | 优先维度 |
   |-------------|----------|----------|
   | `improve` | 用户刚创建或想完善一个任务 | clarity, scope, strategy |
   | `decompose` | 用户准备拆解任务 | strategy, risk, scope |
   | `estimate_time` | 用户在估计任务时长 | time_realism, strategy |
   | `reprioritize` | 用户在调整优先级 | motivation, risk, time_realism |
   | `review` | 用户在回顾已完成/未完成任务 | strategy, motivation |

3. **设计 few-shot 示例**（每种场景 2–3 个）：
   ```
   【示例 - improve 场景】
   任务：学习
   
   输出：
   [
     {
       "dimension": "clarity",
       "text": "「学习」结束后，你希望具体完成什么？比如看完哪一章、做完哪几道题？",
       "hint": "一句话说说就好"
     },
     {
       "dimension": "scope",
       "text": "这个「学习」是一次能搞定的，还是需要分几次？",
       "hint": null
     },
     {
       "dimension": "strategy",
       "text": "你打算从哪里开始？先看书还是先做题？",
       "hint": null
     }
   ]
   ```

4. **测试边界情况**：
   - 任务标题很短（如"学习"）
   - 任务标题很长（如"完成数据结构课程第三章所有习题并整理笔记"）
   - 有截止日期 vs 无截止日期
   - 有预估时长 vs 无预估时长
   - 单任务 vs 多任务

**难度**：⭐⭐⭐ 中等  
- 需要反复调试 Prompt，确保问题质量稳定
- 需要覆盖多种边界情况

**预估时间**：3–4 小时

**依赖**：可以和 Step 1 并行进行

---

### Step 3：在 AgentPrompt 中注册工具

**目标**：让 Agent 知道什么时候应该调用 `reflect_on_tasks`。

**涉及文件**：
- 修改：`src/lib/agent/AgentPrompt.ts`

**具体工作**：

1. **在工具列表中添加 `reflect_on_tasks` 的说明**：
   ```
   ### reflect_on_tasks
   - 功能：生成元认知反思问题，帮助用户更清晰地思考任务
   - 参数：
     - triggerType: 触发场景（improve/decompose/estimate_time/reprioritize/review）
     - tasks: 目标任务列表
     - noteSnippet: 相关笔记片段（可选）
     - userProfileSummary: 用户画像摘要（可选）
     - situationContext: 时间情境（可选）
   - 返回：1–3 个反思问题
   - 注意：这个工具只生成问题，不直接修改任务
   ```

2. **添加触发规则**（在"意图识别"部分）：
   ```
   【反思问题触发】
   当用户请求以下操作时，可以先调用 reflect_on_tasks 生成反思问题：
   - "帮我完善这个任务" → triggerType: 'improve'
   - "帮我拆解这个任务" → triggerType: 'decompose'
   - "这个任务要多久" → triggerType: 'estimate_time'
   - "帮我排优先级" → triggerType: 'reprioritize'
   - "今天做得怎么样" / "回顾一下" → triggerType: 'review'
   
   ⚠️ 注意：反思问题是可选的辅助，不是必须的前置步骤。
   如果用户明确说"直接帮我拆解"，则跳过反思，直接调用 decompose_task。
   ```

3. **添加示例对话**：
   ```
   【示例：用户请求完善任务】
   用户：帮我完善一下"学习"这个任务
   
   Thought: 用户想完善一个比较模糊的任务。我应该先调用 reflect_on_tasks 
           生成一些反思问题，帮助用户想清楚这个任务的具体目标。
   Action: reflect_on_tasks
   Action Input: {
     "triggerType": "improve",
     "tasks": [{"title": "学习"}]
   }
   
   Observation: {
     "title": "关于「学习」的小小反思",
     "questions": [
       {"dimension": "clarity", "text": "「学习」结束后，你希望具体完成什么？", "hint": "一句话说说就好"},
       {"dimension": "scope", "text": "这个「学习」是一次能搞定的，还是需要分几次？"},
       {"dimension": "strategy", "text": "你打算从哪里开始？先看书还是先做题？"}
     ]
   }
   
   Response: 在完善「学习」之前，我想帮你理一理思路：
   
   1. 「学习」结束后，你希望具体完成什么？（一句话说说就好）
   2. 这个「学习」是一次能搞定的，还是需要分几次？
   3. 你打算从哪里开始？先看书还是先做题？
   
   你可以直接回答，也可以自己想一想后在笔记里调整任务描述。
   ```

**难度**：⭐⭐ 中低  
- 参考现有工具的注册方式
- 主要是文案和示例设计

**预估时间**：1–2 小时

**依赖**：Step 1 完成后才能测试

---

### Step 4：前端展示反思问题卡片

**目标**：在 ChatSidebar 中以卡片形式展示 LLM 生成的反思问题。

**涉及文件**：
- 新建：`src/components/ReflectionCard.tsx`
- 修改：`src/components/ChatSidebar.tsx`（识别并渲染反思问题）

**具体工作**：

1. **设计 `ReflectionCard` 组件**：
   ```tsx
   interface ReflectionCardProps {
     title: string
     questions: Array<{
       id: string
       dimension: string
       text: string
       hint?: string
     }>
     onDismiss: () => void
   }
   ```

2. **UI 设计要点**：
   - 卡片样式：浅色背景、圆角、轻微阴影，不抢焦点
   - 标题：如"💭 帮你想清楚一点点"
   - 问题列表：
     - 每个问题一行，前面有序号
     - hint 以灰色小字显示在问题下方
   - 底部按钮：
     - "知道了"（关闭卡片）
     - 不需要回答输入框（问题本身就是目的）

3. **样式参考**（与 `TaskListCard` 风格一致）：
   ```css
   /* 卡片容器 */
   bg-gradient-to-br from-amber-50 to-orange-50
   border border-amber-200
   rounded-xl p-4
   
   /* 问题文本 */
   text-gray-700 text-sm
   
   /* hint */
   text-gray-400 text-xs mt-1
   ```

4. **在 `ChatSidebar` 中识别反思问题**：
   - 检测 Agent 响应中是否包含 `reflect_on_tasks` 的输出
   - 如果是，渲染 `ReflectionCard` 而不是普通文本

**难度**：⭐⭐ 中低  
- 参考现有的 `TaskListCard` 组件
- 主要是 UI 布局和样式

**预估时间**：2–3 小时

**依赖**：Step 1–3 完成后才能完整测试

---

### Step 5：端到端测试与调优

**目标**：完成 MVP 的端到端测试，确保整个流程顺畅。

**涉及文件**：
- 可能微调：`ReflectOnTasksTool.ts`、`AgentPrompt.ts`、`ReflectionCard.tsx`

**具体工作**：

1. **测试场景覆盖**：
   - 用户说"帮我完善学习这个任务" → 验证 improve 流程
   - 用户说"帮我拆解写论文" → 验证 decompose 流程
   - 用户说"这个任务要多久" → 验证 estimate_time 流程
   - 用户说"帮我排一下优先级" → 验证 reprioritize 流程
   - 用户说"今天做得怎么样" → 验证 review 流程

2. **问题质量检查**：
   - 问题是否足够情境化（提及了具体任务标题）
   - 问题是否简短、可一句话回答
   - 问题是否避免了空泛和治疗化

3. **UI 体验检查**：
   - 卡片是否轻量、不抢焦点
   - "知道了"按钮是否能正常关闭卡片
   - 多次触发时是否有重复问题

4. **边界情况测试**：
   - 任务标题为空或极短
   - 同时有多个任务需要反思
   - 网络错误或 LLM 返回异常

**难度**：⭐⭐ 中低  
- 主要是测试和微调
- 可能需要根据测试结果调整 Prompt

**预估时间**：2–3 小时

**依赖**：Step 1–4 全部完成

**🎉 完成此步骤后，MVP 可上线验证**

---

### Step 6：主动触发逻辑（可选增强）

**目标**：系统自动检测到任务模糊 / 时间不现实等情况时，主动弹出反思问题。

**涉及文件**：
- 新建：`src/lib/reflectionTrigger.ts`（检测逻辑）
- 修改：`src/app/notes-dashboard/page.tsx`（添加提示入口）
- 修改：`src/components/NoteEditor.tsx`（监听任务变化）

**具体工作**：

1. **设计检测规则**（在 `reflectionTrigger.ts` 中）：
   ```typescript
   interface TriggerCondition {
     type: 'improve' | 'decompose' | 'estimate_time' | 'reprioritize'
     reason: string
     task: Task
   }
   
   function detectReflectionTriggers(tasks: Task[]): TriggerCondition[] {
     const triggers: TriggerCondition[] = []
     
     for (const task of tasks) {
       // 模糊任务：标题 < 5 字且无描述
       if (task.title.length < 5 && !task.description) {
         triggers.push({ type: 'improve', reason: '任务描述比较模糊', task })
       }
       
       // 可能需要拆解：预估 > 2h 且无子任务
       if (task.estimatedDuration && task.estimatedDuration > 120 && !task.subtasks?.length) {
         triggers.push({ type: 'decompose', reason: '任务时间较长，可能需要拆解', task })
       }
       
       // 时间紧迫：截止 < 2 天且未开始
       if (task.deadline && !task.isCompleted) {
         const daysLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
         if (daysLeft < 2 && daysLeft > 0) {
           triggers.push({ type: 'estimate_time', reason: '截止日期临近', task })
         }
       }
     }
     
     return triggers
   }
   ```

2. **在笔记编辑器中添加提示入口**：
   - 当检测到触发条件时，在任务项旁边显示一个小图标（如 💭）
   - 用户点击图标后，打开 ChatSidebar 并自动发送反思请求

3. **频率控制**：
   - 同一任务 24 小时内最多触发一次
   - 用户关闭提示后，该任务本次会话不再提示

**难度**：⭐⭐⭐ 中等  
- 需要设计检测规则
- 需要在 UI 上添加提示入口
- 需要考虑不打扰用户的体验

**预估时间**：3–4 小时

**依赖**：MVP（Step 1–5）完成后

---

### Step 7：用户回答后的后续动作（可选增强）

**目标**：如果用户回答了反思问题，Agent 可以基于回答建议后续操作。

**涉及文件**：
- 修改：`src/components/ReflectionCard.tsx`（添加回答输入）
- 修改：`src/lib/agent/AgentPrompt.ts`（添加回答处理逻辑）

**具体工作**：

1. **在 `ReflectionCard` 中添加可选回答区域**：
   ```tsx
   // 用户可以选择回答，也可以直接关闭
   <div className="mt-3 border-t pt-3">
     <textarea
       placeholder="想说点什么？（可选）"
       className="w-full text-sm p-2 border rounded"
       value={answer}
       onChange={(e) => setAnswer(e.target.value)}
     />
     <div className="flex gap-2 mt-2">
       <button onClick={handleSubmitAnswer}>提交回答</button>
       <button onClick={onDismiss}>跳过</button>
     </div>
   </div>
   ```

2. **设计回答处理 Prompt**：
   ```
   用户对反思问题的回答：{answer}
   
   基于用户的回答，判断是否可以提供具体帮助：
   - 如果用户明确了任务目标 → 建议修改任务标题
   - 如果用户提到了具体步骤 → 建议拆解为子任务
   - 如果用户提到了时间安排 → 建议设置预估时长
   
   只有在用户回答中有明确信息时才建议操作，否则只表示理解。
   ```

3. **Agent 响应示例**：
   ```
   用户回答："我想先把第三章的例题做完"
   
   Agent：明白了！你想专注在第三章的例题。
   要不要我帮你把任务标题改成「完成数学第三章例题」？
   ```

**难度**：⭐⭐⭐ 中等  
- 需要设计回答 → 建议的 Prompt 逻辑
- 需要在 UI 上支持回答输入
- 需要处理用户不回答直接关闭的情况

**预估时间**：3–4 小时

**依赖**：MVP（Step 1–5）完成后

---

### 总体实现路径

```
Step 1 (工具骨架)
    ↓
Step 2 (Prompt 设计)  ←── 这两步可以并行
    ↓
Step 3 (Agent 注册)
    ↓
Step 4 (前端卡片)
    ↓
Step 5 (被动触发)
    ↓
[MVP 完成，可上线验证]
    ↓
Step 6 (主动触发) ←── 可选增强
    ↓
Step 7 (回答后动作) ←── 可选增强
```

---

### 难度汇总

| 步骤 | 内容 | 涉及文件 | 难度 | 预估时间 | 依赖 |
|------|------|----------|------|----------|------|
| Step 1 | 工具骨架 | `ReflectOnTasksTool.ts`, `index.ts` | ⭐⭐ | 2–3h | 无 |
| Step 2 | Prompt 设计 | `reflectionPrompts.ts` 或内嵌 | ⭐⭐⭐ | 3–4h | 可并行 |
| Step 3 | Agent 注册 | `AgentPrompt.ts` | ⭐⭐ | 1–2h | Step 1 |
| Step 4 | 前端卡片 | `ReflectionCard.tsx`, `ChatSidebar.tsx` | ⭐⭐ | 2–3h | Step 1–3 |
| Step 5 | 端到端测试 | 微调上述文件 | ⭐⭐ | 2–3h | Step 1–4 |
| Step 6 | 主动触发（可选） | `reflectionTrigger.ts`, `NoteEditor.tsx` | ⭐⭐⭐ | 3–4h | MVP |
| Step 7 | 回答后动作（可选） | `ReflectionCard.tsx`, `AgentPrompt.ts` | ⭐⭐⭐ | 3–4h | MVP |

---

### 时间估算

**MVP（Step 1–5）**：约 **11–15 小时**
- Step 1 + Step 2 可并行，实际约 3–4h
- Step 3：1–2h
- Step 4：2–3h
- Step 5：2–3h

**完整版本（Step 1–7）**：约 **17–23 小时**

---

### 推荐实施顺序

```
第 1 天（4–5h）
├── Step 1: 创建工具骨架 ──┐
└── Step 2: 设计 Prompt ───┴── 并行进行

第 2 天（3–5h）
├── Step 3: Agent 注册
└── Step 4: 前端卡片

第 3 天（2–3h）
└── Step 5: 端到端测试与调优

🎉 MVP 完成，可上线验证

后续迭代（可选）
├── Step 6: 主动触发
└── Step 7: 回答后动作
```

---

## 10. 总结

- 这个反思型 Agent 的核心价值是：  
  **通过少量高质量的问题，帮助用户“看清自己在做什么、为什么做、怎么做更好”**，  
  而不是增加额外的记账或填写负担。

- 技术上，它可以被实现为一个独立的 `reflect_on_tasks` 工具：  
  - 输入：用户画像 + 任务上下文 + 情景信息 + 触发类型  
  - 输出：1–3 个高度情境化的反思问题 + 可选的后续操作建议  
  - 行为：默认只“提问与陪伴思考”，在用户需要时才联动任务操作工具。

> 这一版先锁定整体思路和交互逻辑，后续如果你觉得方向合适，我们再一起细化 Prompt 细节和与现有 Agent 的具体集成方式。


