-- ============================================
-- 禁用 RLS，使 plan_snapshots 和 reflection_sessions 表
-- 与其他表保持一致（Unrestricted）
-- ============================================

-- 禁用 RLS
ALTER TABLE plan_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_sessions DISABLE ROW LEVEL SECURITY;

-- 删除之前创建的策略（如果存在）
DROP POLICY IF EXISTS "Users can view own plan_snapshots" ON plan_snapshots;
DROP POLICY IF EXISTS "Users can insert own plan_snapshots" ON plan_snapshots;
DROP POLICY IF EXISTS "Users can update own plan_snapshots" ON plan_snapshots;
DROP POLICY IF EXISTS "Users can delete own plan_snapshots" ON plan_snapshots;

DROP POLICY IF EXISTS "Users can view own reflection_sessions" ON reflection_sessions;
DROP POLICY IF EXISTS "Users can insert own reflection_sessions" ON reflection_sessions;
DROP POLICY IF EXISTS "Users can update own reflection_sessions" ON reflection_sessions;
DROP POLICY IF EXISTS "Users can delete own reflection_sessions" ON reflection_sessions;

