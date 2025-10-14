# AI 工作流实现文档

## 📋 概述

本文档描述了基于 **Solution E (Progressive Enhancement)** 的 AI 工作流系统实现,该系统为任务管理应用提供智能化的计划完善功能。

---

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard UI                          │
│  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │  "AI帮忙完善计划"  │  │      ChatSidebar               │ │
│  │      按钮          │  │  - 工作流进度显示              │ │
│  │                    │  │  - AI 建议芯片                 │ │
│  └─────────┬──────────┘  └────────────┬───────────────────┘ │
└────────────┼──────────────────────────┼─────────────────────┘
             │                          │
             v                          v
      ┌─────────────────────────────────────────┐
      │         useAIWorkflow Hook              │
      │  - 状态管理                             │
      │  - 进度追踪                             │
      │  - 建议管理                             │
      └─────────────┬───────────────────────────┘
                    │
                    v
      ┌─────────────────────────────────────────┐
      │      WorkflowOrchestrator               │
      │  - 工作流编排                           │
      │  - 步骤执行                             │
      │  - 阶段转换                             │
      └─────────────┬───────────────────────────┘
                    │
        ┌───────────┼───────────┐
        v           v           v
   ┌────────┐  ┌────────┐  ┌────────┐
   │  AI    │  │ Tool   │  │Context │
   │Service │  │Registry│  │Manager │
   └────────┘  └────────┘  └────────┘
        │           │
        v           v
   ┌────────┐  ┌────────────────┐
   │Doubao  │  │  5 AI Tools    │
   │Adapter │  │- 任务拆解      │
   └────────┘  │- 时间估算      │
               │- 优先级排序    │
               │- 任务澄清      │
               │- 检查清单      │
               └────────────────┘
