-- ================================================
-- 任务上下文信息表（简化版 - 无分类）
-- ================================================
-- 用于存储从反思问答中提取的任务背景、目标、资源等信息
-- 作者: AI Assistant
-- 创建时间: 2025-01-15
-- ================================================

-- 创建任务上下文信息表
CREATE TABLE IF NOT EXISTS task_context_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_question TEXT,
  source_answer TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 外键约束：关联到 daily_tasks 表，删除任务时级联删除上下文信息
  CONSTRAINT fk_task_context_daily_task 
    FOREIGN KEY (task_id) 
    REFERENCES daily_tasks(id) 
    ON DELETE CASCADE
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_task_context_task_id 
  ON task_context_info(task_id);

CREATE INDEX IF NOT EXISTS idx_task_context_created_at 
  ON task_context_info(created_at DESC);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_task_context_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_context_info_updated_at
  BEFORE UPDATE ON task_context_info
  FOR EACH ROW
  EXECUTE FUNCTION update_task_context_info_updated_at();

-- 添加注释
COMMENT ON TABLE task_context_info IS '任务上下文信息表，存储从反思问答中提取的任务相关信息';
COMMENT ON COLUMN task_context_info.id IS '主键UUID';
COMMENT ON COLUMN task_context_info.task_id IS '关联的任务ID';
COMMENT ON COLUMN task_context_info.content IS '提取的核心信息内容';
COMMENT ON COLUMN task_context_info.source IS '信息来源：clarity-reflection(任务澄清)、time-reflection(时间估计)、decomposition-reflection(任务拆解)、priority-reflection(优先级排列)';
COMMENT ON COLUMN task_context_info.source_question IS '原始问题';
COMMENT ON COLUMN task_context_info.source_answer IS '原始回答';
COMMENT ON COLUMN task_context_info.display_order IS '显示顺序，数字越小越靠前';
COMMENT ON COLUMN task_context_info.created_at IS '创建时间';
COMMENT ON COLUMN task_context_info.updated_at IS '更新时间';
