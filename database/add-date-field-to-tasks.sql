-- ============================================
-- 数据库迁移：为 tasks 表添加 date 字段
-- ============================================
-- 功能：添加 date 字段用于标记任务属于哪一天
-- 用途：支持任务矩阵按日期筛选任务
-- 创建时间：2025-10-31
-- ============================================

-- 1. 添加 date 字段（TEXT 类型，格式：YYYY-MM-DD）
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS date TEXT;

-- 2. 为现有任务设置默认日期（使用今天的日期）
UPDATE tasks 
SET date = TO_CHAR(NOW(), 'YYYY-MM-DD')
WHERE date IS NULL;

-- 3. 设置 date 字段为 NOT NULL（在更新现有数据后）
ALTER TABLE tasks 
ALTER COLUMN date SET NOT NULL;

-- 4. 设置 date 字段的默认值为今天
ALTER TABLE tasks 
ALTER COLUMN date SET DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD');

-- 5. 创建索引以优化按日期查询
CREATE INDEX IF NOT EXISTS idx_tasks_date 
ON tasks(date);

-- 6. 创建复合索引（用户+日期）用于快速查询
CREATE INDEX IF NOT EXISTS idx_tasks_user_date 
ON tasks(user_id, date);

-- ============================================
-- 验证
-- ============================================

-- 验证字段已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'date';

-- 查看示例数据
-- SELECT id, title, date, deadline_datetime, created_at
-- FROM tasks
-- LIMIT 5;

-- ============================================
-- 说明
-- ============================================

-- date 字段说明：
-- - 格式：YYYY-MM-DD（如：2025-10-31）
-- - 用途：标记任务属于哪一天的笔记
-- - 与 deadline_datetime 的区别：
--   * date: 任务所属的日期（必填）
--   * deadline_datetime: 任务的具体截止时间（可选）

-- 示例：
-- 2025-10-31 的任务，截止时间是 18:00
-- - date: '2025-10-31'
-- - deadline_datetime: '2025-10-31T18:00:00Z'

