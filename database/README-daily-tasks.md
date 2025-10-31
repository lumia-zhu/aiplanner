# 笔记任务表设置指南

## 📋 功能说明

`daily_tasks` 表用于存储笔记编辑器中的任务（Tiptap TaskList items），支持：
- ✅ 任务持久化存储
- ✅ 任务矩阵分类
- ✅ 跨天任务管理
- ✅ 与笔记内容双向同步

---

## 🗄️ 数据表结构

### 表名：`daily_tasks`

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| `id` | UUID | 任务ID | PRIMARY KEY, 自动生成 |
| `user_id` | UUID | 用户ID | REFERENCES users(id), NOT NULL |
| `title` | TEXT | 任务标题 | NOT NULL |
| `completed` | BOOLEAN | 是否完成 | DEFAULT FALSE |
| `date` | TEXT | 任务所属日期 | NOT NULL, 格式 YYYY-MM-DD |
| `deadline_datetime` | TEXT | 截止时间 | 可选, ISO 8601 格式 |
| `note_date` | TEXT | 任务来自哪天的笔记 | NOT NULL, 格式 YYYY-MM-DD |
| `note_position` | INT | 在笔记中的位置 | DEFAULT 0 |
| `created_at` | TIMESTAMP | 创建时间 | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | 更新时间 | 自动更新 |

---

## 🔄 **任务同步机制**

### **笔记 → 数据库**
当用户在笔记中创建或修改任务时：
```
用户在笔记编辑器中创建任务
    ↓
Tiptap 保存笔记内容到 notes 表
    ↓
解析笔记中的 TaskItem 节点
    ↓
同步到 daily_tasks 表
    ↓
如果任务没有矩阵位置，创建 task_matrix 记录（默认：待分类）
```

### **数据库 → 笔记**
当用户在矩阵中完成任务时：
```
用户在矩阵中勾选任务
    ↓
更新 daily_tasks.completed = true
    ↓
更新笔记内容中对应的 TaskItem.checked = true
    ↓
保存笔记到 notes 表
```

---

## 🚀 设置步骤

### Step 1: 登录 Supabase
访问 [Supabase Dashboard](https://app.supabase.com)

### Step 2: 执行创建脚本
1. 打开 SQL Editor
2. 复制 `create-daily-tasks-table.sql` 的内容
3. 执行脚本

### Step 3: 验证表创建成功
在 Table Editor 中应该能看到 `daily_tasks` 表

---

## ✅ 验证清单

### 1. 表结构验证
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'daily_tasks'
ORDER BY ordinal_position;
```

### 2. 索引验证
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'daily_tasks';
```

应该看到 3 个索引：
- `idx_daily_tasks_user_date`
- `idx_daily_tasks_user_note_date`
- `idx_daily_tasks_completed`

### 3. RLS 策略验证
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'daily_tasks';
```

应该看到 4 条策略（SELECT, INSERT, UPDATE, DELETE）

### 4. 外键验证
```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%task_matrix%';
```

应该看到 `task_matrix.task_id` 指向 `daily_tasks.id`

---

## 📊 使用示例

### 创建任务
```sql
INSERT INTO daily_tasks (user_id, title, date, note_date) 
VALUES (
  'user-uuid',
  '完成项目报告',
  '2025-10-31',  -- 任务属于今天
  '2025-10-31'   -- 任务来自今天的笔记
);
```

### 查询某天的任务
```sql
SELECT id, title, completed, deadline_datetime
FROM daily_tasks
WHERE user_id = 'user-uuid' 
  AND date = '2025-10-31'
ORDER BY note_position;
```

### 完成任务
```sql
UPDATE daily_tasks
SET completed = true
WHERE id = 'task-uuid';
```

### 移动任务到其他日期
```sql
UPDATE daily_tasks
SET date = '2025-11-01'
WHERE id = 'task-uuid';
```

### 查询跨天未完成任务
```sql
SELECT date, title, created_at
FROM daily_tasks
WHERE user_id = 'user-uuid'
  AND completed = false
  AND date < TO_CHAR(NOW(), 'YYYY-MM-DD')
ORDER BY date DESC;
```

---

## 🔗 关联关系

```
daily_tasks (笔记任务)
    ↓
task_matrix (矩阵位置)
    ↓
象限分类 (unclassified, urgent-important, etc.)
```

---

## 🤔 常见问题

### Q1: date 和 note_date 有什么区别？

- **`date`**: 任务属于哪一天（可以修改，支持跨天）
  - 例如：今天创建的任务，可以移动到明天
- **`note_date`**: 任务最初在哪天的笔记中创建（不变）
  - 例如：在10月31日的笔记中创建，永远是 `2025-10-31`

### Q2: 如何处理任务删除？

当用户在笔记中删除任务时：
1. 从 `daily_tasks` 表删除记录
2. 级联删除 `task_matrix` 中的记录（ON DELETE CASCADE）

### Q3: 任务完成状态如何同步？

- 在笔记中勾选 → 更新 `daily_tasks.completed`
- 在矩阵中勾选 → 更新 `daily_tasks.completed` + 更新笔记内容

### Q4: 如何批量同步现有笔记中的任务？

需要编写脚本解析所有笔记的 JSON 内容，提取 TaskItem 并插入到 `daily_tasks` 表。

---

## 📝 字段说明详解

### note_position
- 用途：记录任务在笔记中的出现顺序
- 示例：第1个任务 = 0, 第2个任务 = 1
- 作用：同步时可以精确定位到笔记中的哪个任务

### deadline_datetime
- 格式：ISO 8601 (如：`2025-10-31T18:00:00Z`)
- 来源：笔记中的 `@时间` 标记或 AI 解析
- 显示：在任务卡片中显示截止时间

---

## 🗑️ 清理和重置

如果需要完全删除表并重新创建：

```sql
-- ⚠️ 警告：这将删除所有任务数据！

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_update_daily_tasks_updated_at ON daily_tasks;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS update_daily_tasks_updated_at();

-- 3. 删除表（CASCADE 会同时删除 task_matrix 的外键）
DROP TABLE IF EXISTS daily_tasks CASCADE;

-- 4. 重新执行 create-daily-tasks-table.sql
```

---

## 🔗 相关文档

- [任务矩阵表设置指南](./README-task-matrix.md)
- [笔记表设置指南](./README-notes.md)
- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)

---

## 📅 更新日志

- **2025-10-31**: 初始版本，创建笔记任务表


