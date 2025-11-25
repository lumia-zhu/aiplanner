-- ============================================
-- MindTrack 元认知反思系统数据库表
-- ============================================

-- 1. 计划快照表 (plan_snapshots)
-- 存储用户展开侧栏时的任务快照，用于 RQ1 分析
-- ============================================

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 快照时的任务列表 (JSON 格式)
  tasks_json JSONB NOT NULL,
  
  -- 快照时的笔记日期
  note_date DATE NOT NULL,
  
  -- 任务总数（便于快速查询）
  task_count INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_user_id ON plan_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_created_at ON plan_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_note_date ON plan_snapshots(note_date);

-- 注释
COMMENT ON TABLE plan_snapshots IS '计划快照表：存储用户展开AI侧栏时的任务状态';
COMMENT ON COLUMN plan_snapshots.tasks_json IS '任务列表JSON，包含id、title、priority、estimatedDuration、deadline、isCompleted等字段';
COMMENT ON COLUMN plan_snapshots.note_date IS '快照对应的笔记日期';


-- ============================================
-- 2. 反思会话表 (reflection_sessions)
-- 存储反思会话状态，支持持久化和恢复
-- ============================================

CREATE TABLE IF NOT EXISTS reflection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_snapshot_id UUID NOT NULL REFERENCES plan_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 会话状态: in_progress, completed, skipped
  status VARCHAR(20) DEFAULT 'in_progress',
  
  -- 当前轮次: overview, clarity, time, priority, summary
  current_round VARCHAR(20) DEFAULT 'overview',
  
  -- Global Scan 结果 (JSON 格式)
  scan_result JSONB,
  
  -- 任务总览小结
  overview_summary TEXT,
  
  -- 三轮反思记录 (JSON 格式)
  -- 结构: { clarity: {...}, time: {...}, priority: {...} }
  rounds_json JSONB DEFAULT '{}',
  
  -- 最终总结
  final_summary TEXT,
  
  -- 执行建议 (JSON 数组)
  execution_suggestions JSONB,
  
  -- 完成时间
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reflection_sessions_user_id ON reflection_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_sessions_plan_snapshot_id ON reflection_sessions(plan_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_reflection_sessions_status ON reflection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_reflection_sessions_created_at ON reflection_sessions(created_at);

-- 注释
COMMENT ON TABLE reflection_sessions IS '反思会话表：存储三轮反思的完整状态，支持会话恢复';
COMMENT ON COLUMN reflection_sessions.current_round IS '当前轮次: overview(总览), clarity(澄清), time(时间), priority(优先级), summary(总结)';
COMMENT ON COLUMN reflection_sessions.scan_result IS 'Global Scan结果JSON，包含vagueTaskCount、unestimatedTaskCount、workloadLevel等';
COMMENT ON COLUMN reflection_sessions.rounds_json IS '三轮反思记录，每轮包含status、questions、userResponses、startedAt、completedAt';


-- ============================================
-- 3. 自动更新 updated_at 的触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reflection_sessions_updated_at
  BEFORE UPDATE ON reflection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 4. RLS 策略 (Row Level Security)
-- ============================================

-- 启用 RLS
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_sessions ENABLE ROW LEVEL SECURITY;

-- plan_snapshots 策略：用户只能访问自己的数据
CREATE POLICY "Users can view own plan_snapshots"
  ON plan_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan_snapshots"
  ON plan_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan_snapshots"
  ON plan_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan_snapshots"
  ON plan_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- reflection_sessions 策略：用户只能访问自己的数据
CREATE POLICY "Users can view own reflection_sessions"
  ON reflection_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflection_sessions"
  ON reflection_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflection_sessions"
  ON reflection_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflection_sessions"
  ON reflection_sessions FOR DELETE
  USING (auth.uid() = user_id);

