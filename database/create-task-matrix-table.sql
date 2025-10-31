-- ============================================
-- 任务矩阵数据库表创建脚本
-- ============================================
-- 功能：存储任务在四象限矩阵中的位置信息
-- 用途：支持任务优先级分类（重要-紧急矩阵）
-- 创建时间：2025-10-31
-- ============================================

-- 创建任务矩阵表
CREATE TABLE IF NOT EXISTS task_matrix (
  -- 基础字段
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,  -- 关联任务
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 用户ID
  
  -- 象限分类字段
  quadrant TEXT NOT NULL CHECK (quadrant IN (
    'unclassified',              -- 待分类（新任务默认状态）
    'urgent-important',          -- 右上：紧急且重要（危机处理区）
    'not-urgent-important',      -- 左上：不紧急但重要（战略规划区）
    'urgent-not-important',      -- 右下：紧急但不重要（琐碎事务区）
    'not-urgent-not-important'   -- 左下：不紧急不重要（时间浪费区）
  )) DEFAULT 'unclassified',     -- 默认为待分类状态
  
  -- 排序字段
  position INT DEFAULT 0,        -- 在象限内的排序位置（用于用户自定义排序）
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 索引优化
-- ============================================

-- 用户+任务复合索引（查询某个任务的矩阵信息）
CREATE INDEX IF NOT EXISTS idx_task_matrix_user_task 
  ON task_matrix(user_id, task_id);

-- 用户+象限复合索引（查询某个象限的所有任务）
CREATE INDEX IF NOT EXISTS idx_task_matrix_user_quadrant 
  ON task_matrix(user_id, quadrant);

-- 象限+排序索引（用于象限内任务排序）
CREATE INDEX IF NOT EXISTS idx_task_matrix_quadrant_position 
  ON task_matrix(quadrant, position);

-- 唯一约束：一个任务只能有一个矩阵位置
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_matrix_task_unique 
  ON task_matrix(task_id);

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE task_matrix ENABLE ROW LEVEL SECURITY;

-- 策略1：用户只能访问自己的任务矩阵
CREATE POLICY "用户只能访问自己的任务矩阵"
  ON task_matrix
  FOR ALL
  USING (auth.uid() = user_id);

-- 策略2：用户可以插入自己的任务矩阵
CREATE POLICY "用户可以创建自己的任务矩阵"
  ON task_matrix
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略3：用户可以更新自己的任务矩阵
CREATE POLICY "用户可以更新自己的任务矩阵"
  ON task_matrix
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 策略4：用户可以删除自己的任务矩阵
CREATE POLICY "用户可以删除自己的任务矩阵"
  ON task_matrix
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 触发器：自动更新 updated_at 字段
-- ============================================

-- 创建更新时间戳的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_task_matrix_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器到 task_matrix 表
DROP TRIGGER IF EXISTS trigger_update_task_matrix_updated_at ON task_matrix;
CREATE TRIGGER trigger_update_task_matrix_updated_at
  BEFORE UPDATE ON task_matrix
  FOR EACH ROW
  EXECUTE FUNCTION update_task_matrix_updated_at();

-- ============================================
-- 测试数据（可选，用于验证表结构）
-- ============================================

-- 示例：插入一条测试数据（需要替换为实际的 user_id 和 task_id）
-- INSERT INTO task_matrix (user_id, task_id, quadrant, position) 
-- VALUES (
--   'your-user-id-here',
--   'your-task-id-here',
--   'unclassified',
--   0
-- );

-- ============================================
-- 清理脚本（如需重置表，取消注释后执行）
-- ============================================

-- DROP TRIGGER IF EXISTS trigger_update_task_matrix_updated_at ON task_matrix;
-- DROP FUNCTION IF EXISTS update_task_matrix_updated_at();
-- DROP TABLE IF EXISTS task_matrix CASCADE;

