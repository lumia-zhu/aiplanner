-- 用户个人资料示例数据
-- 注意: 执行前请确保 users 表中已有对应的用户记录

-- 示例 1: 计算机专业的大三学生
-- INSERT INTO user_profiles (user_id, major, grade, challenges, workplaces) 
-- VALUES (
--   'your-user-id-here',  -- 替换为实际的用户 ID
--   '计算机科学与技术',
--   '大三',
--   ARRAY['拖延', '夜猫子'],
--   ARRAY['图书馆', '咖啡厅']
-- );

-- 示例 2: 心理学专业的硕一学生
-- INSERT INTO user_profiles (user_id, major, grade, challenges, workplaces) 
-- VALUES (
--   'your-user-id-here',  -- 替换为实际的用户 ID
--   '应用心理学',
--   '硕一',
--   ARRAY['完美主义', '容易分心'],
--   ARRAY['实验室', '自习室']
-- );

-- 示例 3: 物理学专业的博二学生
-- INSERT INTO user_profiles (user_id, major, grade, challenges, workplaces) 
-- VALUES (
--   'your-user-id-here',  -- 替换为实际的用户 ID
--   '理论物理',
--   '博二',
--   ARRAY['时间估算不准', '优先级不清'],
--   ARRAY['工位', '家里']
-- );

-- 查询用户个人资料
-- SELECT * FROM user_profiles WHERE user_id = 'your-user-id-here';

-- 更新用户个人资料
-- UPDATE user_profiles 
-- SET major = '软件工程', 
--     grade = '大四',
--     challenges = ARRAY['拖延'],
--     workplaces = ARRAY['图书馆', '宿舍']
-- WHERE user_id = 'your-user-id-here';

-- 删除用户个人资料
-- DELETE FROM user_profiles WHERE user_id = 'your-user-id-here';








