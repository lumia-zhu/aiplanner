-- ============================================
-- 修复 notes 表的外键约束
-- ============================================
-- 问题：外键指向 auth.users，但项目使用自定义 users 表
-- 解决：删除旧外键，添加指向 users 表的新外键
-- ============================================

-- 1. 删除旧的外键约束
ALTER TABLE notes 
DROP CONSTRAINT IF EXISTS notes_user_id_fkey;

-- 2. 添加新的外键，指向自定义 users 表
ALTER TABLE notes
ADD CONSTRAINT notes_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 3. 验证外键
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'notes' 
  AND tc.constraint_type = 'FOREIGN KEY';

