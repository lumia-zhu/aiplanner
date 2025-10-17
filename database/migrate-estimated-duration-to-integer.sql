-- ================================
-- 时间估计字段标准化迁移
-- 将 estimated_duration 从 TEXT 改为 INTEGER（分钟数）
-- ================================

-- 步骤1：添加临时字段用于存储转换后的分钟数
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- 步骤2：迁移现有数据（尝试解析常见格式）
-- 注意：无法解析的数据将保留为 NULL
UPDATE tasks 
SET estimated_minutes = CASE
  -- 格式1：纯数字（假设是分钟）
  WHEN estimated_duration ~ '^\d+$' THEN 
    CAST(estimated_duration AS INTEGER)
  
  -- 格式2：X小时
  WHEN estimated_duration ~ '^\d+小时$' THEN 
    CAST(regexp_replace(estimated_duration, '小时', '') AS INTEGER) * 60
  
  -- 格式3：X分钟 或 X分
  WHEN estimated_duration ~ '^\d+分钟?$' THEN 
    CAST(regexp_replace(estimated_duration, '分钟?', '') AS INTEGER)
  
  -- 格式4：Xh
  WHEN estimated_duration ~ '^\d+h$' THEN 
    CAST(regexp_replace(estimated_duration, 'h', '') AS INTEGER) * 60
  
  -- 格式5：Xmin
  WHEN estimated_duration ~ '^\d+min$' THEN 
    CAST(regexp_replace(estimated_duration, 'min', '') AS INTEGER)
  
  -- 格式6：X小时Y分钟
  WHEN estimated_duration ~ '^\d+小时\d+分钟$' THEN
    CAST(regexp_replace(regexp_replace(estimated_duration, '(\d+)小时.*', '\1'), '\D', '') AS INTEGER) * 60 +
    CAST(regexp_replace(regexp_replace(estimated_duration, '.*小时(\d+)分钟', '\1'), '\D', '') AS INTEGER)
  
  -- 其他格式：保留为 NULL
  ELSE NULL
END
WHERE estimated_duration IS NOT NULL;

-- 步骤3：备份旧字段（可选，用于数据恢复）
ALTER TABLE tasks 
RENAME COLUMN estimated_duration TO estimated_duration_old;

-- 步骤4：将新字段重命名为原字段名
ALTER TABLE tasks 
RENAME COLUMN estimated_minutes TO estimated_duration;

-- 步骤5：添加约束（确保值为正数）
ALTER TABLE tasks 
ADD CONSTRAINT estimated_duration_positive 
CHECK (estimated_duration IS NULL OR estimated_duration > 0);

-- 步骤6：添加索引（用于查询优化）
CREATE INDEX IF NOT EXISTS idx_tasks_estimated_duration 
ON tasks(estimated_duration) 
WHERE estimated_duration IS NOT NULL;

-- 步骤7：添加注释
COMMENT ON COLUMN tasks.estimated_duration IS '预估执行时长（分钟数）。10000+表示含buffer，如10120表示100分钟+20%buffer';

-- 步骤8：验证迁移结果
SELECT 
  '✅ Migration completed!' as status,
  COUNT(*) as total_tasks,
  COUNT(estimated_duration) as tasks_with_estimation,
  COUNT(estimated_duration_old) as tasks_with_old_format,
  COUNT(estimated_duration_old) FILTER (WHERE estimated_duration IS NULL) as failed_conversions,
  AVG(estimated_duration) as avg_estimated_minutes,
  MIN(estimated_duration) as min_minutes,
  MAX(estimated_duration) as max_minutes
FROM tasks;

-- 步骤9：显示迁移详情（可选）
SELECT 
  estimated_duration_old as old_format,
  estimated_duration as new_format_minutes,
  CASE 
    WHEN estimated_duration IS NULL AND estimated_duration_old IS NOT NULL THEN '❌ 转换失败'
    WHEN estimated_duration IS NOT NULL THEN '✅ 转换成功'
    ELSE '⚪ 无数据'
  END as conversion_status
FROM tasks
WHERE estimated_duration_old IS NOT NULL
LIMIT 20;

-- 注意事项：
-- 1. 执行此脚本前建议先备份数据库
-- 2. estimated_duration_old 字段保留作为备份，可以在确认无误后手动删除
-- 3. 如果发现转换失败的数据，可以通过 estimated_duration_old 恢复
-- 4. 删除备份字段的命令（确认无误后再执行）：
--    ALTER TABLE tasks DROP COLUMN IF EXISTS estimated_duration_old;

