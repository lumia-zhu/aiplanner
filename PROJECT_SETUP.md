# 任务管理器项目设置说明

## 📋 项目概述
这是一个基于 Next.js + Supabase + Vercel 的任务管理原型应用。

## 🛠️ 技术栈
- **前端**: Next.js 14 (App Router) + TypeScript
- **样式**: Tailwind CSS v4 (蓝色主题)
- **后端/数据库**: Supabase
- **认证**: Supabase Auth + SSR
- **部署**: Vercel

## 📁 项目结构
```
src/
├── app/                 # Next.js App Router 页面
├── components/          # React 组件
├── hooks/              # 自定义 React Hooks
├── lib/                # 工具库和配置
│   ├── supabase.ts     # 基础 Supabase 配置
│   ├── supabase-client.ts  # 客户端配置
│   └── supabase-server.ts  # 服务端配置
└── types/              # TypeScript 类型定义
```

## 🎨 设计主题
- 主色调：蓝色系 (#3b82f6)
- 状态色彩：
  - 成功：绿色 (#10b981)
  - 警告：琥珀色 (#f59e0b)
  - 危险/过期：红色 (#ef4444/#dc2626)

## ⚙️ 环境配置
1. 复制 `.env.example` 为 `.env.local`
2. 填入 Supabase 项目的 URL 和 API Key
3. 运行 `npm run dev` 启动开发服务器

## 📝 功能需求
- [x] 项目初始化和配置
- [ ] 用户注册/登录/退出
- [ ] 任务增删改查 (包含completed状态)
- [ ] 任务排序 (优先级 + 截止日期)
- [ ] 过期任务特殊标注
- [ ] 任务搜索和筛选
- [ ] 响应式界面设计
- [ ] 部署到 Vercel

## 🗄️ 数据库结构
### users 表
- id (uuid, 主键)
- username (text, 唯一)
- created_at (timestamp)

### tasks 表
- id (uuid, 主键)  
- user_id (uuid, 外键)
- title (text, 必填)
- description (text, 可选)
- deadline (timestamp, 可选)
- priority ('low'|'medium'|'high')
- completed (boolean, 默认false)
- created_at (timestamp)
- updated_at (timestamp)

## 🔧 开发命令
- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run lint` - 运行代码检查
