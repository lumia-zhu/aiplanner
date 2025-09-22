-- 完整的数据库修复脚本
-- 解决任务创建失败的问题

-- 第一步：检查当前表结构
SELECT 'Current tasks table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
ORDER BY ordinal_position;

-- 第二步：修复 deadline_time 字段
SELECT 'Adding deadline_time field...' as info;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_time TIME;

-- 第三步：删除旧的 deadline 字段（如果存在）
SELECT 'Removing old deadline field...' as info;
ALTER TABLE tasks DROP COLUMN IF EXISTS deadline;

-- 第四步：更新索引
SELECT 'Updating indexes...' as info;
DROP INDEX IF EXISTS idx_tasks_deadline;
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_time ON tasks(deadline_time);

-- 第五步：检查修复后的表结构
SELECT 'Updated tasks table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
ORDER BY ordinal_position;

-- 第六步：检查用户表（解决外键约束问题）
SELECT 'Current users in database:' as info;
SELECT id, username, created_at FROM users;

-- 第七步：清理可能的测试数据
SELECT 'Cleaning up any broken test data...' as info;
DELETE FROM tasks WHERE user_id NOT IN (SELECT id FROM users);

-- 第八步：显示最终状态
SELECT 'Final verification - Tasks count:' as info;
SELECT COUNT(*) as task_count FROM tasks;

SELECT 'Final verification - Users count:' as info;
SELECT COUNT(*) as user_count FROM users;

-- 完成提示
SELECT '✅ Database fix completed! You can now try creating tasks.' as result;

