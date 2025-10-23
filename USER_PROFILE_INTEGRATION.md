# 用户个人信息集成 - 任务澄清功能

## 📋 功能说明

在任务澄清功能中集成用户个人信息，让AI能够根据用户的背景、挑战和习惯提供更个性化的任务理解和建议。

---

## 🎯 集成内容

### 用户背景信息包括：

1. **专业** (major)
   - 示例：计算机科学、心理学、生物学
   - 用途：理解任务的专业背景和难度

2. **年级** (grade)
   - 示例：本科（大一~大四）、硕士（硕一~硕三）、博士（博一~博五）
   - 用途：评估用户的能力水平和时间管理能力

3. **挑战标签** (challenges)
   - 示例：拖延、夜猫子、容易分心、完美主义
   - 用途：识别可能的障碍，提供针对性建议

4. **常用工作场所** (workplaces)
   - 示例：图书馆、咖啡厅、宿舍、实验室
   - 用途：考虑工作环境对任务执行的影响

---

## 🔧 技术实现

### 修改的文件

1. **`src/lib/doubaoService.ts`**
   - 修改 `clarifyTask` 函数签名，添加 `userProfile` 参数
   - 在系统 prompt 中动态插入用户背景信息
   - AI 会根据用户背景理解任务

2. **`src/hooks/useWorkflowAssistant.ts`**
   - 在调用 `clarifyTask` 时传入 `userProfile`

---

## 💡 AI Prompt 示例

### 无用户信息时：
```
你是一位专业的任务管理助手。用户刚刚回答了关于任务的澄清问题...

⏰ 当前时间参考：2025年10月23日 星期四 15:30

重要要求：
1. 仔细分析用户的回答...
```

### 有用户信息时：
```
你是一位专业的任务管理助手。用户刚刚回答了关于任务的澄清问题...

⏰ 当前时间参考：2025年10月23日 星期四 15:30

👤 用户背景：
专业：计算机科学
年级：硕二
挑战：拖延、容易分心
常用工作场所：图书馆、咖啡厅

💡 请结合用户背景理解任务，识别可能的挑战和合适的执行方式。

重要要求：
1. 仔细分析用户的回答...
```

---

## 🌟 实际效果示例

### 场景1：有拖延挑战的用户

**任务**：完成论文初稿

**用户回答**：
> 这篇论文需要写5000字，包括文献综述和实验设计。我打算下周前完成。

**AI理解（考虑用户背景）**：
```
📋 任务概要

完成5000字论文初稿

• 产出：包含文献综述和实验设计的论文初稿
• 时间：下周前完成
• 挑战：任务量较大，建议分段完成避免拖延
```

**分析**：
- AI 注意到用户有"拖延"标签
- 在"挑战"字段中主动提示"建议分段完成避免拖延"
- 更贴合用户的实际情况

---

### 场景2：夜猫子用户

**任务**：准备组会Presentation

**用户回答**：
> 需要做一个20分钟的展示，主要讲我最近的研究进展。明天下午要用。

**AI理解（考虑用户背景）**：
```
📋 任务概要

准备20分钟的研究进展展示

• 产出：组会Presentation
• 时间：明天下午前完成
• 挑战：时间紧迫，建议今晚集中准备
```

**分析**：
- AI 知道用户是"夜猫子"
- 建议"今晚集中准备"，符合用户的作息习惯
- 更实用的时间安排建议

---

### 场景3：容易分心的用户

**任务**：阅读10篇论文

**用户回答**：
> 需要阅读10篇关于深度学习的论文，做文献综述。这周内要完成。

**AI理解（考虑用户背景）**：
```
📋 任务概要

阅读10篇深度学习论文并做文献综述

• 产出：文献综述报告
• 时间：本周内完成
• 依赖：10篇论文资料
• 挑战：阅读量大，建议在图书馆等专注环境完成
```

**分析**：
- AI 注意到用户"容易分心"且常在"图书馆"工作
- 主动建议"在图书馆等专注环境完成"
- 结合用户的挑战和习惯给出建议

---

## 📊 对比效果

| 维度 | 无用户信息 | 有用户信息 |
|------|-----------|-----------|
| **个性化程度** | ⭐⭐ 通用建议 | ⭐⭐⭐⭐⭐ 针对性建议 |
| **挑战识别** | ❌ 无法预判 | ✅ 主动识别潜在障碍 |
| **时间建议** | ⭐⭐ 标准建议 | ⭐⭐⭐⭐ 符合用户习惯 |
| **环境建议** | ❌ 不提供 | ✅ 推荐合适工作场所 |
| **用户体验** | ⭐⭐⭐ 基础功能 | ⭐⭐⭐⭐⭐ 贴心助手 |

---

## 🚀 未来扩展方向

### 1. 问题生成个性化（未实现）
根据用户背景生成更针对性的澄清问题

### 2. 任务拆解个性化（未实现）
根据用户能力水平调整拆解粒度

### 3. 时间估算个性化（已实现）
根据用户历史数据调整时间估算

### 4. 优先级建议个性化（未实现）
根据用户的挑战和目标推荐优先级

---

## 📝 使用说明

### 前提条件
用户需要先在个人设置中填写个人信息：
- 专业
- 年级
- 挑战标签
- 常用工作场所

### 自动生效
一旦用户填写了个人信息，任务澄清功能会自动使用这些信息，无需额外配置。

### 隐私说明
- 用户个人信息仅用于提供个性化服务
- 不会与第三方分享
- 用户可随时修改或删除个人信息

---

## 🔍 技术细节

### 代码位置

**`src/lib/doubaoService.ts`** (第511-526行)
```typescript
// 构建用户背景信息
let userContextInfo = ''
if (userProfile) {
  const contextParts: string[] = []
  if (userProfile.major) contextParts.push(`专业：${userProfile.major}`)
  if (userProfile.grade) contextParts.push(`年级：${userProfile.grade}`)
  if (userProfile.challenges && userProfile.challenges.length > 0) {
    contextParts.push(`挑战：${userProfile.challenges.join('、')}`)
  }
  if (userProfile.workplaces && userProfile.workplaces.length > 0) {
    contextParts.push(`常用工作场所：${userProfile.workplaces.join('、')}`)
  }
  if (contextParts.length > 0) {
    userContextInfo = `\n\n👤 用户背景：\n${contextParts.join('\n')}\n\n💡 请结合用户背景理解任务，识别可能的挑战和合适的执行方式。`
  }
}
```

### 函数签名

**修改前**：
```typescript
async clarifyTask(
  taskTitle: string,
  taskDescription: string | undefined,
  questions: Array<{ dimension: string; question: string; purpose: string }>,
  userAnswer: string
)
```

**修改后**：
```typescript
async clarifyTask(
  taskTitle: string,
  taskDescription: string | undefined,
  questions: Array<{ dimension: string; question: string; purpose: string }>,
  userAnswer: string,
  userProfile?: { major?: string; grade?: string; challenges?: string[]; workplaces?: string[] } | null
)
```

---

## 版本信息
- 实现日期：2025-10-23
- 影响范围：任务澄清功能
- 破坏性变更：无（向后兼容）
- 依赖：用户个人资料表 (`user_profiles`)

