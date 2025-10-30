# 📝 Notes 表使用说明

## 表结构

### notes 表
每个用户每天一个笔记，采用 Notion-lite 风格存储。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户ID（外键） |
| `title` | TEXT | 笔记标题（可选） |
| `content` | JSONB | Tiptap JSON 格式内容 |
| `plain_text` | TEXT | 纯文本版本（用于搜索） |
| `note_date` | DATE | 笔记所属日期 |
| `tags` | TEXT[] | 标签数组 |
| `has_pending_tasks` | BOOLEAN | 是否有待办 |
| `pending_tasks_count` | INT | 待办数量 |
| `completed_tasks_count` | INT | 完成数量 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### 约束
- `notes_user_date_unique`: 每个用户每天只能有一个笔记

### 索引
- `idx_notes_user_id`: 用户ID索引
- `idx_notes_note_date`: 日期索引
- `idx_notes_user_date`: 复合索引（用户+日期）
- `idx_notes_tags`: GIN索引（标签数组）
- `idx_notes_has_pending`: 待办任务过滤索引

---

## 使用方法

### 1. 创建表
在 Supabase SQL Editor 中执行：
```sql
-- 执行 create-notes-table.sql
```

### 2. 查询示例

#### 获取指定日期的笔记
```sql
SELECT * FROM notes
WHERE user_id = auth.uid()
AND note_date = '2024-10-24';
```

#### 获取日期范围的笔记
```sql
SELECT * FROM notes
WHERE user_id = auth.uid()
AND note_date BETWEEN '2024-10-20' AND '2024-10-27'
ORDER BY note_date DESC;
```

#### 查询有待办的笔记
```sql
SELECT * FROM notes
WHERE user_id = auth.uid()
AND has_pending_tasks = true
ORDER BY note_date ASC;
```

#### 按标签筛选
```sql
SELECT * FROM notes
WHERE user_id = auth.uid()
AND '重要' = ANY(tags)
ORDER BY note_date DESC;
```

#### 全文搜索
```sql
SELECT * FROM notes
WHERE user_id = auth.uid()
AND plain_text ILIKE '%考试%'
ORDER BY note_date DESC;
```

---

## 数据示例

### Tiptap JSON 格式
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "今天的计划" }]
    },
    {
      "type": "taskList",
      "content": [
        {
          "type": "taskItem",
          "attrs": { "checked": false },
          "content": [
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "准备考试材料" }]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## RLS 策略

已启用行级安全（RLS），用户只能访问自己的笔记：
```sql
-- 策略：用户只能访问自己的笔记
CREATE POLICY "Users can only access their own notes"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 触发器

### 自动更新 updated_at
每次更新笔记时，自动更新 `updated_at` 字段：
```sql
CREATE TRIGGER trigger_update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();
```

---

## 注意事项

1. **唯一性约束**：同一用户同一天只能有一个笔记
2. **元数据提取**：`tags`、`pending_tasks_count` 等需要在应用层提取并更新
3. **性能优化**：使用 `has_pending_tasks` 快速筛选，避免扫描 JSONB
4. **全文搜索**：使用 `plain_text` 字段进行搜索，而不是解析 JSON

---

## 迁移策略

### 从现有 tasks 表迁移（可选）
如果需要将现有任务迁移到笔记格式，可以执行：
```sql
-- 按日期分组，将任务转换为笔记
INSERT INTO notes (user_id, note_date, content, tags, has_pending_tasks, pending_tasks_count, completed_tasks_count)
SELECT 
  user_id,
  DATE(COALESCE(deadline_datetime, created_at)) as note_date,
  -- 构造 Tiptap JSON（简化版）
  jsonb_build_object(
    'type', 'doc',
    'content', jsonb_agg(
      jsonb_build_object(
        'type', 'taskItem',
        'attrs', jsonb_build_object('checked', completed),
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', title)
            )
          )
        )
      )
    )
  ) as content,
  array_agg(DISTINCT tag) FILTER (WHERE tag IS NOT NULL) as tags,
  bool_or(NOT completed) as has_pending_tasks,
  COUNT(*) FILTER (WHERE NOT completed) as pending_tasks_count,
  COUNT(*) FILTER (WHERE completed) as completed_tasks_count
FROM tasks
LEFT JOIN LATERAL unnest(COALESCE(tags, ARRAY[]::text[])) as tag ON true
GROUP BY user_id, DATE(COALESCE(deadline_datetime, created_at))
ON CONFLICT (user_id, note_date) DO NOTHING;
```

---

**创建日期**: 2024-10-24  
**版本**: v1.0





