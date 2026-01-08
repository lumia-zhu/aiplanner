-- ============================================
-- 管理员后台系统 - 数据库准备
-- ============================================
-- 包含：
-- 1. 为 user_profiles 添加 role 字段
-- 2. 创建 note_versions 表（笔记版本历史）
-- ============================================

-- ============================================
-- 第 1 部分：为 user_profiles 添加 role 字段
-- ============================================

-- 添加 role 字段（如果不存在）
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- 添加注释
COMMENT ON COLUMN user_profiles.role IS '用户角色: user=普通用户, admin=管理员';

-- 创建索引（提高按角色查询的性能）
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 验证字段添加成功
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    RAISE NOTICE '✅ user_profiles.role 字段添加成功！';
  ELSE
    RAISE EXCEPTION '❌ user_profiles.role 字段添加失败！';
  END IF;
END $$;


-- ============================================
-- 第 2 部分：创建 note_versions 表
-- ============================================

-- 创建笔记版本历史表
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联信息
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,  -- 不添加外键约束，避免依赖问题
  note_date DATE NOT NULL,
  
  -- 版本内容（完整保存 Tiptap JSON）
  content JSONB NOT NULL,
  plain_text TEXT,                  -- 纯文本（用于搜索和预览）
  
  -- 元数据
  version_source VARCHAR(20) DEFAULT 'auto_save',  -- auto_save / manual_save / initial
  content_length INTEGER,           -- 内容长度（JSON 字符串长度）
  task_count INTEGER DEFAULT 0,     -- 任务数量
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_user_id ON note_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_note_date ON note_versions(note_date);
CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON note_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_note_versions_user_date ON note_versions(user_id, note_date);

-- 添加注释
COMMENT ON TABLE note_versions IS '笔记版本历史表：每次保存笔记时记录一个版本快照';
COMMENT ON COLUMN note_versions.content IS '完整的 Tiptap JSON 格式笔记内容';
COMMENT ON COLUMN note_versions.plain_text IS '纯文本内容，用于搜索和预览';
COMMENT ON COLUMN note_versions.version_source IS '版本来源: auto_save=自动保存, manual_save=手动保存';
COMMENT ON COLUMN note_versions.content_length IS 'JSON 内容的字符长度';
COMMENT ON COLUMN note_versions.task_count IS '该版本中的任务数量';

-- 验证表创建成功
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'note_versions') THEN
    RAISE NOTICE '✅ note_versions 表创建成功！';
  ELSE
    RAISE EXCEPTION '❌ note_versions 表创建失败！';
  END IF;
END $$;


-- ============================================
-- 第 3 部分：验证查询
-- ============================================

-- 查看 user_profiles 表结构
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 查看 note_versions 表结构
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'note_versions'
ORDER BY ordinal_position;
