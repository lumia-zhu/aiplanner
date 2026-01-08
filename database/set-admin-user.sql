-- ============================================
-- 设置管理员账号
-- ============================================
-- 使用方法：
-- 1. 先查询你的 user_id
-- 2. 把下面的 'YOUR_USER_ID' 替换成你的实际 user_id
-- 3. 执行 UPDATE 语句
-- ============================================

-- 步骤 1：查询所有用户（找到你的 user_id）
SELECT 
  up.user_id,
  up.role,
  u.username,
  up.created_at
FROM user_profiles up
LEFT JOIN users u ON up.user_id = u.id
ORDER BY up.created_at DESC
LIMIT 20;

-- 步骤 2：设置管理员（替换 YOUR_USER_ID）
-- UPDATE user_profiles 
-- SET role = 'admin' 
-- WHERE user_id = 'YOUR_USER_ID';

-- 步骤 3：验证设置成功
-- SELECT user_id, role FROM user_profiles WHERE role = 'admin';
