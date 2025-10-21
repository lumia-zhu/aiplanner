# 任务标签系统功能文档

## 📋 功能概述

为任务管理系统添加了完整的标签功能,支持预设标签和用户自定义标签,帮助用户更好地分类和管理任务。

### ✨ 核心特性

- ✅ **预设标签**: 简单、困难、重要、紧急 (带有不同颜色和图标)
- ✅ **自定义标签**: 用户可以创建自己的标签
- ✅ **标签池**: 自动保存用户创建的标签,下次可快速选择
- ✅ **标签限制**: 每个任务最多3个标签
- ✅ **向后兼容**: 完全兼容现有数据,老任务正常显示
- ✅ **可选功能**: 标签是完全可选的,用户可以不添加

---

## 🎨 UI展示

### 1. 任务表单中的标签选择器
```
┌─────────────────────────────────────┐
│ 标签 (最多3个)                      │
├─────────────────────────────────────┤
│ 预设标签:                           │
│ [✅简单] [🔥困难] [⭐重要] [⚡紧急] │
├─────────────────────────────────────┤
│ 我的标签: (如果有自定义标签)        │
│ [🏷️学习] [🏷️工作]                 │
├─────────────────────────────────────┤
│ [输入自定义标签______] [+ 添加]     │
├─────────────────────────────────────┤
│ 当前任务标签: ✅简单 ⭐重要         │
└─────────────────────────────────────┘
```

### 2. 任务卡片中的标签显示
```
┌─────────────────────────────────────┐
│ ☐ 完成机器学习作业                  │
│ [✅简单] [⭐重要]                   │
│ 📅 2025-03-15 15:00  🔴 高优先级   │
└─────────────────────────────────────┘
```

---

## 🗄️ 数据库设计

### tasks 表变更
```sql
-- 新增字段
ALTER TABLE tasks 
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- 新增索引(用于按标签查询)
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);
```

### user_profiles 表变更
```sql
-- 新增字段(用户自定义标签池)
ALTER TABLE user_profiles 
ADD COLUMN custom_task_tags TEXT[] DEFAULT '{}';
```

---

## 📝 TypeScript 类型定义

### Task 接口
```typescript
export interface Task {
  // ... 现有字段
  tags?: string[]  // 可选: 任务标签(最多3个)
}
```

### UserProfile 接口
```typescript
export interface UserProfile {
  // ... 现有字段
  custom_task_tags?: string[]  // 可选: 用户自定义标签池(最多20个)
}
```

### 预设标签常量
```typescript
export const PRESET_TASK_TAGS = [
  'easy',      // 简单
  'difficult', // 困难
  'important', // 重要
  'urgent',    // 紧急
] as const

export const TASK_TAG_LABELS: Record<string, string> = {
  easy: '简单',
  difficult: '困难',
  important: '重要',
  urgent: '紧急',
}
```

### 标签颜色配置
```typescript
export const TASK_TAG_COLORS = {
  easy: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    icon: '✅'
  },
  difficult: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    icon: '🔥'
  },
  important: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    icon: '⭐'
  },
  urgent: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    icon: '⚡'
  },
  default: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
    icon: '🏷️'
  }
}
```

---

## 🔧 API 函数

### 标签池管理 (userProfile.ts)

#### 获取用户自定义标签池
```typescript
getUserCustomTaskTags(userId: string): Promise<string[]>
```

#### 添加单个自定义标签
```typescript
addCustomTaskTag(userId: string, tag: string): Promise<{
  success: boolean
  tags?: string[]
  error?: string
}>
```

#### 批量添加自定义标签
```typescript
addCustomTaskTags(userId: string, tags: string[]): Promise<{
  success: boolean
  tags?: string[]
  error?: string
}>
```

#### 删除自定义标签
```typescript
removeCustomTaskTag(userId: string, tag: string): Promise<{
  success: boolean
  tags?: string[]
  error?: string
}>
```

#### 清空标签池
```typescript
clearCustomTaskTags(userId: string): Promise<{
  success: boolean
  error?: string
}>
```

### 任务CRUD (tasks.ts)

#### 创建任务(支持tags)
```typescript
createTask(userId: string, taskData: {
  title: string
  description?: string
  deadline_time?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]  // ⭐ 新增
}): Promise<{ task?: Task; error?: string }>
```

#### 更新任务(支持tags)
```typescript
updateTask(taskId: string, updates: {
  title?: string
  description?: string
  deadline_time?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]  // ⭐ 新增
}): Promise<{ task?: Task; error?: string }>
```

---

## 🎨 UI 组件

### TaskTagBadge (标签徽章)
**文件**: `src/components/TaskTagBadge.tsx`

**功能**: 显示单个任务标签徽章

**Props**:
```typescript
interface TaskTagBadgeProps {
  tag: string                // 标签名称
  size?: 'sm' | 'md'        // 徽章尺寸
  showIcon?: boolean         // 是否显示图标
  onClick?: () => void       // 点击回调
  className?: string         // 额外样式
}
```

**使用示例**:
```tsx
<TaskTagBadge tag="important" size="sm" />
<TaskTagBadge tag="学习" size="md" showIcon={false} />
```

### TaskTagSelector (标签选择器)
**文件**: `src/components/TaskTagSelector.tsx`

**功能**: 在任务表单中选择和管理标签

**Props**:
```typescript
interface TaskTagSelectorProps {
  selectedTags: string[]                     // 已选中的标签
  customTags: string[]                       // 用户的自定义标签池
  onTagsChange: (tags: string[]) => void     // 标签变化回调
  onAddCustomTag?: (tag: string) => void     // 添加新标签回调
}
```

