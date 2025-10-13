# 数据库设置指南

## 📋 表结构说明

### users 表
- `id` - UUID 主键，自动生成
- `username` - 用户名，唯一约束
- `password_hash` - 密码哈希值
- `created_at` - 创建时间

### tasks 表
- `id` - UUID 主键，自动生成
- `user_id` - 用户ID，外键关联 users.id
- `title` - 任务标题（必填）
- `description` - 任务描述（可选）
- `deadline` - 截止日期（可选）
- `priority` - 优先级：'low' | 'medium' | 'high'
- `completed` - 完成状态，布尔值
- `created_at` - 创建时间
- `updated_at` - 更新时间（自动更新）

### chat_messages 表
- `id` - UUID 主键，自动生成
- `user_id` - 用户ID，外键关联 users.id
- `chat_date` - 对话所属日期（DATE 类型，用于按天隔离对话）
- `role` - 消息角色：'user'（用户）或 'assistant'（AI助手）
- `content` - 消息内容（JSONB 格式，支持文本、图片等多种内容）
- `created_at` - 创建时间

## 🚀 设置步骤

### 1. 在 Supabase 控制台中执行 SQL

#### 初始化数据库（首次设置）
1. 登录你的 Supabase 项目: https://eipmjbxhwaviitzerjkr.supabase.co
2. 点击左侧菜单的 **"SQL Editor"**
3. 点击 **"New query"**
4. 复制并粘贴 `schema-custom-auth.sql` 的内容
5. 点击 **"Run"** 执行

#### 添加 AI 对话功能（新增）
1. 在 SQL Editor 中点击 **"New query"**
2. 复制并粘贴 `create-chat-messages-table.sql` 的内容
3. 点击 **"Run"** 执行
4. 执行成功后会看到 "Success. No rows returned" 提示

### 2. （可选）插入测试数据

1. 在 SQL Editor 中新建查询
2. 复制并粘贴 `sample-data.sql` 的内容
3. 点击 **"Run"** 执行

### 3. 验证表创建

在 SQL Editor 中运行以下查询来验证：

```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 查看 users 表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users';

-- 查看 tasks 表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tasks';

-- 查看 chat_messages 表结构（新增）
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_messages';
```

## 🔍 任务排序查询

根据 PRD 要求，任务按以下逻辑排序：

```sql
SELECT * FROM tasks 
WHERE user_id = $1 
ORDER BY
  CASE priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END,
  deadline ASC NULLS LAST;
```

## 🚨 过期任务查询

识别过期任务：

```sql
SELECT *, 
  CASE 
    WHEN deadline IS NOT NULL AND deadline < NOW() AND completed = false 
    THEN true 
    ELSE false 
  END AS is_overdue
FROM tasks 
WHERE user_id = $1;
```

## 🔐 安全说明

- 当前配置未启用行级安全策略 (RLS)
- 权限控制在应用层实现
- 生产环境建议启用 RLS 并配置适当策略

