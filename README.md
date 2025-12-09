# 📋 任务管理器

一个基于 Next.js + Supabase 的现代化任务管理应用，支持用户认证、任务增删改查、优先级管理和过期提醒。

## ✨ 功能特色

### 基础功能
- 🔐 **用户认证系统** - 简单的用户名+密码注册登录
- 📝 **任务管理** - 完整的增删改查功能
- 🎯 **优先级管理** - 高/中/低三级优先级，彩色标签显示
- ⏰ **截止日期** - 支持设置截止日期，过期任务自动标红提醒
- ✅ **完成状态** - 勾选框标记任务完成状态
- 🔄 **智能排序** - 按优先级+截止日期自动排序
- 📱 **响应式设计** - 适配桌面和移动端
- 🎨 **现代化UI** - 蓝色主题，简洁美观

### AI Agent 功能 ⭐ NEW (2025-11-07)
- 🤖 **ReAct Agent** - 基于推理和行动（Reasoning + Acting）范式的智能助手
- 🧠 **长期记忆** - 自动加载 3 个月的任务上下文，理解用户习惯
- 🛠️ **工具生态** - 6 个专业工具（查询、分析、澄清、拆解、估时、上下文加载）
- 💬 **交互式流程** - 支持多轮对话和暂停/恢复机制
- 🎯 **智能推理** - 自动选择合适的工具完成复杂任务
- 📊 **任务分析** - 自动识别任务风险并提供优化建议

## 🛠️ 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **后端**: Supabase (PostgreSQL + 认证)
- **部署**: Vercel
- **状态管理**: React Hooks
- **样式**: Tailwind CSS v4

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd task-manager
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_项目_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_supabase_匿名_密钥
```

### 4. 数据库设置

在 Supabase 控制台的 SQL Editor 中执行以下 SQL：

```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建任务表
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 开始使用！

## 🤖 如何使用 AI Agent

### 启用 Agent 模式

1. 打开应用，点击右下角的 **AI 助手图标** 💬
2. 在聊天侧边栏顶部，切换 **"Agent 模式"** 开关
3. 看到紫色渐变提示条后，Agent 模式已启用！

### Agent 能做什么？

Agent 会根据你的需求，自动选择合适的工具来完成任务：

#### 查询任务
```
你：我今天有哪些任务？
Agent：[调用 get_tasks 工具] → 返回任务列表
```

#### 分析任务
```
你：帮我分析今天的任务
Agent：[调用 get_tasks] → [调用 analyze_tasks] → 提供分析建议
```

#### 澄清任务
```
你：帮我澄清任务：完成项目报告
Agent：[调用 clarify_task] → 暂停并询问相关问题
你：[回答问题]
Agent：[恢复执行] → 返回澄清后的任务信息
```

#### 拆解任务
```
你：帮我把"学习 React"这个任务拆成小步骤
Agent：[调用 decompose_task] → 暂停并询问任务背景
你：[提供背景信息]
Agent：[恢复执行] → 返回子任务列表
```

#### 估算时间
```
你：完成这个任务大概需要多久？
Agent：[调用 estimate_time] → 返回时间估算和依据
```

### Agent 的推理过程

Agent 会展示它的思考过程，帮助你理解它是如何工作的：

1. **💭 思考（Thought）** - 紫色卡片
   - Agent 分析当前情况，决定下一步做什么

2. **🔧 行动（Action）** - 蓝色卡片
   - Agent 调用某个工具（如查询任务、分析任务）
   - 可以点击"查看参数"查看工具调用的详细参数

3. **👁️ 观察（Observation）** - 绿色/红色卡片
   - 工具执行成功显示绿色，失败显示红色
   - 可以点击"查看结果"查看工具返回的数据

4. **⏸️ 需要输入（Need Input）** - 黄色卡片
   - Agent 暂停并等待你的输入
   - 输入后点击"✅ 提交并继续"，Agent 会恢复执行

5. **🎯 最终回复** - 白色聊天气泡
   - Agent 完成推理后给出的最终答案

### 示例对话流程

```
用户消息：我今天有哪些任务？

↓

💭 Thought：用户想查看今天的任务，我需要调用 get_tasks 工具

↓

🔧 Action：调用 get_tasks 工具
参数：userId=xxx, dateRange={start: "2025-11-07", end: "2025-11-07"}

↓

👁️ Observation：✅ 工具执行成功
结果：找到 3 个任务

↓

🎯 AI 回复：你今天有 3 个任务：
1. 完成报告（高优先级）
2. 开会讨论（中优先级）
3. 回复邮件（低优先级）
```

### 快捷提示词

点击 Agent 模式提示条中的示例问题，可以快速输入：
- "我今天有哪些任务？"
- "帮我分析任务"
- "拆解这个任务"

### Agent 模式 vs 普通模式

| 功能 | Agent 模式 | 普通模式 |
|------|-----------|---------|
| 查询任务 | ✅ 自动调用工具 | ❌ 需要手动操作 |
| 分析任务 | ✅ 深度分析 | ❌ 简单回复 |
| 任务拆解 | ✅ 智能拆解 | ❌ 需要手动输入 |
| 推理过程 | ✅ 完整展示 | ❌ 不展示 |
| 交互流程 | ✅ 支持暂停/恢复 | ❌ 不支持 |

### 注意事项

- ⚠️ Agent 需要配置 Doubao API Key 才能使用
- ⚠️ Agent 会自动加载 **3 个月**的任务上下文，首次调用可能需要几秒钟
- ⚠️ 交互式工具（澄清、拆解）会暂停 Agent，需要你提供输入后才会继续
- ⚠️ Agent 最多推理 **5 轮**，避免无限循环

### 更多信息

