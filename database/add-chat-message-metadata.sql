-- 聊天消息元数据扩展
-- 用于支持完整对话记录保存和后台还原
-- 执行时间：约 1 分钟

-- 1. 添加消息类型字段
-- 用于区分不同类型的消息：text, agent_thought, agent_action, agent_observation, 
-- reflection_question, reflection_answer, task_selection, reflection_summary 等
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- 2. 添加会话 ID 字段
-- 用于按会话分组，方便后台还原对话流程
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 3. 添加元数据字段
-- 用于存储额外信息，如任务 ID、轮次类型、工具名称等
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- 5. 添加列注释
COMMENT ON COLUMN chat_messages.message_type IS '消息类型：text（普通文本）、agent_thought（Agent思考）、agent_action（Agent行动）、agent_observation（Agent观察）、reflection_question（反思问题）、reflection_answer（反思回答）、task_selection（任务选择）、reflection_summary（问答总结）等';
COMMENT ON COLUMN chat_messages.session_id IS '会话ID，用于按会话分组，方便后台还原完整对话流程';
COMMENT ON COLUMN chat_messages.metadata IS '额外元数据，如任务ID、反思轮次、工具名称、参数等';

-- 6. 验证字段添加成功
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'chat_messages'
AND column_name IN ('message_type', 'session_id', 'metadata')
ORDER BY column_name;
