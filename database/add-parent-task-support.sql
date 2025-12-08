-- ============================================
-- 添加子任务支持
-- ============================================
-- 功能：为 daily_tasks 表添加父子关系支持
-- 创建时间：2025-12-08
-- ============================================

-- 1. 添加字段
ALTER TABLE daily_tasks 
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES daily_tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS depth INT DEFAULT 0;

-- 2. 更新现有数据（所有现有任务视为顶层任务）
UPDATE daily_tasks 
SET depth = 0, parent_task_id = NULL 
WHERE depth IS NULL;

-- 3. 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_daily_tasks_parent_id ON daily_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_depth ON daily_tasks(depth);

-- 4. 添加约束：depth 必须 >= 0
-- 使用 DO 块来安全添加约束（避免重复添加时报错）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_depth_non_negative'
  ) THEN
    ALTER TABLE daily_tasks 
    ADD CONSTRAINT check_depth_non_negative CHECK (depth >= 0);
  END IF;
END $$;

-- 5. 添加注释（便于理解）
COMMENT ON COLUMN daily_tasks.parent_task_id IS '父任务ID，NULL表示顶层任务';
COMMENT ON COLUMN daily_tasks.depth IS '任务层级：0=顶层任务，1=子任务，2=孙任务...';

-- ============================================
-- 验证脚本
-- ============================================

-- 查看表结构
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'daily_tasks' 
  AND column_name IN ('parent_task_id', 'depth')
ORDER BY ordinal_position;

-- 查看索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'daily_tasks' 
  AND indexname LIKE '%parent%' OR indexname LIKE '%depth%';

-- 统计任务层级分布
SELECT 
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN depth = 0 THEN 1 END) as top_level_tasks,
  COUNT(CASE WHEN depth = 1 THEN 1 END) as subtasks_level_1,
  COUNT(CASE WHEN depth = 2 THEN 1 END) as subtasks_level_2,
  COUNT(CASE WHEN depth > 2 THEN 1 END) as subtasks_deeper
FROM daily_tasks;

-- 验证约束
SELECT 
  conname as constraint_name, 
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname LIKE '%daily_tasks%' AND conname LIKE '%depth%';

-- ============================================
-- 测试脚本（可选，用于验证父子关系）
-- ============================================

-- 示例：创建一个父任务和两个子任务
-- 注意：需要替换 'your-user-id-here' 为真实的用户ID

-- 插入父任务
-- INSERT INTO daily_tasks (user_id, title, date, note_date, depth, parent_task_id) 
-- VALUES (
--   'your-user-id-here',
--   '原型开发',
--   '2025-12-08',
--   '2025-12-08',
--   0,
--   NULL
-- ) RETURNING id;

-- 插入子任务（假设父任务ID是 'parent-task-id-here'）
-- INSERT INTO daily_tasks (user_id, title, date, note_date, depth, parent_task_id) 
-- VALUES 
--   ('your-user-id-here', '需求分析与规划', '2025-12-08', '2025-12-08', 1, 'parent-task-id-here'),
--   ('your-user-id-here', '设计原型界面', '2025-12-08', '2025-12-08', 1, 'parent-task-id-here');

-- 查询验证（查看父任务及其子任务）
-- SELECT 
--   t1.id as parent_id,
--   t1.title as parent_title,
--   t1.depth as parent_depth,
--   t2.id as child_id,
--   t2.title as child_title,
--   t2.depth as child_depth
-- FROM daily_tasks t1
-- LEFT JOIN daily_tasks t2 ON t2.parent_task_id = t1.id
-- WHERE t1.depth = 0
-- ORDER BY t1.id, t2.id;

-- ============================================
-- 回滚脚本（如需撤销改动，取消注释后执行）
-- ============================================

-- DROP INDEX IF EXISTS idx_daily_tasks_parent_id;
-- DROP INDEX IF EXISTS idx_daily_tasks_depth;
-- ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS check_depth_non_negative;
-- ALTER TABLE daily_tasks DROP COLUMN IF EXISTS depth;
-- ALTER TABLE daily_tasks DROP COLUMN IF EXISTS parent_task_id;

