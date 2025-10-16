# 用户个人资料功能 - 数据库设置指南

## 📋 功能说明

这个功能允许用户设置和管理个人资料,包括:
- **专业**: 用户的专业方向
- **年级**: 本科(大一~大四)、硕士(硕一~硕三)、博士(博一~博五)
- **挑战**: 用户面临的挑战标签(如拖延、夜猫子等)
- **工作场所**: 用户常用的工作场所(如图书馆、咖啡厅等)

## 🗄️ 数据库表结构

### `user_profiles` 表

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `id` | UUID | 主键 | 自动生成 |
| `user_id` | UUID | 用户ID(外键) | - |
| `major` | VARCHAR(100) | 专业 | NULL |
| `grade` | VARCHAR(50) | 年级 | NULL |
| `challenges` | TEXT[] | 挑战标签数组 | `{}` |
| `workplaces` | TEXT[] | 工作场所标签数组 | `{}` |
| `created_at` | TIMESTAMP | 创建时间 | NOW() |
| `updated_at` | TIMESTAMP | 更新时间 | NOW() |

## 🚀 安装步骤

### 1. 在 Supabase 中执行 SQL

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 创建新查询
5. 复制 `create-user-profiles-table.sql` 的内容
6. 点击 **Run** 执行

### 2. 验证表是否创建成功

在 SQL Editor 中执行:

```sql
-- 查看表结构
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 查看索引
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'user_profiles';
```

### 3. 检查触发器

```sql
-- 查看触发器
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'user_profiles';
```

## 📝 年级选项说明

### 本科生
- 大一
- 大二
- 大三
- 大四

### 硕士研究生
- 硕一
- 硕二
- 硕三

### 博士研究生
- 博一
- 博二
- 博三
- 博四
- 博五

## 🧪 测试数据

可以参考 `user-profiles-sample-data.sql` 文件中的示例。

在执行测试数据前,请先获取你的用户 ID:

```sql
-- 查询你的用户 ID
SELECT id, email, username FROM users WHERE email = 'your-email@example.com';
```

然后替换示例中的 `'your-user-id-here'` 为实际的用户 ID。

## 🔒 权限设置 (RLS)

如果你启用了 Row Level Security,需要添加以下策略:

```sql
-- 允许用户查看自己的个人资料
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 允许用户插入自己的个人资料
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 允许用户更新自己的个人资料
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 允许用户删除自己的个人资料
CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (auth.uid() = user_id);
```

## ✅ 验证清单

完成后,请检查:
- [ ] 表 `user_profiles` 已创建
- [ ] 索引 `idx_user_profiles_user_id` 已创建
- [ ] 触发器 `trigger_update_user_profiles_updated_at` 已创建
- [ ] 可以成功插入测试数据
- [ ] 可以成功查询数据
- [ ] `updated_at` 字段在更新时自动更新

## 🐛 常见问题

### Q: 外键约束错误
**A**: 确保 `users` 表已存在,且插入的 `user_id` 在 `users` 表中存在。

### Q: 数组字段如何操作?
**A**: 
```sql
-- 插入数组
INSERT INTO user_profiles (user_id, challenges) 
VALUES ('user-id', ARRAY['拖延', '夜猫子']);

-- 更新数组
UPDATE user_profiles 
SET challenges = ARRAY['拖延', '容易分心']
WHERE user_id = 'user-id';

-- 追加元素到数组
UPDATE user_profiles 
SET challenges = array_append(challenges, '完美主义')
WHERE user_id = 'user-id';
```

## 📞 下一步

数据库创建完成后,继续:
1. 创建 TypeScript 类型定义
2. 创建数据库操作函数
3. 创建 UI 组件





