-- ============================================
-- 临时禁用所有任务相关表的 RLS
-- ============================================
-- ⚠️ 注意：这只是临时方案，用于测试功能
-- 用于快速开发，和 sticky_notes 保持一致（也没有 RLS）
-- ============================================

-- 1. 禁用 daily_tasks 的 RLS
ALTER TABLE daily_tasks DISABLE ROW LEVEL SECURITY;

-- 2. 禁用 task_matrix 的 RLS
ALTER TABLE task_matrix DISABLE ROW LEVEL SECURITY;

-- 3. 验证所有表的 RLS 状态
SELECT 
  tablename,
  rowsecurity as "RLS已启用"
FROM pg_tables
WHERE tablename IN ('daily_tasks', 'task_matrix', 'sticky_notes', 'notes')
ORDER BY tablename;

-- ============================================
-- 预期结果：所有表都应该是 false（已禁用/未启用）
-- ============================================
-- daily_tasks    | false
-- notes          | false
-- sticky_notes   | false
-- task_matrix    | false
-- ============================================

-- 4. 可选：查看现有数据
-- SELECT COUNT(*) as "任务数" FROM daily_tasks;
-- SELECT COUNT(*) as "矩阵记录数" FROM task_matrix;

