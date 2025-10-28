-- ============================================
-- 笔记系统数据库表结构
-- ============================================
-- 功能：替代传统任务管理，采用 Notion-lite 风格
-- 每个用户每天一个笔记，笔记内包含待办、标签、日期等
-- ============================================

-- 1. 创建笔记主表
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 笔记内容
  title TEXT,                           -- 笔记标题（可选，可从第一行提取）
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,  -- Tiptap JSON 格式
  plain_text TEXT,                      -- 纯文本版本（用于搜索和预览）
  
  -- 日期关联
  note_date DATE NOT NULL,              -- 笔记所属日期（用于按日期分组）
  
  -- 提取的元数据（方便查询和AI分析）
  tags TEXT[] DEFAULT '{}',                      -- 笔记中的所有标签
  has_pending_tasks BOOLEAN DEFAULT false,       -- 是否有未完成待办
  pending_tasks_count INT DEFAULT 0,             -- 未完成待办数量
  completed_tasks_count INT DEFAULT 0,           -- 已完成待办数量
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束：每个用户每天只有一个笔记
  CONSTRAINT notes_user_date_unique UNIQUE(user_id, note_date)
);

-- 2. 创建索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_note_date ON notes(note_date);
CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, note_date);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);  -- GIN 索引用于数组查询
CREATE INDEX IF NOT EXISTS idx_notes_has_pending ON notes(user_id, has_pending_tasks) WHERE has_pending_tasks = true;

-- 3. 全文搜索索引（可选，用于搜索笔记内容）
CREATE INDEX IF NOT EXISTS idx_notes_plain_text_search ON notes USING GIN(to_tsvector('english', COALESCE(plain_text, '')));

-- 4. 启用行级安全策略（RLS）
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略
-- 用户只能访问自己的笔记
DROP POLICY IF EXISTS "Users can only access their own notes" ON notes;
CREATE POLICY "Users can only access their own notes"
  ON notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. 创建自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 绑定触发器
DROP TRIGGER IF EXISTS trigger_update_notes_updated_at ON notes;
CREATE TRIGGER trigger_update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

-- 8. 添加注释（便于维护）
COMMENT ON TABLE notes IS '用户笔记表 - Notion-lite 风格，每用户每天一个笔记';
COMMENT ON COLUMN notes.content IS 'Tiptap JSON 格式的笔记内容';
COMMENT ON COLUMN notes.plain_text IS '纯文本内容，用于搜索和预览';
COMMENT ON COLUMN notes.note_date IS '笔记所属日期，用于按日期分组';
COMMENT ON COLUMN notes.tags IS '从笔记内容中提取的标签数组';
COMMENT ON COLUMN notes.has_pending_tasks IS '是否有未完成待办项（快速筛选）';
COMMENT ON COLUMN notes.pending_tasks_count IS '未完成待办数量';
COMMENT ON COLUMN notes.completed_tasks_count IS '已完成待办数量';

-- 9. 插入示例数据（可选，用于测试）
-- INSERT INTO notes (user_id, note_date, content, plain_text, tags, has_pending_tasks, pending_tasks_count, completed_tasks_count)
-- VALUES (
--   auth.uid(),
--   CURRENT_DATE,
--   '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"今天的计划"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"准备考试材料"}]}]},{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"完成项目报告"}]}]}]}]}'::jsonb,
--   '今天的计划 准备考试材料 完成项目报告',
--   ARRAY['重要', '学习'],
--   true,
--   1,
--   1
-- );

-- 10. 验证表结构
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
    RAISE NOTICE '✅ notes 表创建成功！';
  ELSE
    RAISE EXCEPTION '❌ notes 表创建失败！';
  END IF;
END $$;

