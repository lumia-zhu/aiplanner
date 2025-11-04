-- ============================================
-- 便签持久化功能 - 数据库迁移脚本
-- ============================================
-- 功能：添加便签的全局显示和隐藏功能
-- 创建时间：2025-11-04
-- ============================================

-- 添加新字段
ALTER TABLE sticky_notes 
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true;

-- 为现有便签设置默认值（所有便签默认为全局显示且未隐藏）
UPDATE sticky_notes 
SET is_hidden = false, 
    is_global = true
WHERE is_hidden IS NULL OR is_global IS NULL;

-- 添加字段注释
COMMENT ON COLUMN sticky_notes.is_hidden IS '是否隐藏：true=已隐藏（不显示），false=正常显示';
COMMENT ON COLUMN sticky_notes.is_global IS '是否全局显示：true=不受日期限制，false=仅在特定日期显示';

-- 创建索引以优化查询性能
-- 查询可见的全局便签（最常用的查询场景）
CREATE INDEX IF NOT EXISTS idx_sticky_notes_visible 
  ON sticky_notes(user_id, is_global, is_hidden)
  WHERE is_hidden = false AND is_global = true;

-- 查询隐藏的便签（用于历史便签列表）
CREATE INDEX IF NOT EXISTS idx_sticky_notes_hidden 
  ON sticky_notes(user_id, is_hidden, updated_at DESC)
  WHERE is_hidden = true;

-- 验证迁移结果
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sticky_notes'
  AND column_name IN ('is_hidden', 'is_global', 'created_at', 'updated_at')
ORDER BY ordinal_position;

