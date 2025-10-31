-- ============================================
-- 笔记任务表创建脚本
-- ============================================
-- 功能：存储笔记编辑器中的任务（TaskList items）
-- 用途：支持任务矩阵分类，可跨天存在
-- 创建时间：2025-10-31
-- ============================================

-- 创建 daily_tasks 表
CREATE TABLE IF NOT EXISTS daily_tasks (
  -- 基础字段
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 任务内容
  title TEXT NOT NULL,              -- 任务标题
  completed BOOLEAN DEFAULT FALSE,  -- 是否完成
  
  -- 日期和时间
  date TEXT NOT NULL,               -- 任务所属日期 YYYY-MM-DD
  deadline_datetime TEXT,           -- 截止时间（可选，ISO 8601 格式）
  
  -- 笔记关联
  note_date TEXT NOT NULL,          -- 任务来自哪天的笔记
  note_position INT DEFAULT 0,      -- 在笔记中的位置顺序
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 索引优化
-- ============================================

-- 用户+日期索引（最常用的查询）
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date 
  ON daily_tasks(user_id, date);

-- 用户+笔记日期索引（用于从笔记加载任务）
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_note_date 
  ON daily_tasks(user_id, note_date);

-- 完成状态索引
CREATE INDEX IF NOT EXISTS idx_daily_tasks_completed 
  ON daily_tasks(completed);

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- 策略1：用户只能访问自己的任务
CREATE POLICY "用户只能访问自己的任务"
  ON daily_tasks
  FOR ALL
  USING (auth.uid() = user_id);

-- 策略2：用户可以插入自己的任务
CREATE POLICY "用户可以创建自己的任务"
  ON daily_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略3：用户可以更新自己的任务
CREATE POLICY "用户可以更新自己的任务"
  ON daily_tasks
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 策略4：用户可以删除自己的任务
CREATE POLICY "用户可以删除自己的任务"
  ON daily_tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 触发器：自动更新 updated_at 字段
-- ============================================

-- 创建更新时间戳的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_daily_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器到 daily_tasks 表
DROP TRIGGER IF EXISTS trigger_update_daily_tasks_updated_at ON daily_tasks;
CREATE TRIGGER trigger_update_daily_tasks_updated_at
  BEFORE UPDATE ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_tasks_updated_at();

-- ============================================
-- 更新 task_matrix 表的外键引用
-- ============================================

-- 删除旧的外键约束（如果存在）
ALTER TABLE task_matrix 
DROP CONSTRAINT IF EXISTS task_matrix_task_id_fkey;

-- 添加新的外键约束，指向 daily_tasks
ALTER TABLE task_matrix 
ADD CONSTRAINT task_matrix_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE;

-- ============================================
-- 测试数据（可选，用于验证表结构）
-- ============================================

-- 示例：插入一条测试任务
-- INSERT INTO daily_tasks (user_id, title, date, note_date, completed) 
-- VALUES (
--   'your-user-id-here',
--   '完成项目报告',
--   '2025-10-31',
--   '2025-10-31',
--   false
-- );

-- ============================================
-- 验证
-- ============================================

-- 查看表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'daily_tasks'
ORDER BY ordinal_position;

-- 查看索引
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'daily_tasks';

-- 查看 RLS 策略
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'daily_tasks';

-- ============================================
-- 清理脚本（如需重置表，取消注释后执行）
-- ============================================

-- DROP TRIGGER IF EXISTS trigger_update_daily_tasks_updated_at ON daily_tasks;
-- DROP FUNCTION IF EXISTS update_daily_tasks_updated_at();
-- DROP TABLE IF EXISTS daily_tasks CASCADE;

