-- ================================
-- 简单的任务拆解功能数据库迁移
-- 仅添加必要字段，保持兼容性
-- ================================

-- 1. 为tasks表添加父子任务关系字段
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS parent_id UUID,
ADD COLUMN IF NOT EXISTS subtask_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration TEXT,
ADD COLUMN IF NOT EXISTS is_expanded BOOLEAN DEFAULT false;

-- 2. 添加外键约束（父任务删除时，子任务也删除）
ALTER TABLE tasks 
ADD CONSTRAINT fk_tasks_parent 
FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- 3. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_parent ON tasks(user_id, parent_id);

-- 4. 确保所有现有任务的新字段都有默认值
UPDATE tasks 
SET 
  subtask_order = 0,
  is_expanded = false
WHERE subtask_order IS NULL OR is_expanded IS NULL;

-- 5. 验证迁移结果
SELECT 
  'Migration completed successfully!' as message,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE parent_id IS NULL) as parent_tasks,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) as subtasks
FROM tasks;
