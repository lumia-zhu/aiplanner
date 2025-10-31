-- ============================================
-- 修复 daily_tasks 表的 RLS 策略
-- ============================================
-- 问题：策略冲突导致无法插入数据
-- 解决方案：删除旧策略，创建正确的策略
-- ============================================

-- 1. 删除所有现有策略
DROP POLICY IF EXISTS "用户只能访问自己的任务" ON daily_tasks;
DROP POLICY IF EXISTS "用户可以创建自己的任务" ON daily_tasks;
DROP POLICY IF EXISTS "用户可以更新自己的任务" ON daily_tasks;
DROP POLICY IF EXISTS "用户可以删除自己的任务" ON daily_tasks;

-- 2. 创建新的策略（参考 sticky_notes 的成功模式）

-- SELECT 策略
CREATE POLICY "用户可以查看自己的任务"
  ON daily_tasks
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 策略
CREATE POLICY "用户可以创建任务"
  ON daily_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE 策略
CREATE POLICY "用户可以更新任务"
  ON daily_tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 策略
CREATE POLICY "用户可以删除任务"
  ON daily_tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 验证策略
-- ============================================

-- 查看所有策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'daily_tasks';

-- ============================================
-- 说明
-- ============================================

-- 修复要点：
-- 1. 不要使用 FOR ALL，应该分别定义 SELECT/INSERT/UPDATE/DELETE
-- 2. INSERT 策略只需要 WITH CHECK
-- 3. UPDATE 策略需要 USING 和 WITH CHECK
-- 4. SELECT 和 DELETE 策略只需要 USING

