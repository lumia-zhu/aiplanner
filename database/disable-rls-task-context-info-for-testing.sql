-- ================================================
-- 临时关闭 RLS - 仅用于测试
-- ================================================
-- ⚠️ 警告：这会让所有用户都能访问所有数据
-- ⚠️ 仅在开发环境测试时使用，生产环境请使用 enable-rls-task-context-info.sql
-- ================================================

-- 方案1: 完全关闭 RLS（最简单，但不安全）
ALTER TABLE task_context_info DISABLE ROW LEVEL SECURITY;

-- 方案2: 启用 RLS 但允许所有操作（稍微安全一点）
-- ALTER TABLE task_context_info ENABLE ROW LEVEL SECURITY;
-- 
-- -- 删除现有策略
-- DROP POLICY IF EXISTS "Allow all for testing" ON task_context_info;
-- 
-- -- 创建允许所有操作的策略
-- CREATE POLICY "Allow all for testing"
--   ON task_context_info
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- 验证 RLS 状态
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'task_context_info';