详细的测试指南和故障排除，请查看：
- 📖 [PHASE4_TESTING_GUIDE.md](./PHASE4_TESTING_GUIDE.md)
- 📖 [PHASE4_EXECUTION_PLAN.md](./PHASE4_EXECUTION_PLAN.md)

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── auth/              # 认证相关页面
│   ├── dashboard/         # 任务管理主页面
│   └── test/              # 测试页面
├── components/            # React 组件
│   ├── TaskItem.tsx       # 任务项组件
│   └── TaskForm.tsx       # 任务表单组件
├── lib/                   # 工具库和配置
│   ├── auth.ts           # 认证相关函数
│   ├── tasks.ts          # 任务管理函数
│   ├── supabase.ts       # Supabase 基础配置
│   ├── supabase-client.ts # 客户端配置
│   └── supabase-server.ts # 服务端配置
└── types/                 # TypeScript 类型定义
```

## 🎯 核心功能

### 用户认证
- 用户注册（用户名+密码）
- 用户登录/退出
- 登录状态管理
- 路由保护

### 任务管理
- 创建任务（标题、描述、截止日期、优先级）
- 编辑任务信息
- 删除任务（带确认）
- 标记任务完成/未完成
- 按优先级和截止日期智能排序

### 视觉设计
- 优先级彩色标签（🔴高 🟡中 🟢低）
- 过期任务红色警告
- 已完成任务灰化显示
- 响应式卡片布局

## 🔧 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

## 📊 数据库设计

### 任务排序逻辑

按照以下优先级排序任务：

```sql
ORDER BY
  CASE priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END,
  deadline ASC NULLS LAST
```

### 过期任务检测

任务被标记为过期的条件：
- 有截止日期
- 截止日期 < 当前时间
- 任务未完成

## 🚀 部署

项目已配置用于 Vercel 部署：

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

## 🏗️ 架构设计

本项目采用**分层架构**设计，支持跨平台扩展：

### 核心特性
- ✅ **领域驱动设计** - 核心业务逻辑与平台无关
- ✅ **依赖倒置** - 面向接口编程，易于测试和扩展
- ✅ **适配器模式** - 支持多平台适配（Web、Mobile、Desktop）
- ✅ **工厂模式** - 自动根据平台选择合适的实现

### 架构文档
- 📚 [完整架构设计文档](./docs/ARCHITECTURE.md) - 详细的技术方案
- 🎓 [简化版架构指南](./docs/ARCHITECTURE_SIMPLE.md) - 通俗易懂的说明

### 目录结构（规划中）
```
src/
├── domain/              # 领域层：核心业务逻辑（平台无关）
│   ├── models/         # 数据模型
│   ├── rules/          # 业务规则
│   └── interfaces/     # 接口定义
├── application/         # 应用层：业务流程编排
│   ├── services/       # 业务服务
│   └── use-cases/      # 用例实现
├── infrastructure/      # 基础设施层：技术实现
│   ├── repositories/   # 数据访问
│   ├── api/           # API 客户端
│   └── adapters/      # 外部服务适配器
├── presentation/        # 展示层：UI 组件
│   ├── components/     # UI 组件
│   └── containers/     # 页面容器
└── platforms/          # 平台特定层：平台适配
    ├── web/           # Web 平台
    ├── mobile/        # 移动端平台
    ├── desktop/       # 桌面端平台
    └── extension/     # 浏览器插件
```

### 扩展性
本架构设计允许项目轻松扩展到：
- 📱 **React Native** 移动应用
- 💻 **Electron/Tauri** 桌面应用
- 🔌 **Browser Extension** 浏览器插件
- 🌐 **多后端支持**（Supabase、Firebase、自建服务器）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

## 📈 开发历史

### Phase 3: ReAct Agent 核心实现 (2025-11-07) ✅
**目标**: 实现完整的 ReAct（Reasoning + Acting）循环  
**成果**:
- ✅ 实现 AgentPrompt.ts - Prompt 模板和输出解析器
- ✅ 实现 ReactAgent.ts - Agent 核心逻辑和 ReAct 主循环
- ✅ 实现 AgentMemory.ts - 短期和长期记忆管理
- ✅ 所有测试场景 100% 通过
- ✅ 平均响应时间 2-4 秒（目标 < 5 秒）

**详细报告**: [PHASE3_COMPLETION_REPORT.md](./PHASE3_COMPLETION_REPORT.md)

### Phase 2: 工具层开发 (2025-11-06) ✅
**目标**: 构建 Agent 的工具生态系统  
**成果**:
- ✅ LoadTaskContextTool - 加载 3 个月任务上下文
- ✅ GetTasksTool - 查询任务（支持多种过滤条件）
- ✅ AnalyzeTasksTool - 分析任务并提供建议
- ✅ ClarifyTaskTool - 交互式任务澄清
- ✅ DecomposeTaskTool - 任务拆解
- ✅ EstimateTimeTool - 时间估算

**详细报告**: [PHASE2_EXECUTION_PLAN.md](./PHASE2_EXECUTION_PLAN.md)

### Phase 1: 基础设施搭建 (2025-11-05) ✅
**目标**: 建立 Agent 框架和 UI 模式切换  
**成果**:
- ✅ 创建 Agent 目录结构
- ✅ 定义核心类型和接口
- ✅ 在 ChatSidebar 中添加 Agent 模式切换
- ✅ 配置 Agent 参数管理

**详细报告**: [PHASE1_COMPLETION_REPORT.md](./PHASE1_COMPLETION_REPORT.md)

---

**开发时间**: 约 4-5 天 + AI Agent (3 天)  
**适用场景**: 个人任务管理、小团队协作、原型验证  
**架构设计**: 2025-10-30 更新  
**AI Agent**: 2025-11-07 完成