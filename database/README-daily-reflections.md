# 每日反思功能 - 数据库迁移说明

## 📋 概述

**创建时间**：2025-12-09  
**功能**：每日反思 - 帮助用户每天回顾任务进展和情绪状态

---

## 🎯 功能说明

### 核心特性
- ✅ 每天从5个问题中随机抽取3个问题
- ✅ AI逐个提问，用户逐个回答
- ✅ 支持跳过问题（但至少回答1个）
- ✅ 支持中断恢复（记录当前进度）
- ✅ 每天只能反思一次
- ✅ AI生成温暖的总结反馈
- ✅ 可查看历史反思记录

### 问题库
1. 今天你的任务进展如何？有哪些完成得不错的？
2. 任务是否按你预期的方式进行？有什么偏差吗？
3. 今天有没有遇到意外的情况或惊喜？
4. 今天什么对你最有帮助？（工具、方法、人或想法）
5. 此刻你的精力和情绪状态如何？感觉怎么样？

---

## 📊 数据库设计

### 表结构：`daily_reflections`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户ID（外键 → users） |
| `date` | DATE | 反思日期 |
| `question_1` | TEXT | 第一个问题 |
| `answer_1` | TEXT | 第一个问题的回答 |
| `question_2` | TEXT | 第二个问题 |
| `answer_2` | TEXT | 第二个问题的回答 |
| `question_3` | TEXT | 第三个问题 |
| `answer_3` | TEXT | 第三个问题的回答 |
| `ai_summary` | TEXT | AI生成的总结 |
| `status` | VARCHAR(20) | 状态（`in_progress` / `completed`） |
| `current_question_index` | INT | 当前问题索引（0-3） |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 约束
- **唯一约束**：`(user_id, date)` - 每个用户每天只能有一条记录
- **检查约束**：
  - `status IN ('in_progress', 'completed')`
  - `current_question_index >= 0 AND current_question_index <= 3`

### 索引
- `idx_daily_reflections_user_date`：用于快速查询用户的历史反思（按日期倒序）
- `idx_daily_reflections_status`：用于快速查询进行中的反思

### 触发器
- `trigger_update_daily_reflections_updated_at`：自动更新 `updated_at` 字段

---

## 🚀 执行迁移

### 步骤1：连接到 Supabase

```bash
# 方式1：通过 Supabase Dashboard
1. 登录 https://app.supabase.com
2. 选择你的项目
3. 进入 SQL Editor
4. 复制 create-daily-reflections.sql 的内容并执行
```

```bash
# 方式2：通过命令行（如果已配置 Supabase CLI）
supabase db push
```

### 步骤2：验证迁移成功

在 SQL Editor 中执行：

```sql
-- 检查表是否存在
SELECT tablename FROM pg_tables WHERE tablename = 'daily_reflections';

-- 查看表结构
\d daily_reflections

-- 查看索引
SELECT indexname FROM pg_indexes WHERE tablename = 'daily_reflections';

-- 查看约束
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'daily_reflections'::regclass;
```

预期结果：
- ✅ 表存在
- ✅ 2个索引已创建
- ✅ 2个检查约束 + 1个唯一约束已创建
- ✅ 触发器已创建

---

## 📝 字段说明

### `current_question_index` 状态机

| 值 | 含义 | 说明 |
|----|------|------|
| `0` | 未开始 | 刚创建反思会话，还未回答任何问题 |
| `1` | 已回答问题1 | 正在进行第2个问题 |
| `2` | 已回答问题2 | 正在进行第3个问题 |
| `3` | 已回答问题3 | 所有问题已完成 |

### `status` 状态

| 值 | 含义 |
|----|------|
| `in_progress` | 用户正在回答问题，或中途中断 |
| `completed` | 已回答完所有问题并生成AI总结 |

---

## 🔄 业务逻辑流程

