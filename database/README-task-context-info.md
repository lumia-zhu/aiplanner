# 任务上下文信息表 - 数据库迁移文档

## 📋 概述

本迁移添加了 `task_context_info` 表，用于存储从反思问答中提取的任务背景、目标、资源等上下文信息。

## 🎯 功能

- 将反思问答中的关键信息提取并关联到具体任务
- LLM 自动提取和精简信息
- 用户可以预览和编辑提取的内容
- 记录信息来源（问题和答案）
- 支持自定义显示顺序

## 📊 表结构

### `task_context_info` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `task_id` | UUID | 关联的任务ID（外键） |
| `content` | TEXT | 提取的核心信息内容 |
| `source` | VARCHAR(50) | 信息来源类型 |
| `source_question` | TEXT | 原始问题（可选） |
| `source_answer` | TEXT | 原始回答（可选） |
| `display_order` | INTEGER | 显示顺序 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 来源（source）取值

- `clarity-reflection` - 任务澄清反思
- `time-reflection` - 时间估计反思
- `decomposition-reflection` - 任务拆解反思
- `priority-reflection` - 优先级排列反思

## 🚀 执行迁移

### 方法1：使用 Supabase Dashboard

1. 登录 Supabase Dashboard
2. 进入项目的 SQL Editor
3. 复制 `create-task-context-info.sql` 的内容
4. 粘贴并执行

### 方法2：使用 psql 命令行

```bash
psql -h <your-host> -U <your-user> -d <your-database> -f database/create-task-context-info.sql
```

### 方法3：使用 Supabase CLI

```bash
supabase db push
```

## ✅ 验证迁移

执行以下 SQL 验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'task_context_info';

-- 检查表结构
\d task_context_info

-- 检查索引
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'task_context_info';

-- 检查外键约束
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'task_context_info';
```

预期结果：
- ✅ 表 `task_context_info` 存在
- ✅ 包含 2 个索引：`idx_task_context_task_id`、`idx_task_context_created_at`
- ✅ 包含外键约束：`fk_task_context_task`
- ✅ 包含触发器：`trigger_update_task_context_info_updated_at`

## 🧪 测试数据

插入测试数据：

```sql
-- 第一步：从 daily_tasks 表获取一个真实的任务ID
SELECT id, title FROM daily_tasks LIMIT 5;

-- 第二步：使用真实的任务ID插入上下文信息（替换 'your-task-id'）
INSERT INTO task_context_info (
  task_id,
  content,
  source,
  source_question,
  source_answer
) VALUES (
  'your-task-id'::uuid,
  'ADHD任务管理研究项目；已有需求文档',
  'clarity-reflection',
  '这个原型开发是针对什么产品或项目的？',
  'ADHD任务管理是一个研究项目，目前已经有一些需求文档了'
);

-- 查询测试
SELECT * FROM task_context_info WHERE task_id = 'your-task-id'::uuid;
```

## 🔄 回滚

如果需要回滚此迁移：

```sql
-- 删除触发器
DROP TRIGGER IF EXISTS trigger_update_task_context_info_updated_at ON task_context_info;

-- 删除触发器函数
DROP FUNCTION IF EXISTS update_task_context_info_updated_at();

-- 删除表（会级联删除索引和约束）
DROP TABLE IF EXISTS task_context_info CASCADE;
```

## 📝 注意事项

1. **外键约束**：`task_id` 关联到 `daily_tasks` 表，删除任务时会自动删除关联的所有上下文信息（CASCADE）
2. **更新时间**：`updated_at` 字段会在每次更新时自动更新
3. **显示顺序**：`display_order` 默认为 0，数字越小越靠前显示
4. **简化设计**：无分类字段，所有上下文信息统一用 💡 图标显示
5. **表关联**：如果你之前创建过指向 `tasks` 表的外键，请运行 `update-task-context-info-foreign-key.sql` 更新

## 🔒 权限配置

### 开发环境测试（推荐方案1）

**临时关闭 RLS 用于快速测试**：

```sql
-- 执行此脚本
-- 文件：disable-rls-task-context-info-for-testing.sql
ALTER TABLE task_context_info DISABLE ROW LEVEL SECURITY;
```

⚠️ 注意：此方案仅用于开发测试，生产环境请使用方案2

### 生产环境配置（推荐方案2）

**启用正确的 RLS 策略**：

1. 执行 `enable-rls-task-context-info.sql` 脚本
2. 确保用户已登录（`auth.uid()` 有值）
3. 确保关联的任务属于当前用户（任务存在于 `daily_tasks` 表中）

**如果已经创建了表但外键指向错误**：

1. 先执行 `update-task-context-info-foreign-key.sql` 更新外键
2. 再执行 `enable-rls-task-context-info.sql` 设置权限

## 🔗 相关文件

- SQL 脚本：
  - `create-task-context-info.sql` - 创建表
  - `enable-rls-task-context-info.sql` - 启用 RLS 策略（生产环境）
  - `disable-rls-task-context-info-for-testing.sql` - 关闭 RLS（测试环境）
- TypeScript 类型：`src/types/task-context.ts`
- 服务层：`src/lib/taskContextService.ts`
