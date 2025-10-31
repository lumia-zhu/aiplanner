# 便签功能数据库设置指南

## 📋 功能说明

便签功能允许用户在笔记编辑器中创建可拖动的便签卡片，用于记录临时想法、待办事项等。

## 🚀 设置步骤

### 1. 在 Supabase 控制台执行 SQL

1. 登录你的 Supabase 项目控制台
2. 点击左侧菜单的 **"SQL Editor"**
3. 点击 **"New query"**
4. 复制并粘贴 `create-sticky-notes-table.sql` 的内容
5. 点击 **"Run"** 执行

### 2. 验证表创建成功

在 SQL Editor 中运行以下查询：

```sql
-- 查看表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sticky_notes'
ORDER BY ordinal_position;

-- 查看索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sticky_notes';
```

### 3. （可选）插入测试数据

如果你想测试便签功能，可以手动插入一条测试数据：

```sql
INSERT INTO sticky_notes (user_id, note_date, content, position_x, position_y, color, z_index)
VALUES 
  (
    'YOUR_USER_ID_HERE',  -- 替换为你的用户ID
    '2025-10-31',
    '这是一个测试便签',
    150,
    150,
    'yellow',
    1
  );
```

## 📊 表结构说明

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `id` | UUID | 便签唯一ID | 自动生成 |
| `user_id` | UUID | 用户ID（外键） | 必填 |
| `note_date` | TEXT | 笔记日期（YYYY-MM-DD） | 必填 |
| `content` | TEXT | 便签内容 | 空字符串 |
| `position_x` | INT | X坐标 | 100 |
| `position_y` | INT | Y坐标 | 100 |
| `color` | TEXT | 颜色（yellow/blue/green/pink） | yellow |
| `z_index` | INT | 层级 | 1 |
| `created_at` | TIMESTAMP | 创建时间 | NOW() |
| `updated_at` | TIMESTAMP | 更新时间 | NOW() |

## 🔍 常用查询

### 获取指定日期的所有便签

```sql
SELECT * FROM sticky_notes
WHERE user_id = 'YOUR_USER_ID'
  AND note_date = '2025-10-31'
ORDER BY z_index ASC;
```

### 删除旧便签（保留最近30天）

```sql
DELETE FROM sticky_notes
WHERE note_date < (CURRENT_DATE - INTERVAL '30 days');
```

## ⚠️ 注意事项

1. **外键约束**：便签表通过 `user_id` 关联到 `users` 表，删除用户时会自动删除其所有便签
2. **颜色约束**：`color` 字段只接受 'yellow', 'blue', 'green', 'pink' 四个值
3. **自动更新时间**：`updated_at` 字段会在每次更新时自动更新
4. **性能优化**：已创建索引优化按用户和日期查询的性能

## 🔧 故障排查

### 问题1：创建表失败
- 确认 `users` 表已存在
- 确认你有创建表的权限

### 问题2：外键约束错误
- 确认插入的 `user_id` 在 `users` 表中存在

### 问题3：颜色值无效
- 确认 `color` 字段只使用 'yellow', 'blue', 'green', 'pink' 四个值之一


