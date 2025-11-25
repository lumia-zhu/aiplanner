-- ============================================
-- 添加 estimated_duration 字段到 daily_tasks 表
-- ============================================
-- 功能：支持任务时长设置功能
-- 日期：2025-11-25
-- ============================================

-- 检查字段是否存在，如果不存在则添加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_tasks' 
        AND column_name = 'estimated_duration'
    ) THEN
        ALTER TABLE daily_tasks 
        ADD COLUMN estimated_duration INTEGER DEFAULT NULL;
        
        COMMENT ON COLUMN daily_tasks.estimated_duration IS '预估时长（分钟）';
        
        RAISE NOTICE '✅ 已添加 estimated_duration 字段';
    ELSE
        RAISE NOTICE '⚠️ estimated_duration 字段已存在，跳过';
    END IF;
END $$;

-- 验证字段是否添加成功
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'daily_tasks' 
AND column_name = 'estimated_duration';

