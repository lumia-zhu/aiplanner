# 📋 任务管理器

一个基于 Next.js + Supabase 的现代化任务管理应用，支持用户认证、任务增删改查、优先级管理和过期提醒。

## ✨ 功能特色

- 🔐 **用户认证系统** - 简单的用户名+密码注册登录
- 📝 **任务管理** - 完整的增删改查功能
- 🎯 **优先级管理** - 高/中/低三级优先级，彩色标签显示
- ⏰ **截止日期** - 支持设置截止日期，过期任务自动标红提醒
- ✅ **完成状态** - 勾选框标记任务完成状态
- 🔄 **智能排序** - 按优先级+截止日期自动排序
- 📱 **响应式设计** - 适配桌面和移动端
- 🎨 **现代化UI** - 蓝色主题，简洁美观

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

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**开发时间**: 约 4-5 天  
**适用场景**: 个人任务管理、小团队协作、原型验证