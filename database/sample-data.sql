-- 示例数据 (用于测试)
-- 注意：这些是测试数据，实际使用时密码会通过应用程序哈希处理

-- 插入测试用户 (密码: testuser123)
INSERT INTO users (username, password_hash) VALUES 
('testuser', '$2b$10$example.hash.for.testuser123') -- 这只是示例，实际会由应用生成
ON CONFLICT (username) DO NOTHING;

-- 获取测试用户ID (用于插入任务)
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE username = 'testuser';
    
    -- 插入示例任务
    INSERT INTO tasks (user_id, title, description, deadline, priority, completed) VALUES 
    (test_user_id, '完成项目文档', '编写完整的API文档和用户指南', NOW() + INTERVAL '7 days', 'high', false),
    (test_user_id, '代码审查', '审查新功能的代码实现', NOW() + INTERVAL '3 days', 'medium', false),
    (test_user_id, '团队会议', '参加每周团队同步会议', NOW() + INTERVAL '1 day', 'medium', false),
    (test_user_id, '修复Bug #123', '修复用户登录时的异常问题', NOW() - INTERVAL '1 day', 'high', false), -- 过期任务
    (test_user_id, '学习新技术', '学习React 18的新特性', NOW() + INTERVAL '14 days', 'low', false),
    (test_user_id, '完成单元测试', '为核心功能编写单元测试', NOW() + INTERVAL '5 days', 'medium', true) -- 已完成任务
    ON CONFLICT DO NOTHING;
END $$;
