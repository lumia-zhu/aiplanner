-- 数据库迁移：将任务改为当天任务管理
-- 将 deadline 字段改为 deadline_time 字段

-- 1. 添加新的 deadline_time 字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_time TIME;

-- 2. 如果有现有的 deadline 数据，可以选择性迁移
-- 注意：这会丢失日期信息，只保留时间部分
-- UPDATE tasks SET deadline_time = deadline::time WHERE deadline IS NOT NULL;

-- 3. 删除旧的 deadline 字段（可选，建议先备份数据）
-- ALTER TABLE tasks DROP COLUMN IF EXISTS deadline;

-- 4. 更新索引
DROP INDEX IF EXISTS idx_tasks_deadline;
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_time ON tasks(deadline_time);

-- 5. 清理测试数据（可选）
-- DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE username = 'testuser');

-- 注意事项：
-- 1. 执行前请备份数据库
-- 2. 现有任务的日期信息将丢失，只保留时间部分
-- 3. 建议在测试环境先验证迁移效果

