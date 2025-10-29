-- ============================================
-- 修复 notes 表的 RLS 策略
-- ============================================
-- 问题：自定义认证系统使用 localStorage 存储用户ID
-- 解决：暂时禁用 RLS 或使用宽松策略
-- ============================================

-- 方案1：暂时禁用 RLS（开发测试用）
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;

-- 或者

-- 方案2：使用宽松策略（允许所有操作，但仍需登录）
-- DROP POLICY IF EXISTS "Users can only access their own notes" ON notes;
-- 
-- CREATE POLICY "Allow all operations for authenticated users"
--   ON notes
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- 验证
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'notes';


