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

## 🚀 设置步骤

### 1. 在 Supabase 控制台中执行 SQL

1. 登录你的 Supabase 项目: https://eipmjbxhwaviitzerjkr.supabase.co
2. 点击左侧菜单的 **"SQL Editor"**
3. 点击 **"New query"**
4. 复制并粘贴 `schema-custom-auth.sql` 的内容
5. 点击 **"Run"** 执行

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
