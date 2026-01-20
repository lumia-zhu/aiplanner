-- =============================================
-- 修复 RLS 策略问题
-- =============================================
-- 原因：应用使用自定义认证系统，auth.uid() 返回 null
-- 解决：禁用 RLS 或使用宽松策略
-- =============================================

-- 方案1：禁用 RLS（推荐，简单直接）
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_events DISABLE ROW LEVEL SECURITY;

-- 删除旧的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can view own events" ON user_events;
DROP POLICY IF EXISTS "Users can insert own events" ON user_events;

-- =============================================
-- 可选：如果需要基础安全性，可以使用以下策略
-- （允许所有操作，但至少有 user_id 字段约束）
-- =============================================

-- 重新启用 RLS（可选）
-- ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- 创建宽松策略（允许所有已认证的请求）
-- CREATE POLICY "Allow all for user_sessions" ON user_sessions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for user_events" ON user_events FOR ALL USING (true) WITH CHECK (true);
