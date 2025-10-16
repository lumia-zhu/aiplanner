-- ============================================
-- 任务标签系统数据库迁移
-- 功能: 为任务添加标签支持,支持用户自定义标签
-- 兼容性: 完全向后兼容,不影响现有数据
-- 创建时间: 2025-01-16
-- ============================================

-- 1. 为 tasks 表添加 tags 字段
-- 存储该任务的标签列表(最多3个)
-- DEFAULT '{}' 确保老数据自动获得空数组
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. 为 tasks.tags 创建 GIN 索引(便于按标签查询和筛选)
-- GIN 索引专门用于数组类型的高效查询
CREATE INDEX IF NOT EXISTS idx_tasks_tags 
ON tasks USING GIN(tags);

-- 3. 为 user_profiles 表添加 custom_task_tags 字段
-- 存储用户创建的自定义标签池(最多20个)
-- 用户添加新标签时会更新这个字段
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS custom_task_tags TEXT[] DEFAULT '{}';

-- 4. 验证迁移结果
DO $$
BEGIN
  -- 检查 tasks.tags 字段是否添加成功
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'tags'
  ) THEN
    RAISE NOTICE '✅ tasks.tags 字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ tasks.tags 字段添加失败';
  END IF;

  -- 检查 user_profiles.custom_task_tags 字段是否添加成功
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'custom_task_tags'
  ) THEN
    RAISE NOTICE '✅ user_profiles.custom_task_tags 字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ user_profiles.custom_task_tags 字段添加失败';
  END IF;

  RAISE NOTICE '🎉 数据库迁移完成!所有现有数据保持不变。';
END $$;

-- 5. 显示迁移统计
SELECT 
  '现有任务数' as metric,
  COUNT(*) as count
FROM tasks
UNION ALL
SELECT 
  '现有用户数' as metric,
  COUNT(*) as count
FROM user_profiles;

-- 6. 查看字段信息
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'tags'
UNION ALL
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'custom_task_tags';



