-- ============================================
-- 用户交互分析表
-- ============================================
-- 用途：记录用户行为事件，用于统计分析
-- 作者：AI Task Manager Team
-- 创建日期：2026-01-13
-- ============================================

-- 1️⃣ 事件日志表
-- 注意：user_id 引用自定义 users 表，而非 auth.users
CREATE TABLE IF NOT EXISTS user_interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_events_user_date ON user_interaction_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_type ON user_interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON user_interaction_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_date ON user_interaction_events(date);

-- 添加注释
COMMENT ON TABLE user_interaction_events IS '用户交互事件日志表';
COMMENT ON COLUMN user_interaction_events.event_type IS '事件类型：message_sent, task_created, reflection_button_clicked, reflection_question_asked, reflection_question_answered, reflection_round_completed';
COMMENT ON COLUMN user_interaction_events.event_data IS '事件详细数据（JSONB格式）';
COMMENT ON COLUMN user_interaction_events.date IS '事件日期（用于按天聚合）';

-- 2️⃣ 每日统计汇总表
-- 注意：user_id 引用自定义 users 表，而非 auth.users
CREATE TABLE IF NOT EXISTS daily_user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- 📊 对话统计
  total_messages INT DEFAULT 0,
  reflection_messages INT DEFAULT 0,
  normal_messages INT DEFAULT 0,
  
  -- 📊 任务统计
  total_tasks INT DEFAULT 0,
  parent_tasks INT DEFAULT 0,
  child_tasks INT DEFAULT 0,
  
  -- 📊 交互类型统计（完成至少一次回答）
  clarity_completed INT DEFAULT 0,
  decomposition_completed INT DEFAULT 0,
  time_completed INT DEFAULT 0,
  priority_completed INT DEFAULT 0,
  
  -- 📊 响应率统计
  total_questions INT DEFAULT 0,
  answered_questions INT DEFAULT 0,
  ignored_questions INT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON daily_user_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON daily_user_analytics(date);

-- 添加注释
COMMENT ON TABLE daily_user_analytics IS '每日用户统计汇总表';
COMMENT ON COLUMN daily_user_analytics.total_messages IS '当天总消息数';
COMMENT ON COLUMN daily_user_analytics.reflection_messages IS '反思卡片消息数';
COMMENT ON COLUMN daily_user_analytics.normal_messages IS '普通对话消息数';
COMMENT ON COLUMN daily_user_analytics.clarity_completed IS '完成澄清交互的次数';

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================
-- 注意：由于本系统使用自定义 users 表而非 Supabase Auth，
-- auth.uid() 会返回 NULL，因此暂时使用宽松策略。
-- 生产环境可以根据需要添加更严格的策略。
-- ============================================

-- 先删除可能存在的旧策略
DROP POLICY IF EXISTS "Allow all operations on events" ON user_interaction_events;
DROP POLICY IF EXISTS "Allow all operations on analytics" ON daily_user_analytics;
DROP POLICY IF EXISTS "Users can view their own events" ON user_interaction_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON user_interaction_events;
DROP POLICY IF EXISTS "Users can view their own analytics" ON daily_user_analytics;
DROP POLICY IF EXISTS "Users can insert their own analytics" ON daily_user_analytics;
DROP POLICY IF EXISTS "Users can update their own analytics" ON daily_user_analytics;

-- 禁用 RLS（先禁用再启用，确保清空状态）
ALTER TABLE user_interaction_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_user_analytics DISABLE ROW LEVEL SECURITY;

-- 重新启用 RLS
ALTER TABLE user_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_user_analytics ENABLE ROW LEVEL SECURITY;

-- 🔐 事件日志表策略（允许所有操作）
CREATE POLICY "Allow all operations on events"
  ON user_interaction_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- 🔐 统计汇总表策略（允许所有操作）
CREATE POLICY "Allow all operations on analytics"
  ON daily_user_analytics FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 辅助函数（可选）
-- ============================================

-- 创建更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 daily_user_analytics 表添加触发器
DROP TRIGGER IF EXISTS update_daily_user_analytics_updated_at ON daily_user_analytics;
CREATE TRIGGER update_daily_user_analytics_updated_at
  BEFORE UPDATE ON daily_user_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 视图（方便管理员查询）
-- ============================================

-- 创建汇总视图：按用户统计
CREATE OR REPLACE VIEW user_analytics_summary AS
SELECT 
  user_id,
  COUNT(*) as total_days,
  SUM(total_messages) as total_messages,
  SUM(reflection_messages) as total_reflection_messages,
  SUM(total_tasks) as total_tasks,
  SUM(parent_tasks) as total_parent_tasks,
  SUM(child_tasks) as total_child_tasks,
  SUM(clarity_completed) as total_clarity_completed,
  SUM(decomposition_completed) as total_decomposition_completed,
  SUM(time_completed) as total_time_completed,
  SUM(priority_completed) as total_priority_completed,
  SUM(total_questions) as total_questions,
  SUM(answered_questions) as total_answered_questions,
  SUM(ignored_questions) as total_ignored_questions,
  CASE 
    WHEN SUM(total_questions) > 0 
    THEN ROUND((SUM(answered_questions)::NUMERIC / SUM(total_questions)::NUMERIC) * 100, 2)
    ELSE 0 
  END as answer_rate_percent
FROM daily_user_analytics
GROUP BY user_id;

COMMENT ON VIEW user_analytics_summary IS '按用户汇总的统计数据（管理员视图）';

-- ============================================
-- 完成
-- ============================================
