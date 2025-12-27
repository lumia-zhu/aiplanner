-- ============================================
-- 任务层级支持数据库迁移
-- ============================================
-- 功能：为 daily_tasks 表添加父子任务关系字段
-- 用途：支持子任务展开/折叠显示
-- 创建时间：2025-12-16
-- ============================================

-- 1. 添加层级字段
ALTER TABLE daily_tasks 
ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;

-- 2. 添加父任务ID字段
ALTER TABLE daily_tasks 
ADD COLUMN IF NOT EXISTS parent_task_id UUID;

-- 3. 添加外键约束（父任务删除时，子任务也删除）
-- 注意：如果外键已存在会报错，使用 DO 块来安全添加
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_daily_tasks_parent'
  ) THEN
    ALTER TABLE daily_tasks 
    ADD CONSTRAINT fk_daily_tasks_parent 
    FOREIGN KEY (parent_task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_daily_tasks_parent_id 
  ON daily_tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_depth 
  ON daily_tasks(depth);

-- 5. 确保所有现有任务的新字段都有默认值
UPDATE daily_tasks 
SET depth = 0
WHERE depth IS NULL;

-- 6. 验证迁移结果
SELECT 
  'Migration completed successfully!' as message,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE depth = 0) as parent_tasks,
  COUNT(*) FILTER (WHERE depth > 0) as subtasks,
  COUNT(*) FILTER (WHERE parent_task_id IS NOT NULL) as tasks_with_parent
FROM daily_tasks;

-- 7. 查看表结构确认字段已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'daily_tasks'
AND column_name IN ('depth', 'parent_task_id')
ORDER BY ordinal_position;












