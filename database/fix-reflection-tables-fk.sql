-- ============================================
-- 修复 plan_snapshots 和 reflection_sessions 表的外键约束
-- 将 auth.users 改为 public.users
-- ============================================

-- 1. 删除旧的外键约束
ALTER TABLE plan_snapshots DROP CONSTRAINT IF EXISTS plan_snapshots_user_id_fkey;
ALTER TABLE reflection_sessions DROP CONSTRAINT IF EXISTS reflection_sessions_user_id_fkey;

-- 2. 添加新的外键约束（引用 public.users 表）
ALTER TABLE plan_snapshots 
  ADD CONSTRAINT plan_snapshots_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE reflection_sessions 
  ADD CONSTRAINT reflection_sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 验证
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('plan_snapshots', 'reflection_sessions');

