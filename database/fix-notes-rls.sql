-- ============================================
-- 修复 notes 表的 RLS 策略
-- ============================================
-- 问题：原策略使用 auth.uid()，但项目使用自定义认证
-- 解决：暂时禁用 RLS，允许客户端直接访问
-- ============================================

-- 方案1：禁用 RLS（开发环境推荐）
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;

-- 方案2：如果需要启用 RLS，使用以下策略
-- 注意：这会允许所有已登录用户访问所有笔记
-- DROP POLICY IF EXISTS "Enable all access for authenticated users" ON notes;
-- CREATE POLICY "Enable all access for authenticated users"
--   ON notes
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- 验证
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'notes';
