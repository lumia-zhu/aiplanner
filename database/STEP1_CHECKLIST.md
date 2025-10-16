# ✅ 第一步完成检查清单 - 数据库创建

## 📋 已完成的工作

### 1. 创建的文件
- ✅ `create-user-profiles-table.sql` - 数据库表创建脚本
- ✅ `user-profiles-sample-data.sql` - 示例数据
- ✅ `verify-user-profiles-table.sql` - 验证脚本
- ✅ `USER_PROFILES_SETUP.md` - 详细设置指南
- ✅ `STEP1_CHECKLIST.md` - 本文件

### 2. 表结构设计
```sql
user_profiles
├── id (UUID, 主键)
├── user_id (UUID, 外键 -> users.id)
├── major (VARCHAR(100))      -- 专业
├── grade (VARCHAR(50))       -- 年级
├── challenges (TEXT[])       -- 挑战标签数组
├── workplaces (TEXT[])       -- 工作场所标签数组
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

### 3. 年级选项
- **本科**: 大一、大二、大三、大四
- **硕士**: 硕一、硕二、硕三
- **博士**: 博一、博二、博三、博四、博五

## 🚀 执行步骤

### Step 1: 登录 Supabase
1. 访问 https://app.supabase.com
2. 选择你的项目 (aiplanner 项目)

### Step 2: 打开 SQL Editor
1. 点击左侧菜单的 **SQL Editor**
2. 点击 **New query** 创建新查询

### Step 3: 执行创建脚本
1. 打开 `create-user-profiles-table.sql` 文件
2. 复制全部内容
3. 粘贴到 SQL Editor
4. 点击 **Run** 按钮 (或按 Ctrl+Enter)
5. 等待执行完成

### Step 4: 验证创建结果
1. 创建另一个新查询
2. 打开 `verify-user-profiles-table.sql` 文件
3. 复制全部内容
4. 粘贴到 SQL Editor
5. 点击 **Run** 按钮
6. 检查输出结果

## ✅ 验证清单

执行完成后,请确认以下内容:

### 必须检查项
- [ ] 表 `user_profiles` 已创建
- [ ] 包含 8 个字段 (id, user_id, major, grade, challenges, workplaces, created_at, updated_at)
- [ ] `user_id` 字段有外键约束指向 `users.id`
- [ ] `user_id` 字段有唯一约束 (UNIQUE)
- [ ] 索引 `idx_user_profiles_user_id` 已创建
- [ ] 触发器 `trigger_update_user_profiles_updated_at` 已创建

### 预期验证结果

#### 1. 表检查
```
✅ 表 user_profiles 已创建
```

#### 2. 表结构
应该看到 8 个字段:
- id (uuid)
- user_id (uuid)
- major (character varying, 100)
- grade (character varying, 50)
- challenges (ARRAY)
- workplaces (ARRAY)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

#### 3. 索引
应该看到至少 2 个索引:
- `user_profiles_pkey` (主键)
- `idx_user_profiles_user_id` (user_id 索引)

#### 4. 触发器
应该看到:
- `trigger_update_user_profiles_updated_at`

## 🐛 可能遇到的问题

### 问题 1: "relation users does not exist"
**原因**: users 表不存在  
**解决**: 请先确保你的数据库中已有 users 表

### 问题 2: "permission denied"
**原因**: 没有足够的权限  
**解决**: 确保你使用的是项目管理员账号

### 问题 3: 触发器函数已存在
**原因**: 之前已经创建过  
**解决**: 这是正常的,脚本使用了 `CREATE OR REPLACE`,会自动覆盖

## 📸 截图示例

执行成功后,你应该看到类似的输出:
```
Success. No rows returned
CREATE TABLE
CREATE INDEX
COMMENT
CREATE FUNCTION
CREATE TRIGGER
```

## ✅ 第一步完成确认

完成以上所有检查后,请确认:
- [ ] 所有 SQL 脚本执行成功,无错误
- [ ] 验证脚本运行结果符合预期
- [ ] 表结构、索引、触发器都已正确创建

**完成后请告诉我**: "第一步已完成,验证通过" 或提供遇到的问题。

## 📝 备注

- 这一步只创建数据库结构,不涉及代码
- 标签功能 (challenges, workplaces) 暂时预留为空数组
- 下一步将创建 TypeScript 类型定义和数据库操作函数



