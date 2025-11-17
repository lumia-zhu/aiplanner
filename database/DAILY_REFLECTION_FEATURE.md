# 每日反思提醒功能

## 功能说明

允许用户在个人资料设置中配置每日反思提醒时间，系统会在设定的时间提醒用户进行每日总结和反思。

## 特性

- ✅ **可选功能**：默认不启用，只有用户主动设置时间才生效
- ✅ **灵活时间**：用户可以选择任意时间（24小时制）
- ✅ **一键清除**：支持快速清除提醒设置
- ✅ **友好提示**：实时显示提醒时间和效果说明

## 数据库变更

### 新增字段

```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS daily_reflection_time TIME;
```

| 字段名 | 类型 | 可空 | 说明 |
|-------|------|------|------|
| `daily_reflection_time` | TIME | YES | 每日反思提醒时间（HH:mm 格式） |

### 示例数据

```sql
-- 设置晚上 9:00 提醒
UPDATE user_profiles 
SET daily_reflection_time = '21:00:00' 
WHERE user_id = 'xxx';

-- 清除提醒
UPDATE user_profiles 
SET daily_reflection_time = NULL 
WHERE user_id = 'xxx';
```

## 类型定义

### UserProfile

```typescript
export interface UserProfile {
  // ... 其他字段
  daily_reflection_time?: string // 🆕 每日反思提醒时间（HH:mm 格式，如 "21:00"）
}
```

### UserProfileInput

```typescript
export interface UserProfileInput {
  // ... 其他字段
  daily_reflection_time?: string // 🆕 每日反思提醒时间（HH:mm 格式）
}
```

## UI 界面

### 个人资料弹窗

在"常用工作场所"之后添加了时间选择器：

```
┌─────────────────────────────────────┐
│ 每日反思提醒时间 (可选)              │
│ ┌─────────────────┬────────┐        │
│ │ [21:00]         │ 清除   │        │
│ └─────────────────┴────────┘        │
│ 每天 21:00 会提醒你进行反思总结      │
└─────────────────────────────────────┘
```

### 交互逻辑

1. **未设置时**：
   - 时间选择器为空
   - 提示文字："未设置提醒时间，可以根据需要选择"

2. **设置后**：
   - 显示选择的时间
   - 出现"清除"按钮
   - 提示文字："每天 HH:mm 会提醒你进行反思总结"

3. **清除操作**：
   - 点击"清除"按钮
   - 时间选择器清空
   - 恢复默认提示文字

## 使用场景

### 用户视角

1. 用户打开个人资料设置
2. 选择"每日反思提醒时间"（如 21:00）
3. 点击"保存"
4. 系统每天 21:00 会发送提醒

### 系统视角

```typescript
// 检查是否需要发送提醒
if (userProfile.daily_reflection_time) {
  const currentTime = new Date().getHours() + ':' + new Date().getMinutes()
  if (currentTime === userProfile.daily_reflection_time) {
    sendReflectionReminder(user)
  }
}
```

## 未来扩展

### Phase 1（当前）
- ✅ 基础时间设置
- ✅ 数据库存储
- ✅ UI 界面

### Phase 2（计划中）
- ⏳ 实际提醒功能（浏览器通知 / 邮件）
- ⏳ 反思模板和引导
- ⏳ 历史反思记录查看
- ⏳ 提醒频率设置（每日/每周）

### Phase 3（长期）
- ⏳ 智能提醒时间推荐
- ⏳ 基于用户习惯的个性化提醒
- ⏳ 反思数据分析和洞察

## 注意事项

1. **时区处理**：当前使用用户本地时区，未来需要考虑跨时区场景
2. **提醒方式**：当前仅存储时间，实际提醒功能需要额外实现（如浏览器 Notification API 或后端定时任务）
3. **隐私保护**：反思内容属于个人隐私，需要确保数据安全

## 测试清单

- [ ] 设置提醒时间并保存
- [ ] 清除提醒时间并保存
- [ ] 修改已设置的提醒时间
- [ ] 刷新页面后提醒时间正确显示
- [ ] 数据库字段正确存储和读取

## 相关文件

- `src/types/index.ts` - 类型定义
- `src/components/UserProfileModal.tsx` - UI 组件
- `src/lib/userProfile.ts` - 数据库操作
- `database/add-daily-reflection-time.sql` - 数据库迁移

