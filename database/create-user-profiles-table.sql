-- 创建用户个人资料表
-- 用于存储用户的专业、年级、挑战和工作场所等个性化信息

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 基本信息
  major VARCHAR(100),              -- 专业 (如: 计算机科学、心理学等)
  grade VARCHAR(50),               -- 年级 (本科: 大一~大四, 硕士: 硕一~硕三, 博士: 博一~博五)
  
  -- 个性化标签 (使用 TEXT[] 数组类型)
  challenges TEXT[] DEFAULT '{}',   -- 挑战标签 (如: 拖延、夜猫子、容易分心等)
  workplaces TEXT[] DEFAULT '{}',   -- 工作场所标签 (如: 教室、图书馆、咖啡厅等)
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户只有一条个人资料记录
  UNIQUE(user_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 添加注释
COMMENT ON TABLE user_profiles IS '用户个人资料表,存储专业、年级、挑战和工作场所等信息';
COMMENT ON COLUMN user_profiles.major IS '用户的专业';
COMMENT ON COLUMN user_profiles.grade IS '用户的年级 (大一~大四/硕一~硕三/博一~博五)';
COMMENT ON COLUMN user_profiles.challenges IS '用户的挑战标签数组';
COMMENT ON COLUMN user_profiles.workplaces IS '用户的工作场所标签数组';

-- 创建更新时间的触发器
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();



