-- 添加每日反思提醒时间字段到 user_profiles 表
-- 执行时间: 2025-01-XX
-- 用途: 允许用户设置每日反思提醒时间（可选）

-- 添加字段
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS daily_reflection_time TIME;

-- 添加注释
COMMENT ON COLUMN user_profiles.daily_reflection_time IS '每日反思提醒时间（HH:mm 格式，可选）';

-- 验证字段添加
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'daily_reflection_time';