**使用示例**:
```tsx
<TaskTagSelector
  selectedTags={tags}
  customTags={userProfile?.custom_task_tags || []}
  onTagsChange={setTags}
  onAddCustomTag={handleAddCustomTag}
/>
```

---

## 🔐 验证规则

### 标签名称验证
```typescript
export const TASK_TAG_CONFIG = {
  MAX_TAGS_PER_TASK: 3,        // 每个任务最多3个标签
  MAX_CUSTOM_TAGS: 20,          // 用户最多保存20个自定义标签
  MAX_TAG_LENGTH: 10,           // 每个标签最多10个字符
  TAG_REGEX: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,  // 只允许中文、字母、数字
}
```

### 验证函数
```typescript
export function validateTagName(tag: string): string | null {
  if (!tag.trim()) {
    return '标签不能为空'
  }
  if (tag.length > TASK_TAG_CONFIG.MAX_TAG_LENGTH) {
    return `标签最多${TASK_TAG_CONFIG.MAX_TAG_LENGTH}个字符`
  }
  if (!TASK_TAG_CONFIG.TAG_REGEX.test(tag)) {
    return '标签只能包含中文、字母和数字'
  }
  return null  // 验证通过
}
```

---

## 🚀 使用流程

### 1. 创建任务时添加标签
1. 点击"新建任务"按钮
2. 填写任务标题、描述等信息
3. 在标签区域:
   - 点击预设标签(简单、困难、重要、紧急)
   - 或选择之前创建的自定义标签
   - 或输入新的自定义标签并点击"+ 添加"
4. 最多选择3个标签
5. 点击"创建任务"保存

### 2. 编辑任务标签
1. 点击任务卡片的"编辑"按钮
2. 在弹出的表单中修改标签
3. 可以添加、删除或更换标签
4. 点击"保存修改"

### 3. 查看任务标签
- 标签会显示在任务标题下方
- 不同类型的标签有不同的颜色和图标
- 预设标签显示中文名称
- 自定义标签显示原始名称

---

## ⚙️ 配置说明

### 修改预设标签
编辑 `src/types/index.ts`:
```typescript
export const PRESET_TASK_TAGS = [
  'easy',      // 简单
  'difficult', // 困难
  'important', // 重要
  'urgent',    // 紧急
  // 添加新的预设标签
  'newTag',    // 新标签
] as const

export const TASK_TAG_LABELS: Record<string, string> = {
  easy: '简单',
  difficult: '困难',
  important: '重要',
  urgent: '紧急',
  newTag: '新标签', // 添加对应的中文名称
}

export const TASK_TAG_COLORS = {
  // ... 现有颜色配置
  newTag: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    icon: '🆕'
  }
}
```

### 修改标签数量限制
编辑 `src/types/index.ts`:
```typescript
export const TASK_TAG_CONFIG = {
  MAX_TAGS_PER_TASK: 3,        // 修改这个值
  MAX_CUSTOM_TAGS: 20,          // 修改这个值
  MAX_TAG_LENGTH: 10,           // 修改这个值
  TAG_REGEX: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,
}
```

---

## 🔄 迁移步骤

### 1. 执行数据库迁移
```bash
# 在 Supabase Dashboard 中执行
# 文件: database/add-task-tags.sql
```

### 2. 验证迁移
```sql
-- 检查 tasks.tags 字段
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'tags';

-- 检查 user_profiles.custom_task_tags 字段
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'custom_task_tags';
```

---

## ✅ 测试清单

### 功能测试
- [ ] 创建任务时添加预设标签
- [ ] 创建任务时添加自定义标签
- [ ] 编辑任务时修改标签
- [ ] 查看任务时正确显示标签
- [ ] 标签颜色和图标正确显示
- [ ] 标签数量限制(最多3个)生效
- [ ] 标签字符限制(最多10个字符)生效
- [ ] 标签验证(只允许中文、字母、数字)生效
- [ ] 自定义标签保存到用户标签池
- [ ] 用户标签池在下次选择时可用
- [ ] 删除标签功能正常
- [ ] 老任务(没有标签)正常显示

### 兼容性测试
- [ ] 老用户(没有user_profiles记录)功能正常
- [ ] 老任务(没有tags字段)功能正常
- [ ] 数据库迁移前后功能一致

---

## 📞 故障排查

### 问题1: 标签不显示
**原因**: 数据库迁移未执行
**解决**: 执行 `database/add-task-tags.sql`

### 问题2: 自定义标签不保存
**原因**: user_profiles 表没有 custom_task_tags 字段
**解决**: 执行数据库迁移脚本

### 问题3: 标签池为空
**原因**: 用户首次使用,还没有创建自定义标签
**解决**: 正常现象,用户创建标签后会自动保存

---

## 📈 未来扩展

### 可选功能
1. **标签筛选**: 按标签筛选任务
2. **标签统计**: 显示标签使用频率
3. **标签推荐**: AI根据任务内容推荐标签
4. **标签管理**: 统一管理所有标签(重命名、合并、删除)
5. **标签颜色自定义**: 用户可以自定义标签颜色
6. **标签分组**: 创建标签类别

---

## 📝 更新日志

### v1.0.0 (2025-01-16)
- ✨ 初始版本发布
- ✅ 支持预设标签(简单、困难、重要、紧急)
- ✅ 支持用户自定义标签
- ✅ 标签池自动保存
- ✅ 完全向后兼容
- ✅ 完整的UI组件和API

---

## 👥 开发团队

- **开发者**: AI Assistant
- **日期**: 2025-01-16
- **版本**: 1.0.0















