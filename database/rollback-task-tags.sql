-- ============================================
-- 任务标签系统回滚脚本
-- 用途: 如果出现问题,可以回滚迁移
-- 警告: 会删除所有标签数据!请谨慎使用
-- 创建时间: 2025-01-16
-- ============================================

-- 1. 删除 tasks.tags 索引
DROP INDEX IF EXISTS idx_tasks_tags;

-- 2. 删除 tasks.tags 字段
ALTER TABLE tasks 
DROP COLUMN IF EXISTS tags;

-- 3. 删除 user_profiles.custom_task_tags 字段
ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS custom_task_tags;

-- 4. 确认回滚
DO $$
BEGIN
  -- 检查 tasks.tags 字段是否已删除
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'tags'
  ) THEN
    RAISE NOTICE '✅ tasks.tags 字段已删除';
  ELSE
    RAISE EXCEPTION '❌ tasks.tags 字段删除失败';
  END IF;

  -- 检查 user_profiles.custom_task_tags 字段是否已删除
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'custom_task_tags'
  ) THEN
    RAISE NOTICE '✅ user_profiles.custom_task_tags 字段已删除';
  ELSE
    RAISE EXCEPTION '❌ user_profiles.custom_task_tags 字段删除失败';
  END IF;

  RAISE NOTICE '🔄 标签系统已回滚,数据库恢复到之前状态';
END $$;



