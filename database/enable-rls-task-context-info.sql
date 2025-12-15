-- ================================================
-- 任务上下文信息表 - 启用 RLS 权限策略
-- ================================================
-- 功能：允许用户操作自己任务的上下文信息
-- ================================================

-- 1. 启用行级安全 (RLS)
ALTER TABLE task_context_info ENABLE ROW LEVEL SECURITY;

-- 2. 创建策略：允许用户查看自己任务的上下文信息
CREATE POLICY "Users can view their own task context info"
  ON task_context_info
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM daily_tasks WHERE user_id = auth.uid()
    )
  );

-- 3. 创建策略：允许用户创建自己任务的上下文信息
CREATE POLICY "Users can create context info for their own tasks"
  ON task_context_info
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM daily_tasks WHERE user_id = auth.uid()
    )
  );

-- 4. 创建策略：允许用户更新自己任务的上下文信息
CREATE POLICY "Users can update their own task context info"
  ON task_context_info
  FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM daily_tasks WHERE user_id = auth.uid()
    )
  );

-- 5. 创建策略：允许用户删除自己任务的上下文信息
CREATE POLICY "Users can delete their own task context info"
  ON task_context_info
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM daily_tasks WHERE user_id = auth.uid()
    )
  );

-- 验证策略是否创建成功
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'task_context_info';

