-- ================================
-- 使优先级和截止时间可选
-- ================================

-- 1. 修改 priority 字段为可选（如果当前是 NOT NULL）
ALTER TABLE tasks 
ALTER COLUMN priority DROP NOT NULL;

-- 2. 修改 deadline_datetime 字段为可选（如果当前是 NOT NULL）
ALTER TABLE tasks 
ALTER COLUMN deadline_datetime DROP NOT NULL;

-- 3. 验证修改结果
SELECT 
  column_name,
  is_nullable,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name IN ('priority', 'deadline_datetime')
ORDER BY column_name;

