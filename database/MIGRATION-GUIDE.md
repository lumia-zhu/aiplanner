# 时间估计字段迁移指南

## 📋 概述

将 `tasks` 表的 `estimated_duration` 字段从 `TEXT` 类型迁移到 `INTEGER` 类型（存储分钟数），以支持标准化的时间管理功能。

## 🎯 迁移目标

- **旧格式**：`TEXT` - 如 "2小时"、"120分钟"、"2h"
- **新格式**：`INTEGER` - 统一存储为分钟数（如 120）
- **Buffer标记**：10000+ 表示含buffer（如 10120 = 100分钟 + 20%buffer）

## 📝 迁移步骤

### 1. 备份数据库（⚠️ 必须！）

```bash
# 使用 Supabase Dashboard 导出备份
# 或使用 pg_dump
pg_dump -h your-db-host -U your-username -d your-database > backup.sql
```

### 2. 执行迁移脚本

在 Supabase SQL Editor 中执行：

```sql
-- 复制 migrate-estimated-duration-to-integer.sql 的内容并执行
```

### 3. 验证迁移结果

```sql
-- 复制 verify-estimated-duration-migration.sql 的内容并执行
```

检查输出：
- ✅ 字段类型应为 `integer`
- ✅ 约束 `estimated_duration_positive` 已创建
- ✅ 索引 `idx_tasks_estimated_duration` 已创建
- ⚠️ 查看是否有转换失败的记录

### 4. 处理转换失败的记录（如果有）

如果有无法自动转换的格式，需要手动处理：

```sql
-- 查看失败的记录
SELECT id, title, estimated_duration_old 
FROM tasks 
WHERE estimated_duration IS NULL 
  AND estimated_duration_old IS NOT NULL;

-- 手动更新（示例）
UPDATE tasks 
SET estimated_duration = 120  -- 手动计算的分钟数
WHERE id = 'your-task-id';
```

### 5. 确认无误后删除备份字段

```sql
-- ⚠️ 确认迁移完全成功后再执行
ALTER TABLE tasks DROP COLUMN IF EXISTS estimated_duration_old;
```

## 🔄 回滚（如果需要）

如果迁移出现问题，可以回滚：

```sql
-- 复制 rollback-estimated-duration-migration.sql 的内容并执行
```

**注意**：回滚会丢失迁移后的新数据！

## 📊 数据格式说明

### 存储格式

| 用户输入 | 存储值 | 说明 |
|---------|-------|------|
| 30分钟 | 30 | 普通时间 |
| 2小时 | 120 | 普通时间 |
| 2小时30分钟 | 150 | 普通时间 |
| 2小时 + buffer | 10144 | 120分钟 + 20% = 144分钟 |
| 100分钟 + buffer | 10120 | 100分钟 + 20% = 120分钟 |

### 编码规则

```typescript
// 不含buffer：直接存储分钟数
estimated_duration = minutes

// 含buffer：10000 + (minutes * 1.2)
estimated_duration = 10000 + Math.ceil(minutes * 1.2)
```

### 解码规则

```typescript
if (estimated_duration >= 10000) {
  // 含buffer
  totalMinutes = estimated_duration - 10000
  originalMinutes = Math.round(totalMinutes / 1.2)
  hasBuffer = true
} else {
  // 不含buffer
  originalMinutes = estimated_duration
  hasBuffer = false
}
```

## 🧪 测试案例

执行迁移后，可以测试以下场景：

```sql
-- 测试1：插入普通时间
INSERT INTO tasks (user_id, title, estimated_duration) 
VALUES ('your-user-id', '测试任务1', 120);

-- 测试2：插入含buffer的时间（100分钟 + buffer）
INSERT INTO tasks (user_id, title, estimated_duration) 
VALUES ('your-user-id', '测试任务2', 10120);

-- 测试3：查询和排序
SELECT title, estimated_duration 
FROM tasks 
WHERE estimated_duration IS NOT NULL
ORDER BY estimated_duration ASC;

-- 测试4：统计总时长
SELECT 
  SUM(CASE WHEN estimated_duration < 10000 THEN estimated_duration ELSE estimated_duration - 10000 END) / 60.0 as total_hours
FROM tasks
WHERE user_id = 'your-user-id' AND completed = false;
```

## 📞 常见问题

### Q1: 为什么要迁移到 INTEGER？
**A:** 标准化存储便于计算、排序、统计，支持更多高级功能（如时间预警、任务排程等）。

### Q2: 旧数据会丢失吗？
**A:** 不会。迁移脚本会保留 `estimated_duration_old` 字段作为备份，确认无误后才删除。

### Q3: 转换失败怎么办？
**A:** 查看 `estimated_duration_old` 字段，手动计算分钟数后更新 `estimated_duration`。

### Q4: 如何标记buffer？
**A:** 应用层处理。存储时：`10000 + (minutes * 1.2)`；读取时检查 `>= 10000`。

### Q5: 现有应用会不会出错？
**A:** 需要同步更新前端代码（下一步）。建议在低峰时段迁移。

## ✅ 迁移检查清单

- [ ] 已备份数据库
- [ ] 执行迁移脚本成功
- [ ] 验证脚本显示无错误
- [ ] 处理了所有转换失败的记录（如果有）
- [ ] 测试了插入、查询、更新功能
- [ ] 前端代码已同步更新
- [ ] 在生产环境测试通过
- [ ] 删除了备份字段（可选）

## 📅 迁移时间建议

- **开发环境**：随时可以迁移
- **生产环境**：建议在低峰时段（如凌晨）执行，预计耗时 < 5分钟

## 🆘 紧急回滚步骤

如果迁移后发现严重问题：

1. 立即执行回滚脚本
2. 恢复前端代码到旧版本
3. 通知用户数据已恢复
4. 分析失败原因，修复后再次尝试










