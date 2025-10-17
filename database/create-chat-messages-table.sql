-- AI 对话消息表
-- 用于存储用户与 AI 助手的对话记录，按日期隔离

-- 1. 创建 chat_messages 表
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_date DATE NOT NULL,  -- 对话所属日期（用于按天隔离对话）
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),  -- 消息角色：用户或AI
    content JSONB NOT NULL,  -- 消息内容（支持文本、图片等多种格式）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建索引以提升查询性能
-- 组合索引：快速查询某个用户某天的对话
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_date 
    ON chat_messages(user_id, chat_date);

-- 时间索引：用于按时间排序
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
    ON chat_messages(created_at);

-- 3. 由于使用自定义认证，我们暂时禁用 RLS，在应用层控制权限
-- 与 users 和 tasks 表保持一致
-- 在生产环境中，如果切换到 Supabase Auth，建议启用 RLS 并配置适当的策略

-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 如果需要启用 RLS，可以使用以下策略（需要配合 Supabase Auth）：
-- CREATE POLICY "Users can view their own chat messages" ON chat_messages
--     FOR SELECT USING (auth.uid()::text = user_id::text);
-- CREATE POLICY "Users can insert their own chat messages" ON chat_messages
--     FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
-- CREATE POLICY "Users can delete their own chat messages" ON chat_messages
--     FOR DELETE USING (auth.uid()::text = user_id::text);

-- 5. 添加表注释
COMMENT ON TABLE chat_messages IS '存储用户与AI助手的对话记录，按日期隔离';
COMMENT ON COLUMN chat_messages.chat_date IS '对话所属日期，用于按天隔离不同日期的对话';
COMMENT ON COLUMN chat_messages.role IS '消息角色：user(用户) 或 assistant(AI助手)';
COMMENT ON COLUMN chat_messages.content IS '消息内容，JSONB格式，支持存储文本、图片等多种内容类型';









