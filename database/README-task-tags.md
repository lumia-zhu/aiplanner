# 任务标签系统数据库迁移指南

## 📋 功能说明

为任务管理系统添加标签功能,支持:
- ✅ 预设标签(简单、困难、重要、紧急)
- ✅ 用户自定义标签
- ✅ 每个任务最多3个标签
- ✅ 用户最多保存20个自定义标签
- ✅ 完全向后兼容现有数据

## 🗄️ 数据库变更

### 1. tasks 表
```sql
-- 新增字段
tags TEXT[] DEFAULT '{}'

-- 新增索引
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags)
```

### 2. user_profiles 表
```sql
-- 新增字段
custom_task_tags TEXT[] DEFAULT '{}'
```

## 📝 迁移步骤

### 方式一: 通过 Supabase Dashboard (推荐)

1. 登录 Supabase Dashboard
2. 进入你的项目
3. 点击左侧 **SQL Editor**
4. 点击 **New query**
5. 复制 `add-task-tags.sql` 的全部内容
6. 点击 **Run** 执行
7. 查看执行结果,确认显示 ✅ 成功消息

### 方式二: 通过命令行

```bash
# 进入 database 目录
cd task-manager/database

# 使用 psql 执行迁移
psql -h <your-supabase-host> \
     -U postgres \
     -d postgres \
     -f add-task-tags.sql
```

## ✅ 验证迁移

执行后应该看到:

```
NOTICE:  ✅ tasks.tags 字段添加成功
NOTICE:  ✅ user_profiles.custom_task_tags 字段添加成功
NOTICE:  🎉 数据库迁移完成!所有现有数据保持不变。

 metric     | count
------------+-------
 现有任务数 |   X
 现有用户数 |   Y
```

## 🔙 回滚方案

如果需要回滚,执行 `rollback-task-tags.sql`:

```sql
-- 删除所有标签相关字段和索引
-- ⚠️ 警告: 会删除所有标签数据!
```

## 📊 数据示例

### 任务标签示例
```sql
-- 更新任务,添加标签
UPDATE tasks 
SET tags = '{"important", "urgent"}' 
WHERE id = 'xxx';

-- 查询带有特定标签的任务
SELECT * FROM tasks 
WHERE 'important' = ANY(tags);
```

### 用户自定义标签示例
```sql
-- 更新用户的自定义标签池
UPDATE user_profiles 
SET custom_task_tags = '{"学习", "工作", "个人"}' 
WHERE user_id = 'xxx';
```

## 🔍 常见问题

### Q: 迁移会影响现有任务吗?
A: 不会!所有现有任务会自动获得空数组 `[]`,显示和功能完全正常。

### Q: 如果用户没有 user_profiles 记录怎么办?
A: 创建任务时标签功能仍然可用,只是自定义标签不会被保存到标签池。

### Q: 标签可以为空吗?
A: 可以!标签是完全可选的,用户可以不添加任何标签。

## 📞 技术支持

如有问题,请查看:
- Supabase 日志: Dashboard > Logs
- 表结构: Dashboard > Table Editor
- SQL 查询: Dashboard > SQL Editor










