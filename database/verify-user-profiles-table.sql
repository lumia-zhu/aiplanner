-- 验证用户个人资料表是否正确创建
-- 在 Supabase SQL Editor 中执行此文件以验证表结构

-- ==========================================
-- 1. 检查表是否存在
-- ==========================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'user_profiles'
    ) THEN '✅ 表 user_profiles 已创建'
    ELSE '❌ 表 user_profiles 不存在'
  END AS table_check;

-- ==========================================
-- 2. 查看表结构
-- ==========================================
SELECT 
  column_name AS "字段名", 
  data_type AS "数据类型",
  character_maximum_length AS "最大长度",
  is_nullable AS "可为空",
  column_default AS "默认值"
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ==========================================
-- 3. 检查索引
-- ==========================================
SELECT 
  indexname AS "索引名", 
  indexdef AS "索引定义"
FROM pg_indexes 
WHERE tablename = 'user_profiles';

-- ==========================================
-- 4. 检查触发器
-- ==========================================
SELECT 
  trigger_name AS "触发器名", 
  event_manipulation AS "触发事件",
  action_statement AS "执行语句"
FROM information_schema.triggers
WHERE event_object_table = 'user_profiles';

-- ==========================================
-- 5. 检查外键约束
-- ==========================================
SELECT
  tc.constraint_name AS "约束名",
  kcu.column_name AS "列名",
  ccu.table_name AS "引用表",
  ccu.column_name AS "引用列"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'user_profiles' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- ==========================================
-- 6. 检查唯一约束
-- ==========================================
SELECT
  tc.constraint_name AS "约束名",
  kcu.column_name AS "列名"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_profiles' 
  AND tc.constraint_type = 'UNIQUE';

-- ==========================================
-- 7. 测试插入和查询 (可选)
-- ==========================================
-- 注意: 取消注释前请先获取你的实际用户 ID

-- 获取当前登录用户的 ID
-- SELECT id, email, username FROM users LIMIT 5;

-- 测试插入 (请替换 'your-user-id-here' 为实际的用户 ID)
/*
INSERT INTO user_profiles (user_id, major, grade, challenges, workplaces) 
VALUES (
  'your-user-id-here',
  '计算机科学',
  '大三',
  ARRAY['拖延', '夜猫子'],
  ARRAY['图书馆', '咖啡厅']
)
ON CONFLICT (user_id) DO NOTHING;
*/

-- 查询测试数据
-- SELECT * FROM user_profiles;

-- 清理测试数据 (可选)
-- DELETE FROM user_profiles WHERE user_id = 'your-user-id-here';












