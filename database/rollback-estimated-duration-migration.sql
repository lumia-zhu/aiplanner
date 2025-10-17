-- ================================
-- 回滚时间估计字段迁移
-- 将 estimated_duration 从 INTEGER 恢复为 TEXT
-- ================================

-- 警告：仅在迁移出现问题时使用此脚本！

-- 步骤1：检查是否存在备份字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name = 'estimated_duration_old'
  ) THEN
    RAISE EXCEPTION '❌ 备份字段 estimated_duration_old 不存在，无法回滚！';
  END IF;
END $$;

-- 步骤2：删除新字段（INTEGER类型）
ALTER TABLE tasks 
DROP COLUMN IF EXISTS estimated_duration CASCADE;

-- 步骤3：恢复旧字段名
ALTER TABLE tasks 
RENAME COLUMN estimated_duration_old TO estimated_duration;

-- 步骤4：验证回滚结果
SELECT 
  '✅ Rollback completed!' as status,
  COUNT(*) as total_tasks,
  COUNT(estimated_duration) as tasks_with_estimation,
  pg_typeof(estimated_duration) as column_type
FROM tasks;

-- 步骤5：显示恢复的数据样本
SELECT 
  id,
  title,
  estimated_duration
FROM tasks
WHERE estimated_duration IS NOT NULL
LIMIT 10;

COMMENT ON COLUMN tasks.estimated_duration IS '预估执行时长（文本格式，如"2小时"、"120分钟"）';


