-- =============================================
-- 用户事件数据收集表
-- 创建日期: 2026-01-20
-- 用途: 记录用户的所有操作行为，支持行为分析和研究
-- =============================================

-- =============================================
-- 1. 用户会话表 (user_sessions)
-- =============================================
-- 记录用户每次使用的会话信息（从打开到关闭）

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY,                           -- 会话ID（前端生成）
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 会话时间
  started_at TIMESTAMPTZ NOT NULL,               -- 会话开始时间
  ended_at TIMESTAMPTZ,                          -- 会话结束时间（可能为空）
  
  -- 会话统计
  duration_ms INTEGER,                           -- 总时长（毫秒）
  events_count INTEGER DEFAULT 0,                -- 事件数量
  
  -- 设备信息
  device_info JSONB DEFAULT '{}'::jsonb,         -- 设备信息（user_agent 等）
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at DESC);

-- =============================================
-- 2. 用户事件表 (user_events)
-- =============================================
-- 记录用户的每一个操作动作

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- === 用户和会话 ===
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  
  -- === 事件标识（两级分类） ===
  event_category VARCHAR(30) NOT NULL,           -- 大类: task/reflection/navigation/chat/daily_review/session/system
  event_action VARCHAR(30) NOT NULL,             -- 动作: created/completed/moved/answered/skipped...
  
  -- === 操作对象 ===
  entity_type VARCHAR(30),                       -- 对象类型: task/question/note/matrix/message
  entity_id UUID,                                -- 对象ID（可选）
  entity_title VARCHAR(500),                     -- 对象标题（方便分析时直接查看）
  
  -- === 上下文 ===
  context_date DATE NOT NULL,                    -- 用户选择的日期（业务日期）
  view_mode VARCHAR(20),                         -- 当前视图: notes/matrix
  
  -- === 时间相关 ===
  created_at TIMESTAMPTZ DEFAULT NOW(),          -- 事件发生时间
  duration_ms INTEGER,                           -- 操作耗时（毫秒）
  
  -- === 扩展数据 ===
  metadata JSONB DEFAULT '{}'::jsonb,            -- 灵活的扩展数据
  
  -- === 约束 ===
  CONSTRAINT valid_event_category CHECK (event_category IN (
    'task',           -- 任务操作
    'reflection',     -- 反思交互
    'navigation',     -- 导航切换
    'chat',           -- 聊天消息
    'daily_review',   -- 每日回顾
    'session',        -- 会话生命周期
    'system'          -- 系统事件
  ))
);

-- 索引（按查询频率设计）
CREATE INDEX IF NOT EXISTS idx_user_events_user_date ON user_events(user_id, context_date);
CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_category ON user_events(event_category, event_action);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_entity ON user_events(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- =============================================
-- 3. RLS 策略（行级安全）
-- =============================================
-- 注意：本应用使用自定义认证系统（非 Supabase Auth）
-- 因此禁用 RLS，通过应用层保证数据隔离

-- 禁用 RLS（因为 auth.uid() 在自定义认证下返回 null）
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_events DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. 注释
-- =============================================

COMMENT ON TABLE user_sessions IS '用户会话表 - 记录每次使用的会话信息';
COMMENT ON TABLE user_events IS '用户事件表 - 记录用户的所有操作行为';

COMMENT ON COLUMN user_events.event_category IS '事件大类: task/reflection/navigation/chat/daily_review/session/system';
COMMENT ON COLUMN user_events.event_action IS '具体动作: created/completed/moved/answered/skipped 等';
COMMENT ON COLUMN user_events.entity_type IS '操作对象类型: task/question/note/matrix/message';
COMMENT ON COLUMN user_events.context_date IS '业务日期（用户选择的日期）';
COMMENT ON COLUMN user_events.duration_ms IS '操作耗时（毫秒），用于分析用户思考时间';
COMMENT ON COLUMN user_events.metadata IS 'JSONB 扩展数据，存储事件特定的额外信息';
