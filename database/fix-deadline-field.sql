-- 修复数据库字段不匹配问题
-- 问题：代码使用 deadline_time (TIME) 但数据库可能有 deadline (TIMESTAMP)

-- 1. 首先检查当前表结构
-- 如果你看到错误，说明字段已经存在或不存在，这是正常的

-- 2. 添加 deadline_time 字段（如果不存在）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_time TIME;

-- 3. 如果存在旧的 deadline 字段，可以选择性迁移数据
-- 注意：这会提取时间部分，丢弃日期信息
-- UPDATE tasks SET deadline_time = deadline::time WHERE deadline IS NOT NULL;

-- 4. 删除旧的 deadline 字段（如果存在）
ALTER TABLE tasks DROP COLUMN IF EXISTS deadline;

-- 5. 更新索引
DROP INDEX IF EXISTS idx_tasks_deadline;
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_time ON tasks(deadline_time);

-- 6. 确保表结构正确
-- 显示当前表结构以供验证
-- 在 Supabase SQL Editor 中运行以下查询来检查表结构：
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tasks' 
-- ORDER BY ordinal_position;

