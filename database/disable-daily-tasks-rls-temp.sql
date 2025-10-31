-- ============================================
-- 临时禁用 daily_tasks 的 RLS
-- ============================================
-- ⚠️ 注意：这只是临时方案，用于测试功能
-- 生产环境应该正确配置 RLS 策略
-- ============================================

-- 禁用 RLS
ALTER TABLE daily_tasks DISABLE ROW LEVEL SECURITY;

-- 验证 RLS 状态
SELECT 
  tablename,
  rowsecurity as "RLS已启用"
FROM pg_tables
WHERE tablename IN ('daily_tasks', 'sticky_notes');

-- 结果应该显示：
-- daily_tasks: false (已禁用)
-- sticky_notes: false (未启用)


