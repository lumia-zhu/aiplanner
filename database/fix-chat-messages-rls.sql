-- 修复 chat_messages 表的 RLS 问题
-- 由于使用自定义认证（不是 Supabase Auth），需要禁用 RLS

-- 1. 禁用 RLS
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 2. 删除已创建的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON chat_messages;

-- 3. 验证 RLS 状态
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'chat_messages';




