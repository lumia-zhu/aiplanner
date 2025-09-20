-- 更新的数据库修复脚本
-- 使用完整的日期时间存储，但界面只显示时间

-- 第一步：检查当前表结构
SELECT 'Current tasks table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
ORDER BY ordinal_position;

-- 第二步：添加新的 deadline_datetime 字段（TIMESTAMP WITH TIME ZONE）
SELECT 'Adding deadline_datetime field...' as info;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_datetime TIMESTAMP WITH TIME ZONE;

-- 第三步：如果存在旧字段，先迁移数据
-- 如果有 deadline_time (TIME) 字段，转换为当天的完整时间戳
-- UPDATE tasks SET deadline_datetime = (CURRENT_DATE + deadline_time::time)::timestamp with time zone 
-- WHERE deadline_time IS NOT NULL;

-- 如果有 deadline (TIMESTAMP) 字段，直接复制
-- UPDATE tasks SET deadline_datetime = deadline WHERE deadline IS NOT NULL;

-- 第四步：删除旧字段
SELECT 'Removing old fields...' as info;
ALTER TABLE tasks DROP COLUMN IF EXISTS deadline_time;
ALTER TABLE tasks DROP COLUMN IF EXISTS deadline;

-- 第五步：更新索引
SELECT 'Updating indexes...' as info;
DROP INDEX IF EXISTS idx_tasks_deadline;
DROP INDEX IF EXISTS idx_tasks_deadline_time;
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_datetime ON tasks(deadline_datetime);

-- 第六步：检查修复后的表结构
SELECT 'Updated tasks table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
ORDER BY ordinal_position;

-- 第七步：清理测试数据
SELECT 'Cleaning up test data...' as info;
DELETE FROM tasks WHERE user_id NOT IN (SELECT id FROM users);

-- 第八步：显示最终状态
SELECT 'Final verification:' as info;
SELECT COUNT(*) as task_count FROM tasks;
SELECT COUNT(*) as user_count FROM users;

-- 完成提示
SELECT '✅ Database updated! Now using deadline_datetime (TIMESTAMP WITH TIME ZONE) field.' as result;
