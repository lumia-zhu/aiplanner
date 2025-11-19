-- ========================================
-- 全局对话支持 - 数据库迁移脚本
-- 创建时间: 2025-11-13
-- 目的: 支持跨日期的全局对话功能
-- ========================================

-- 1️⃣ 添加新字段
-- ===================

-- 添加 context_date 字段（消息发送时用户所在的日期上下文）
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS context_date DATE;

-- 添加 session_id 字段（保留字段，为后续会话管理功能准备）
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS session_id UUID;

-- 添加字段注释
COMMENT ON COLUMN chat_messages.context_date IS '消息发送时用户所在的日期上下文（用户当前查看的日期）';
COMMENT ON COLUMN chat_messages.session_id IS '会话ID（保留字段，暂不使用）';


-- 2️⃣ 迁移旧数据
-- ===================

-- 为所有旧消息设置 context_date = chat_date
-- 这样保证旧数据的行为与之前一致
UPDATE chat_messages 
SET context_date = chat_date::DATE
WHERE context_date IS NULL;


-- 3️⃣ 添加索引优化查询
-- ===================

-- 为常用查询添加索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_context 
ON chat_messages(user_id, context_date);

-- 为全局查询优化（按创建时间排序）
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON chat_messages(user_id, created_at);


-- 4️⃣ 验证迁移结果
-- ===================

-- 查看表结构
\d chat_messages

-- 统计数据
SELECT 
  COUNT(*) as total_messages,
  COUNT(context_date) as messages_with_context,
  COUNT(*) - COUNT(context_date) as messages_without_context
FROM chat_messages;

-- 查看示例数据
SELECT 
  id,
  user_id,
  chat_date,
  context_date,
  role,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- 迁移完成！
-- 
-- 验证清单：
-- ✅ context_date 字段已添加
-- ✅ session_id 字段已添加  
-- ✅ 旧数据已迁移（context_date = chat_date）
-- ✅ 索引已创建
-- ========================================




