-- ================================
-- 验证时间估计字段迁移结果
-- ================================

-- 1. 检查字段类型
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks' 
  AND column_name IN ('estimated_duration', 'estimated_duration_old')
ORDER BY column_name;

-- 2. 检查约束
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND conname LIKE '%estimated_duration%';

-- 3. 检查索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
  AND indexdef LIKE '%estimated_duration%';

-- 4. 统计数据
SELECT 
  '📊 数据统计' as section,
  COUNT(*) as total_tasks,
  COUNT(estimated_duration) as with_new_estimation,
  COUNT(estimated_duration_old) as with_old_estimation,
  COUNT(*) FILTER (WHERE estimated_duration IS NULL AND estimated_duration_old IS NOT NULL) as conversion_failed,
  ROUND(AVG(estimated_duration), 2) as avg_minutes,
  MIN(estimated_duration) as min_minutes,
  MAX(estimated_duration) as max_minutes
FROM tasks;

-- 5. 检查转换失败的记录（需要手动处理）
SELECT 
  '❌ 转换失败的记录' as section,
  id,
  title,
  estimated_duration_old as original_value,
  '需要手动处理' as note
FROM tasks
WHERE estimated_duration IS NULL 
  AND estimated_duration_old IS NOT NULL
LIMIT 10;

-- 6. 检查成功转换的样本
SELECT 
  '✅ 转换成功的样本' as section,
  title,
  estimated_duration_old as old_format,
  estimated_duration as new_minutes,
  CASE 
    WHEN estimated_duration < 60 THEN estimated_duration || '分钟'
    WHEN estimated_duration % 60 = 0 THEN (estimated_duration / 60) || '小时'
    ELSE (estimated_duration / 60) || '小时' || (estimated_duration % 60) || '分钟'
  END as formatted
FROM tasks
WHERE estimated_duration IS NOT NULL
ORDER BY estimated_duration
LIMIT 10;

-- 7. 检查buffer标记的数据（10000+）
SELECT 
  '🔖 含Buffer的任务' as section,
  COUNT(*) as count,
  MIN(estimated_duration) as min_value,
  MAX(estimated_duration) as max_value
FROM tasks
WHERE estimated_duration >= 10000;

-- 8. 数据完整性检查
SELECT 
  '✅ 迁移验证完成' as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tasks' 
        AND column_name = 'estimated_duration' 
        AND data_type = 'integer'
    ) THEN '✅ 字段类型正确'
    ELSE '❌ 字段类型错误'
  END as type_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'tasks'::regclass 
        AND conname = 'estimated_duration_positive'
    ) THEN '✅ 约束已创建'
    ELSE '❌ 约束缺失'
  END as constraint_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'tasks' 
        AND indexname = 'idx_tasks_estimated_duration'
    ) THEN '✅ 索引已创建'
    ELSE '❌ 索引缺失'
  END as index_check;