```

---

## 📂 文件结构

### 新增文件

```
task-manager/
├── src/
│   ├── types/
│   │   └── workflow/
│   │       ├── index.ts           # 工作流核心类型
│   │       ├── tool.ts            # 工具相关类型
│   │       └── adapter.ts         # 适配器类型(未使用)
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── adapter.ts         # AI 模型适配器基类
│   │   │   ├── doubao.ts          # 豆包适配器
│   │   │   ├── service.ts         # AI 服务统一入口
│   │   │   └── index.ts           # 导出
│   │   │
│   │   ├── prompts/
│   │   │   ├── index.ts           # Prompt 管理器
│   │   │   └── analyze.ts         # 任务分析 Prompts
│   │   │
│   │   ├── tools/
│   │   │   ├── base.ts            # 工具基类
│   │   │   ├── registry.ts        # 工具注册中心
│   │   │   ├── decompose.ts       # 任务拆解工具
│   │   │   ├── estimate.ts        # 时间估算工具
│   │   │   ├── prioritize.ts      # 优先级排序工具
│   │   │   ├── clarify.ts         # 任务澄清工具
│   │   │   ├── checklist.ts       # 检查清单工具
│   │   │   └── index.ts           # 导出
│   │   │
│   │   └── workflow/
│   │       ├── context.ts         # 上下文管理器
│   │       ├── steps.ts           # 步骤定义
│   │       ├── orchestrator.ts    # 编排引擎
│   │       └── index.ts           # 导出
│   │
│   ├── hooks/
│   │   └── useAIWorkflow.ts       # AI 工作流 Hook
│   │
│   └── components/
│       ├── SuggestionChips.tsx    # 建议芯片组件
│       ├── WorkflowProgress.tsx   # 进度显示组件
│       └── ChatSidebar.tsx        # 修改:集成工作流
│
└── package.json                   # 新增依赖: ai, @ai-sdk/openai, zod
```

### 修改文件

- `src/app/dashboard/page.tsx` - 集成 useAIWorkflow Hook
- `src/components/ChatSidebar.tsx` - 增加工作流进度和建议芯片显示

---

## 🔧 核心模块

### 1. AI 服务层 (`lib/ai/`)

**功能**: 统一管理 AI 模型调用

**核心类**:
- `AIService`: AI 服务主类,支持多模型、缓存、降级
- `DoubaoAdapter`: 豆包模型适配器,基于 Vercel AI SDK
- `BaseModelAdapter`: 适配器基类,提供通用功能

**特点**:
- ✅ 使用 Vercel AI SDK 简化调用
- ✅ 支持文本生成、对象生成、流式输出
- ✅ 内置缓存机制(5分钟)
- ✅ 指标收集(延迟、成功率)
- ✅ 自动降级

### 2. 工具注册系统 (`lib/tools/`)

**功能**: 管理所有 AI 工具

**5 个核心工具**:
1. **DecomposeTaskTool** - 任务拆解
2. **EstimateTimeTool** - 时间估算
3. **PrioritizeTasksTool** - 优先级排序
4. **ClarifyTaskTool** - 任务澄清
5. **ChecklistTool** - 检查清单生成

**工具注册中心 (`ToolRegistry`)**:
- 工具注册/注销
- 标签索引查询
- 批量执行
- 统计信息

**特点**:
- ✅ 统一的工具接口(继承 `AITool`)
- ✅ 生命周期钩子(validate, beforeExecute, afterExecute)
- ✅ 使用 Zod Schema 验证输出
- ✅ 自动统计收集

### 3. 工作流编排器 (`lib/workflow/`)

**功能**: 编排和执行工作流

**核心组件**:
- `WorkflowContextManager`: 上下文状态管理
- `WorkflowOrchestrator`: 工作流编排引擎
- `workflowSteps`: 6 个预定义步骤

**工作流阶段**:
1. **analyzing** - 分析任务复杂度
2. **clarifying** - 澄清需求
3. **decomposing** - 拆解任务
4. **estimating** - 估算时间
5. **prioritizing** - 排序优先级
6. **checking** - 生成检查清单
7. **completed** - 完成

**特点**:
- ✅ 自动阶段转换
- ✅ 支持跳过阶段
- ✅ 状态监听机制
- ✅ 错误处理和恢复

### 4. UI 集成 (`hooks/` & `components/`)

**useAIWorkflow Hook**:
- 管理工作流状态
- 追踪执行进度
- 收集 AI 建议
- 提供操作方法(start, pause, resume, stop)

**UI 组件**:
- `SuggestionChips`: 显示 AI 建议,支持接受/拒绝
- `WorkflowProgress`: 显示工作流进度条和当前步骤
- `ChatSidebar`: 集成进度和建议到聊天界面

---

## 🎯 工作流执行流程

### 用户交互流程

```
1. 用户点击 "✨ 写好任务了，AI帮忙完善计划"
   ↓
2. Dashboard 调用 startWorkflow(tasks, userId)
   ↓
3. useAIWorkflow 初始化 MockWorkflowExecutor
   ↓
4. 执行器按顺序执行 6 个阶段:
   - analyzing    → 生成建议芯片
   - clarifying   → 生成建议芯片
   - decomposing  → 生成建议芯片
   - estimating
   - prioritizing
   - checking
   ↓
5. 每个阶段更新:
   - workflowProgress (进度条)
   - streamingMessage (流式消息)
   - suggestions (建议芯片)
   ↓
6. ChatSidebar 实时显示:
   - 工作流进度 (WorkflowProgress 组件)
   - AI 建议 (SuggestionChips 组件)
   ↓
7. 用户可以:
   - 接受建议 (acceptSuggestion)
   - 拒绝建议 (rejectSuggestion)
   - 查看进度详情
```

### 当前实现状态

**✅ 已实现 (Mock)**:
- 工作流状态管理
- 进度追踪和显示
- 建议芯片生成和交互
- UI 集成(按钮、进度条、芯片)

**⏳ 待实现 (真实集成)**:
- 连接到真实的 `WorkflowOrchestrator`
- 调用真实的 AI 工具
- 处理 AI 返回的结果
- 应用建议到任务列表

---

## 🔄 未来集成步骤

### 替换 Mock 为真实工作流

**步骤 1**: 初始化 AI 服务和工具

```typescript
// 在 dashboard 中初始化
const aiService = new AIService({
  defaultModel: 'primary',
  cacheEnabled: true,
});

