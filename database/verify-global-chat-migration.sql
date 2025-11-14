-- ========================================
-- 验证脚本：检查全局对话迁移是否成功
-- ========================================

-- ✅ 验证 1: 检查字段是否存在
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages' 
  AND column_name IN ('context_date', 'session_id')
ORDER BY column_name;

-- 预期结果：
-- context_date | date | YES
-- session_id   | uuid | YES


-- ✅ 验证 2: 检查数据迁移是否完整
SELECT 
  COUNT(*) as total_messages,
  COUNT(context_date) as has_context_date,
  COUNT(CASE WHEN context_date IS NULL THEN 1 END) as missing_context_date
FROM chat_messages;

-- 预期结果：
-- missing_context_date 应该为 0（所有旧数据都已迁移）


-- ✅ 验证 3: 检查索引是否创建
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'chat_messages'
  AND indexname LIKE 'idx_chat_messages%';

-- 预期结果：
-- idx_chat_messages_user_context
-- idx_chat_messages_user_created


-- ✅ 验证 4: 检查数据一致性
SELECT 
  chat_date,
  context_date,
  COUNT(*) as count
FROM chat_messages
WHERE chat_date::DATE != context_date
GROUP BY chat_date, context_date;

-- 预期结果：
-- 空结果（旧数据的 context_date 应该等于 chat_date）


-- ✅ 验证 5: 查看示例数据
SELECT 
  id,
  left(user_id::text, 8) as user_id_prefix,
  chat_date,
  context_date,
  role,
  content->0->>'type' as content_type,
  substring(content->0->>'text', 1, 50) as message_preview,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 如果以上 5 个验证都通过，说明迁移成功！✅
-- ========================================