### 场景1：首次开启反思
```
1. 点击"开启今日反思"按钮
2. 检查今天是否已有记录（SELECT ... WHERE user_id = ? AND date = TODAY）
3. 如果不存在：
   - 随机抽取3个问题
   - INSERT 新记录（status = 'in_progress', current_question_index = 0）
   - 显示欢迎消息 + 第一个问题
```

### 场景2：中断恢复
```
1. 用户中途关闭侧边栏（current_question_index = 1, status = 'in_progress'）
2. 再次点击"开启今日反思"按钮
3. 检测到未完成的记录
4. 显示提示："你还有未完成的反思，是否继续？"
5. 如果选择继续：
   - 从 current_question_index + 1 的问题开始
```

### 场景3：已完成今天的反思
```
1. 点击"开启今日反思"按钮
2. 检测到 status = 'completed' 的记录
3. 显示提示："今天已完成反思 ✅"
4. 提供"查看今日反思"按钮
```

---

## 🧪 测试 SQL

### 测试1：创建反思记录
```sql
INSERT INTO daily_reflections (
  user_id, 
  date, 
  question_1, 
  question_2, 
  question_3,
  current_question_index,
  status
) VALUES (
  'your-user-id-here',
  CURRENT_DATE,
  '今天你的任务进展如何？有哪些完成得不错的？',
  '今天有没有遇到意外的情况或惊喜？',
  '此刻你的精力和情绪状态如何？感觉怎么样？',
  0,
  'in_progress'
);
```

### 测试2：更新回答
```sql
UPDATE daily_reflections 
SET 
  answer_1 = '今天完成了3个重要任务，感觉很充实！',
  current_question_index = 1
WHERE user_id = 'your-user-id-here' AND date = CURRENT_DATE;
```

### 测试3：完成反思
```sql
UPDATE daily_reflections 
SET 
  answer_2 = '有一个Bug花了比预期更长的时间',
  answer_3 = '精力还不错，心情愉快',
  ai_summary = '太棒了！今天你完成了3个重要任务，虽然遇到了一些技术挑战，但你依然保持了积极的心态。继续加油！',
  status = 'completed',
  current_question_index = 3
WHERE user_id = 'your-user-id-here' AND date = CURRENT_DATE;
```

### 测试4：查询历史反思
```sql
SELECT 
  date,
  question_1, answer_1,
  question_2, answer_2,
  question_3, answer_3,
  ai_summary,
  status,
  created_at
FROM daily_reflections
WHERE user_id = 'your-user-id-here'
ORDER BY date DESC
LIMIT 10;
```

---

## ⚠️ 注意事项

1. **唯一性约束**：同一用户同一天只能有一条记录，重复插入会报错
2. **外键级联删除**：删除用户时会自动删除其所有反思记录
3. **时区处理**：`date` 字段使用 `DATE` 类型，不包含时区信息，建议前端统一按用户本地日期处理
4. **索引优化**：已对 `(user_id, date)` 和 `(user_id, status)` 创建索引，查询性能良好

---

## 📦 依赖

- PostgreSQL 12+ （Supabase 默认版本）
- `uuid-ossp` 扩展（用于生成UUID）

---

## 🔙 回滚方案

如果需要回滚此迁移：

```sql
-- 删除触发器
DROP TRIGGER IF EXISTS trigger_update_daily_reflections_updated_at ON daily_reflections;

-- 删除触发器函数
DROP FUNCTION IF EXISTS update_daily_reflections_updated_at();

-- 删除表（⚠️ 会丢失所有数据）
DROP TABLE IF EXISTS daily_reflections;
```

---

## ✅ 验证清单

- [ ] 表已创建
- [ ] 索引已创建（2个）
- [ ] 约束已创建（唯一约束 + 2个检查约束）
- [ ] 触发器已创建
- [ ] 测试插入记录成功
- [ ] 测试更新记录成功
- [ ] 测试唯一约束生效（同一天重复插入会报错）
- [ ] 测试查询性能（使用 EXPLAIN ANALYZE）

---

## 📞 支持

如有问题，请参考：
- Supabase 文档：https://supabase.com/docs
- PostgreSQL 文档：https://www.postgresql.org/docs/







