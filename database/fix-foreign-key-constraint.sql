-- ================================================
-- 修复外键约束 - 完整版
-- ================================================

-- Step 1: 查看当前的外键约束
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'task_context_info' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- Step 2: 删除表中的所有数据（如果有的话）
-- 这样才能安全地删除外键约束
DELETE FROM task_context_info;

-- Step 3: 删除所有可能存在的旧外键约束
ALTER TABLE task_context_info DROP CONSTRAINT IF EXISTS fk_task_context_task;
ALTER TABLE task_context_info DROP CONSTRAINT IF EXISTS fk_task_context_daily_task;
ALTER TABLE task_context_info DROP CONSTRAINT IF EXISTS task_context_info_task_id_fkey;

-- Step 4: 添加新的外键约束，指向 daily_tasks
ALTER TABLE task_context_info 
ADD CONSTRAINT fk_task_context_daily_task 
FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE;

-- Step 5: 验证新的外键约束
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'task_context_info' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- 预期结果：
-- constraint_name: fk_task_context_daily_task
-- foreign_table_name: daily_tasks







