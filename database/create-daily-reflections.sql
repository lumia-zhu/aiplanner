-- ================================================================
-- 每日反思功能数据库表
-- ================================================================
-- 创建时间：2025-12-09
-- 用途：存储用户每日反思的问题和回答
-- 特性：
--   1. 每个用户每天只能有一条反思记录
--   2. 支持中断恢复（记录当前问题索引）
--   3. 存储3个问题和对应的回答
--   4. 存储AI生成的总结
-- ================================================================

-- 1️⃣ 创建每日反思表
CREATE TABLE IF NOT EXISTS daily_reflections (
  -- 主键
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 用户关联
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 反思日期（YYYY-MM-DD格式）
  date DATE NOT NULL,
  
  -- 问题1
  question_1 TEXT NOT NULL,
  answer_1 TEXT,
  
  -- 问题2
  question_2 TEXT NOT NULL,
  answer_2 TEXT,
  
  -- 问题3
  question_3 TEXT NOT NULL,
  answer_3 TEXT,
  
  -- AI生成的总结
  ai_summary TEXT,
  
  -- 状态跟踪
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  
  -- 当前问题索引（0=未开始，1-3=对应问题，3=全部完成）
  current_question_index INT DEFAULT 0 CHECK (current_question_index >= 0 AND current_question_index <= 3),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 唯一约束：每个用户每天只能有一条反思记录
  CONSTRAINT unique_user_daily_reflection UNIQUE(user_id, date)
);

-- 2️⃣ 创建索引
-- 用于快速查询某用户的反思记录（按日期倒序）
CREATE INDEX IF NOT EXISTS idx_daily_reflections_user_date 
  ON daily_reflections(user_id, date DESC);

-- 用于快速查询进行中的反思
CREATE INDEX IF NOT EXISTS idx_daily_reflections_status 
  ON daily_reflections(user_id, status) 
  WHERE status = 'in_progress';

-- 3️⃣ 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_daily_reflections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_daily_reflections_updated_at ON daily_reflections;

CREATE TRIGGER trigger_update_daily_reflections_updated_at
  BEFORE UPDATE ON daily_reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reflections_updated_at();

-- 4️⃣ 添加注释
COMMENT ON TABLE daily_reflections IS '每日反思记录表，存储用户每天的任务回顾和情绪状态';
COMMENT ON COLUMN daily_reflections.id IS '主键UUID';
COMMENT ON COLUMN daily_reflections.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN daily_reflections.date IS '反思日期';
COMMENT ON COLUMN daily_reflections.question_1 IS '第一个反思问题';
COMMENT ON COLUMN daily_reflections.answer_1 IS '第一个问题的回答';
COMMENT ON COLUMN daily_reflections.question_2 IS '第二个反思问题';
COMMENT ON COLUMN daily_reflections.answer_2 IS '第二个问题的回答';
COMMENT ON COLUMN daily_reflections.question_3 IS '第三个反思问题';
COMMENT ON COLUMN daily_reflections.answer_3 IS '第三个问题的回答';
COMMENT ON COLUMN daily_reflections.ai_summary IS 'AI根据回答生成的总结和反馈';
COMMENT ON COLUMN daily_reflections.status IS '反思状态：in_progress=进行中，completed=已完成';
COMMENT ON COLUMN daily_reflections.current_question_index IS '当前问题索引，用于中断恢复（0=未开始，1-3=对应问题）';
COMMENT ON COLUMN daily_reflections.created_at IS '创建时间';
COMMENT ON COLUMN daily_reflections.updated_at IS '最后更新时间';

-- ================================================================
-- 执行完成
-- ================================================================
-- 验证方式：
--   SELECT tablename FROM pg_tables WHERE tablename = 'daily_reflections';
--   \d daily_reflections
-- ================================================================