const doubaoAdapter = createDoubaoAdapter({
  modelName: 'doubao-pro-32k',
  apiKey: process.env.NEXT_PUBLIC_DOUBAO_API_KEY || '',
  baseURL: process.env.NEXT_PUBLIC_DOUBAO_BASE_URL || '',
});

aiService.registerAdapter('primary', doubaoAdapter);
initializeTools(aiService);
```

**步骤 2**: 创建工作流编排器

```typescript
const orchestrator = createWorkflowOrchestrator(
  globalToolRegistry,
  aiService
);
```

**步骤 3**: 修改 useAIWorkflow

将 `MockWorkflowExecutor` 替换为真实的 `orchestrator.execute()`:

```typescript
// 替换 hooks/useAIWorkflow.ts 中的 executor
const result = await orchestrator.execute({
  userId,
  tasks,
  autoExecute: true,
});
```

**步骤 4**: 处理真实结果

```typescript
// 将工作流结果应用到任务列表
const suggestions = orchestrator.getContextManager().getSuggestions();
setSuggestions(suggestions);
```

---

## 📊 性能优化

### 已实现优化

1. **缓存机制**
   - AI 调用结果缓存(5分钟)
   - 图片预处理缓存
   
2. **并行处理**
   - 批量工具执行支持

3. **状态管理**
   - 使用 `useCallback` 避免重复渲染
   - `memo` 包装组件减少不必要更新

### 待优化

1. **流式输出**
   - 实现真正的流式 AI 响应
   - 逐字显示进度

2. **错误恢复**
   - 工具执行失败后的重试机制
   - 断点续传

3. **用户体验**
   - 添加加载骨架屏
   - 优化动画过渡

---

## 🧪 测试计划

### 单元测试

- [ ] AI Service 测试
- [ ] 工具执行测试
- [ ] 工作流编排测试
- [ ] 上下文管理测试

### 集成测试

- [ ] 端到端工作流测试
- [ ] UI 交互测试
- [ ] 错误场景测试

### 用户测试

- [ ] 工作流流畅性
- [ ] 建议芯片有用性
- [ ] 性能和响应速度

---

## 📝 环境变量

### 必需配置

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# 豆包 API 配置
NEXT_PUBLIC_DOUBAO_API_KEY=your_doubao_api_key
NEXT_PUBLIC_DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

---

## 🎉 总结

### 完成情况

✅ **阶段 0**: 准备工作  
✅ **阶段 1**: 类型定义  
✅ **阶段 2**: AI 服务层  
✅ **阶段 3**: 工具注册系统  
✅ **阶段 4**: 工作流编排器  
✅ **阶段 5**: Dashboard 集成  

### 代码统计

| 模块 | 文件数 | 代码行数 |
|------|--------|----------|
| 类型定义 | 3 | ~700 |
| AI 服务层 | 5 | ~800 |
| 工具系统 | 8 | ~1,500 |
| 工作流 | 4 | ~1,200 |
| UI 集成 | 3 | ~600 |
| **总计** | **23** | **~4,800** |

### 架构优势

✅ **模块化**: 每个模块职责清晰,易于维护  
✅ **可扩展**: 易于添加新工具、新步骤  
✅ **类型安全**: 全程 TypeScript + Zod 验证  
✅ **渐进式**: 可以逐步替换 Mock 为真实实现  
✅ **性能优化**: 内置缓存、指标收集  

---

## 🚀 下一步

1. 配置豆包 API 密钥
2. 测试 Mock 工作流
3. 逐步替换为真实 AI 调用
4. 根据用户反馈优化
5. 添加更多工具(如日程安排、提醒设置)

---

**文档版本**: v1.0  
**更新日期**: 2024-10-14  
**作者**: AI Assistant

