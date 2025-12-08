# 📋 子任务支持 - 数据库迁移指南

## 🎯 改造目的

为 `daily_tasks` 表添加父子关系支持，使系统能够：
1. 识别哪些任务是顶层任务（父任务）
2. 识别哪些任务是子任务
3. 反思功能只针对顶层任务进行（澄清、时间估计、优先级排序）

## 📊 改动内容

### 新增字段

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `parent_task_id` | UUID | 父任务ID（外键） | NULL |
| `depth` | INT | 任务层级（0=顶层，1=子任务...） | 0 |

### 新增索引

- `idx_daily_tasks_parent_id`：用于快速查询某个父任务的所有子任务
- `idx_daily_tasks_depth`：用于快速过滤顶层任务

### 约束

- `parent_task_id` 外键约束：ON DELETE CASCADE（删除父任务时自动删除子任务）
- `depth >= 0` 检查约束

## 🚀 执行步骤

### 步骤 1：登录 Supabase

1. 访问 https://supabase.com
2. 登录你的账号
3. 选择项目
4. 点击左侧 **SQL Editor**

### 步骤 2：执行迁移脚本

1. 点击 **New Query**
2. 复制 `add-parent-task-support.sql` 文件的全部内容
3. 粘贴到查询编辑器
4. 点击 **Run** 执行

### 步骤 3：验证结果

执行成功后，你应该看到类似以下输出：

**表结构验证：**
```
column_name      | data_type | is_nullable | column_default
-----------------+-----------+-------------+---------------
parent_task_id   | uuid      | YES         | NULL
depth            | integer   | YES         | 0
```

**索引验证：**
```
indexname                     | indexdef
------------------------------+------------------------------------------
idx_daily_tasks_parent_id     | CREATE INDEX ... ON daily_tasks(parent_task_id)
idx_daily_tasks_depth         | CREATE INDEX ... ON daily_tasks(depth)
```

**数据统计：**
```
total_tasks | top_level_tasks | subtasks_level_1 | subtasks_level_2 | subtasks_deeper
------------+-----------------+------------------+------------------+----------------
     X      |       X         |        0         |        0         |       0
```

如果你已有任务，`total_tasks` 和 `top_level_tasks` 应该相等（所有现有任务都被标记为顶层任务）。

## ✅ 验证清单

执行完成后，请确认：

- [ ] `parent_task_id` 字段已添加
- [ ] `depth` 字段已添加
- [ ] 两个索引已创建
- [ ] 现有任务的 `depth` 都是 0
- [ ] 现有任务的 `parent_task_id` 都是 NULL
- [ ] 约束 `check_depth_non_negative` 已创建

## 🔍 常见问题

### Q1: 执行时提示 "column already exists"

**原因**：字段已经存在（可能之前执行过）

**解决**：这是正常的，脚本使用了 `IF NOT EXISTS`，不会重复创建。

### Q2: 现有任务会受影响吗？

**答**：不会。所有现有任务会被自动设置为：
- `depth = 0`（顶层任务）
- `parent_task_id = NULL`（没有父任务）

现有功能完全不受影响。

### Q3: 如何撤销改动？

如果需要回滚，执行脚本底部的回滚脚本（取消注释）：

```sql
DROP INDEX IF EXISTS idx_daily_tasks_parent_id;
DROP INDEX IF EXISTS idx_daily_tasks_depth;
ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS check_depth_non_negative;
ALTER TABLE daily_tasks DROP COLUMN IF EXISTS depth;
ALTER TABLE daily_tasks DROP COLUMN IF EXISTS parent_task_id;
```

## 📝 下一步

完成数据库迁移后，需要：

1. ✅ **第一步：数据库改造**（当前步骤）
2. ⏳ **第二步：更新 TypeScript 类型定义**
3. ⏳ **第三步：修改同步逻辑，建立父子关系**
4. ⏳ **第四步：反思功能过滤子任务**
5. ⏳ **第五步：UI 优化（可选）**

---

**验证完成后，请告诉我结果，我们再进行下一步！** 🚀

