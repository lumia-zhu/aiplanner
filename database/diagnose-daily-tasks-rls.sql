-- ============================================
-- 诊断 daily_tasks RLS 问题
-- ============================================

-- 1. 检查当前登录用户
SELECT 
  auth.uid() as "当前用户ID",
  auth.role() as "当前角色";

-- 2. 查看 daily_tasks 表的 RLS 状态
SELECT 
  tablename,
  rowsecurity as "RLS已启用"
FROM pg_tables
WHERE tablename = 'daily_tasks';

-- 3. 查看所有 RLS 策略
SELECT 
  policyname as "策略名称",
  cmd as "命令",
  qual as "USING条件",
  with_check as "WITH_CHECK条件"
FROM pg_policies
WHERE tablename = 'daily_tasks'
ORDER BY cmd;

-- 4. 测试插入（手动执行，替换 YOUR_USER_ID）
-- INSERT INTO daily_tasks (user_id, title, date, note_date)
-- VALUES (
--   auth.uid(),  -- 使用当前登录用户
--   '测试任务',
--   '2025-10-31',
--   '2025-10-31'
-- );

-- 5. 查看现有数据
SELECT 
  id,
  user_id,
  title,
  date,
  completed
FROM daily_tasks
LIMIT 5;

-- 6. 对比 sticky_notes 的策略（参考工作的表）
SELECT 
  policyname as "策略名称",
  cmd as "命令",
  qual as "USING条件",
  with_check as "WITH_CHECK条件"
FROM pg_policies
WHERE tablename = 'sticky_notes'
ORDER BY cmd;

-- ============================================
-- 临时禁用 RLS 测试（仅用于调试！）
-- ============================================
-- ⚠️ 警告：这将暴露所有数据，仅用于测试！

-- 禁用 RLS
-- ALTER TABLE daily_tasks DISABLE ROW LEVEL SECURITY;

-- 重新启用 RLS
-- ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

