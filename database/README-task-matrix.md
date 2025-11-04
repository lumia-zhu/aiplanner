# 任务矩阵功能数据库设置指南

## 📋 功能说明

任务矩阵功能基于经典的**艾森豪威尔矩阵**（重要-紧急矩阵），帮助用户对任务进行优先级分类管理。

### 🎯 四象限分类

```
                    ↑ 重要
    ┌──────────────────┬──────────────────┐
    │  📌 重要不紧急     │  🔥 重要且紧急    │
    │  战略规划区        │  危机处理区       │
    │  ────────────    │  ────────────   │
    │  • 学习新技能      │  • 紧急会议       │
    │  • 长期规划        │  • 系统故障       │
    │  • 健身锻炼        │  • 重要截止日期   │
    ├──────────────────┼──────────────────┤
    │  💤 不重要不紧急   │  ⚡ 紧急但不重要  │
    │  时间浪费区        │  琐碎事务区       │
    │  ────────────    │  ────────────   │
    │  • 闲逛刷剧        │  • 某些电话       │
    │  • 无意义社交      │  • 临时打扰       │
    │  • 过度娱乐        │  • 可参加可不参加 │
    └──────────────────┴──────────────────┘
  不紧急 ←─────────────────────→ 紧急
```

---

## 🗄️ 数据表结构

### 表名：`task_matrix`

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | UUID | 主键ID | PRIMARY KEY, 自动生成 |
| `task_id` | UUID | 关联的任务ID | REFERENCES tasks(id), NOT NULL, UNIQUE |
| `user_id` | UUID | 用户ID | REFERENCES users(id), NOT NULL |
| `quadrant` | TEXT | 象限类型 | NOT NULL, CHECK约束 |
| `position` | INT | 在象限内的排序位置 | DEFAULT 0 |
| `created_at` | TIMESTAMP | 创建时间 | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | 更新时间 | 自动更新 |

### 象限类型 (quadrant)

| 值 | 说明 | 默认 |
|----|------|------|
| `unclassified` | 📥 待分类 | ✅ 是 |
| `urgent-important` | 🔥 紧急且重要（右上） | |
| `not-urgent-important` | 📌 不紧急但重要（左上） | |
| `urgent-not-important` | ⚡ 紧急但不重要（右下） | |
| `not-urgent-not-important` | 💤 不紧急不重要（左下） | |

---

## 🚀 设置步骤

### Step 1: 登录 Supabase

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目

### Step 2: 打开 SQL Editor

1. 点击左侧菜单的 **"SQL Editor"**
2. 点击 **"New query"** 创建新查询

### Step 3: 执行创建脚本

1. 复制 `create-task-matrix-table.sql` 文件的全部内容
2. 粘贴到 SQL Editor 中
3. 点击 **"Run"** 执行

### Step 4: 验证表创建成功

在左侧菜单点击 **"Table Editor"**，应该能看到 `task_matrix` 表。

---

## ✅ 验证清单

执行以下检查确保设置成功：

### 1. 表结构验证
```sql
-- 查看表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'task_matrix'
ORDER BY ordinal_position;
```

**预期结果：** 应该看到 7 个字段（id, task_id, user_id, quadrant, position, created_at, updated_at）

### 2. 索引验证
```sql
-- 查看索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'task_matrix';
```

**预期结果：** 应该看到 4 个索引
- `idx_task_matrix_user_task`
- `idx_task_matrix_user_quadrant`
- `idx_task_matrix_quadrant_position`
- `idx_task_matrix_task_unique`

### 3. RLS 策略验证
```sql
-- 查看 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'task_matrix';
```

**预期结果：** 应该看到 4 条策略
- 用户只能访问自己的任务矩阵 (ALL)
- 用户可以创建自己的任务矩阵 (INSERT)
- 用户可以更新自己的任务矩阵 (UPDATE)
- 用户可以删除自己的任务矩阵 (DELETE)

### 4. 触发器验证
```sql
-- 查看触发器
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'task_matrix';
```

**预期结果：** 应该看到 `trigger_update_task_matrix_updated_at` 触发器

---

## 🔧 常见问题

### Q1: 如何为已有任务批量初始化矩阵信息？

```sql
-- 为所有未设置矩阵信息的任务初始化为"待分类"状态
INSERT INTO task_matrix (task_id, user_id, quadrant, position)
SELECT 
  t.id as task_id,
  t.user_id,
  'unclassified' as quadrant,
  0 as position
FROM tasks t
LEFT JOIN task_matrix tm ON t.id = tm.task_id
WHERE tm.id IS NULL;
```

### Q2: 如何查询某用户某天的任务矩阵分布？

```sql
-- 查询任务在各象限的分布
SELECT 
  tm.quadrant,
  COUNT(*) as task_count,
  ARRAY_AGG(t.title ORDER BY tm.position) as task_titles
FROM tasks t
JOIN task_matrix tm ON t.id = tm.task_id
WHERE t.user_id = 'your-user-id-here'
  AND t.date = '2025-10-31'
GROUP BY tm.quadrant
ORDER BY tm.quadrant;
```

### Q3: 如何移动任务到其他象限？

```sql
-- 更新任务的象限
UPDATE task_matrix
SET 
  quadrant = 'urgent-important',
  position = 1,
  updated_at = NOW()
WHERE task_id = 'your-task-id-here';
```

### Q4: 如何删除某个任务的矩阵信息？

```sql
-- 删除任务的矩阵信息（任务本身不会被删除）
DELETE FROM task_matrix
WHERE task_id = 'your-task-id-here';
```

---

## 📊 数据示例

```sql
-- 插入示例数据
INSERT INTO task_matrix (user_id, task_id, quadrant, position) VALUES
  ('user-123', 'task-001', 'urgent-important', 1),
  ('user-123', 'task-002', 'not-urgent-important', 1),
  ('user-123', 'task-003', 'unclassified', 0),
  ('user-123', 'task-004', 'urgent-not-important', 2);

-- 查询用户的任务矩阵
SELECT 
  tm.quadrant,
  t.title,
  t.date,
  tm.position,
  tm.created_at
FROM task_matrix tm
JOIN tasks t ON tm.task_id = t.id
WHERE tm.user_id = 'user-123'
ORDER BY tm.quadrant, tm.position;
```

---

## 🗑️ 清理和重置

如果需要完全删除表并重新创建：

```sql
-- ⚠️ 警告：这将删除所有数据！

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_update_task_matrix_updated_at ON task_matrix;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS update_task_matrix_updated_at();

-- 3. 删除表（CASCADE 会同时删除相关的约束和索引）
DROP TABLE IF EXISTS task_matrix CASCADE;

-- 4. 重新执行 create-task-matrix-table.sql 创建表
```

---

## 📝 注意事项

1. **唯一约束**：每个任务只能属于一个象限，不能同时出现在多个象限中
2. **级联删除**：删除任务时，对应的矩阵信息会自动删除
3. **默认状态**：新创建的任务默认为"待分类"状态
4. **RLS 安全**：用户只能访问和操作自己的任务矩阵
5. **自动时间戳**：`updated_at` 字段会在每次更新时自动更新

---

## 🔗 相关文档

- [任务表设置指南](./README.md)
- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL 触发器文档](https://www.postgresql.org/docs/current/sql-createtrigger.html)

---

## 📅 更新日志

- **2025-10-31**: 初始版本，创建任务矩阵表





