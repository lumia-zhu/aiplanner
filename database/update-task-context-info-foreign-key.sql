-- ================================================
-- 更新任务上下文信息表的外键
-- ================================================
-- 功能：将外键从 tasks 表改为 daily_tasks 表
-- ================================================

-- 1. 删除旧的外键约束
ALTER TABLE task_context_info 
DROP CONSTRAINT IF EXISTS fk_task_context_task;

-- 2. 添加新的外键约束，指向 daily_tasks
ALTER TABLE task_context_info 
ADD CONSTRAINT fk_task_context_daily_task 
FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE;

-- 3. 验证外键约束
SELECT 
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'task_context_info' 
  AND constraint_type = 'FOREIGN KEY';

-- 预期结果：显示 fk_task_context_daily_task




