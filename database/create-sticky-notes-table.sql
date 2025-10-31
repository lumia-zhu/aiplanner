-- ============================================
-- 便签功能数据库表创建脚本
-- ============================================
-- 功能：存储用户的便签数据，每个便签关联到特定日期的笔记
-- 创建时间：2025-10-31
-- ============================================

-- 创建便签表
CREATE TABLE IF NOT EXISTS sticky_notes (
  -- 基础字段
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_date TEXT NOT NULL,  -- 关联的笔记日期，格式：YYYY-MM-DD
  
  -- 便签内容和样式
  content TEXT DEFAULT '',  -- 便签文字内容
  position_x INT DEFAULT 100,  -- X坐标位置
  position_y INT DEFAULT 100,  -- Y坐标位置
  color TEXT DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'green', 'pink')),  -- 便签颜色
  z_index INT DEFAULT 1,  -- 层级（用于叠放顺序）
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以优化查询性能
-- 按用户和日期查询便签（最常用的查询场景）
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_date 
  ON sticky_notes(user_id, note_date);

-- 按用户查询所有便签
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user 
  ON sticky_notes(user_id);

-- 添加注释说明
COMMENT ON TABLE sticky_notes IS '用户便签数据表，存储可拖动的便签信息';
COMMENT ON COLUMN sticky_notes.id IS '便签唯一标识符';
COMMENT ON COLUMN sticky_notes.user_id IS '所属用户ID';
COMMENT ON COLUMN sticky_notes.note_date IS '关联的笔记日期（YYYY-MM-DD格式）';
COMMENT ON COLUMN sticky_notes.content IS '便签文字内容';
COMMENT ON COLUMN sticky_notes.position_x IS '便签X坐标位置（像素）';
COMMENT ON COLUMN sticky_notes.position_y IS '便签Y坐标位置（像素）';
COMMENT ON COLUMN sticky_notes.color IS '便签颜色：yellow, blue, green, pink';
COMMENT ON COLUMN sticky_notes.z_index IS '便签层级，数字越大越在上层';

-- 创建更新时间自动更新触发器
CREATE OR REPLACE FUNCTION update_sticky_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sticky_notes_updated_at
  BEFORE UPDATE ON sticky_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_sticky_notes_updated_at();

-- 插入示例数据（可选，用于测试）
-- 取消下面的注释可以插入测试数据
/*
INSERT INTO sticky_notes (user_id, note_date, content, position_x, position_y, color, z_index)
VALUES 
  (
    (SELECT id FROM users LIMIT 1),  -- 使用第一个用户
    '2025-10-31',
    '这是一个测试便签',
    150,
    150,
    'yellow',
    1
  );
*/


