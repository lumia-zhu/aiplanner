# Step 1: 数据库结构调整 - 执行指南

## 📋 概述

本迁移添加全局对话支持，允许对话历史在切换日期时保留。

**预计时间**：5-10 分钟  
**影响范围**：`chat_messages` 表  
**风险等级**：🟢 低（只添加字段，不修改现有数据结构）

---

## 🚀 执行步骤

### **方式 1：通过 Supabase 控制台（推荐）**

1. **登录 Supabase 控制台**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目

2. **打开 SQL 编辑器**
   - 左侧菜单 → SQL Editor
   - 点击 "New query"

3. **复制并执行迁移脚本**
   - 打开文件：`database/add-global-chat-support.sql`
   - 复制全部内容
   - 粘贴到 SQL 编辑器
   - 点击 "Run" 按钮

4. **查看执行结果**
   - 应该看到成功消息
   - 最后会显示一些统计数据

---

### **方式 2：通过命令行（适合开发者）**

```bash
# 如果你使用 Supabase CLI
supabase db push

# 或者使用 psql
psql -h your-db-host -U postgres -d postgres -f database/add-global-chat-support.sql
```

---

## ✅ 验证迁移

### **1. 执行验证脚本**

在 Supabase SQL 编辑器中运行：

```bash
# 复制并运行
database/verify-global-chat-migration.sql
```

### **2. 检查结果**

你应该看到：

#### **验证 1: 字段存在**
```
column_name   | data_type | is_nullable
--------------+-----------+-------------
context_date  | date      | YES
session_id    | uuid      | YES
```
✅ 两个字段都存在

#### **验证 2: 数据迁移完整**
```
total_messages | has_context_date | missing_context_date
---------------+------------------+---------------------
     150       |       150        |          0
```
✅ `missing_context_date` = 0

#### **验证 3: 索引创建**
```
idx_chat_messages_user_context
idx_chat_messages_user_created
```
✅ 两个索引都存在

#### **验证 4: 数据一致性**
```
(空结果)
```
✅ 旧数据的 context_date = chat_date

#### **验证 5: 示例数据**
```
能看到最近 10 条消息，且都有 context_date
```
✅ 数据正常

---

## 🔄 回滚方案（如果需要）

如果遇到问题，可以回滚：

```sql
-- 删除新添加的字段
ALTER TABLE chat_messages 
DROP COLUMN IF EXISTS context_date,
DROP COLUMN IF EXISTS session_id;

-- 删除索引
DROP INDEX IF EXISTS idx_chat_messages_user_context;
DROP INDEX IF EXISTS idx_chat_messages_user_created;
```

⚠️ **注意**：回滚会丢失新字段的数据

---

## 📊 预期变化

### **表结构变化**

**之前**：
```
chat_messages
├─ id
├─ user_id
├─ chat_date       ← 用于分组对话
├─ role
├─ content
└─ created_at
```

**之后**：
```
chat_messages
├─ id
├─ user_id
├─ chat_date       ← 保留（兼容）
├─ context_date    ← 新增：实际操作日期
├─ session_id      ← 新增：保留字段
├─ role
├─ content
└─ created_at
```

### **数据变化**

- ✅ 旧数据：`context_date` = `chat_date`
- ✅ 新数据：`context_date` = 用户当前查看的日期
- ✅ 查询方式：从按日期过滤改为全局查询

---

## ❓ 常见问题

### **Q: 这会影响现有功能吗？**
A: 不会。旧数据的 `context_date` = `chat_date`，行为与之前一致。

### **Q: 数据库会变大吗？**
A: 会增加约 8 字节/条消息（日期字段），影响很小。

### **Q: 需要停机吗？**
A: 不需要。这是一个在线迁移，不影响正常使用。

### **Q: 如果迁移失败怎么办？**
A: 使用回滚脚本恢复，或者联系我帮忙排查。

---

## ✅ 完成检查清单

执行完成后，请确认：

- [ ] ✅ 迁移脚本执行成功（无错误）
- [ ] ✅ 验证脚本 5 项全部通过
- [ ] ✅ 能看到 `context_date` 和 `session_id` 字段
- [ ] ✅ 旧数据的 `context_date` 已填充
- [ ] ✅ 索引已创建

---

## 🎯 完成后下一步

Step 1 完成后，可以进入 **Step 2: 修改 chatMessages.ts**

告诉我验证结果，我们继续下一步！🚀


