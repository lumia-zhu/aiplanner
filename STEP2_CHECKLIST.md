# ✅ 第二步完成检查清单 - TypeScript 类型定义与数据库操作

## 📋 已完成的工作

### 1. 扩展的类型定义文件
**文件**: `src/types/index.ts`

新增的类型和常量:
- ✅ `UserProfile` - 用户个人资料完整类型
- ✅ `UserProfileInput` - 用户个人资料输入类型
- ✅ `GRADE_OPTIONS` - 年级选项（按学历分组）
- ✅ `ALL_GRADES` - 所有年级选项（扁平化数组）
- ✅ `CHALLENGE_TAGS` - 预定义挑战标签
- ✅ `WORKPLACE_TAGS` - 预定义工作场所标签
- ✅ `AuthUser` - 扩展，添加 `profile` 字段

### 2. 数据库操作函数
**文件**: `src/lib/userProfile.ts`

创建的函数:
- ✅ `getUserProfile(userId)` - 获取用户个人资料
- ✅ `createUserProfile(userId, profileInput)` - 创建个人资料
- ✅ `updateUserProfile(userId, profileInput)` - 更新个人资料
- ✅ `upsertUserProfile(userId, profileInput)` - 创建或更新
- ✅ `deleteUserProfile(userId)` - 删除个人资料

### 3. 测试指南
**文件**: `src/lib/__tests__/userProfile.test.md`

## 📊 类型定义详情

### UserProfile 接口
```typescript
interface UserProfile {
  id: string              // 个人资料 ID
  user_id: string         // 用户 ID
  major?: string          // 专业
  grade?: string          // 年级
  challenges: string[]    // 挑战标签数组
  workplaces: string[]    // 工作场所标签数组
  created_at: string      // 创建时间
  updated_at: string      // 更新时间
}
```

### 年级选项
```typescript
// 按学历分组
GRADE_OPTIONS = {
  undergraduate: ['大一', '大二', '大三', '大四'],
  master: ['硕一', '硕二', '硕三'],
  phd: ['博一', '博二', '博三', '博四', '博五']
}

// 扁平化（用于下拉选择）
ALL_GRADES = ['大一', '大二', ..., '博五']
```

### 预定义标签
```typescript
CHALLENGE_TAGS = [
  '拖延', '夜猫子', '容易分心', 
  '完美主义', '时间估算不准', '优先级不清'
]

WORKPLACE_TAGS = [
  '教室', '图书馆', '工位', '咖啡厅', 
  '宿舍', '自习室', '家里'
]
```

## 🔍 函数功能说明

### 1. getUserProfile
**功能**: 获取用户个人资料  
**返回**: `UserProfile | null`  
**特点**: 如果用户没有个人资料，返回 `null`

### 2. createUserProfile
**功能**: 创建新的个人资料  
**返回**: `{ success: boolean; data?: UserProfile; error?: string }`  
**注意**: 如果已存在会报错

### 3. updateUserProfile
**功能**: 更新现有个人资料  
**返回**: `{ success: boolean; data?: UserProfile; error?: string }`  
**特点**: 只更新提供的字段，未提供的字段保持不变

### 4. upsertUserProfile (推荐)
**功能**: 创建或更新（如果存在则更新，不存在则创建）  
**返回**: `{ success: boolean; data?: UserProfile; error?: string }`  
**推荐**: 这是最常用的函数，不需要判断是否存在

### 5. deleteUserProfile
**功能**: 删除个人资料  
**返回**: `{ success: boolean; error?: string }`

## ✅ 验证步骤

### 方法 1: 代码审查 ✅
- [x] 检查 `src/types/index.ts` 文件
  - 确认新增了 `UserProfile` 相关类型
  - 确认定义了年级和标签常量
- [x] 检查 `src/lib/userProfile.ts` 文件
  - 确认包含 5 个数据库操作函数
  - 确认所有函数都有完整的错误处理

### 方法 2: TypeScript 编译检查
运行以下命令检查是否有类型错误:
```bash
cd task-manager
npm run build
```

预期结果: 构建成功，无类型错误

### 方法 3: 在代码中测试导入
创建一个测试文件验证类型是否可以正常导入:
```typescript
// 测试导入
import { 
  UserProfile, 
  UserProfileInput, 
  ALL_GRADES, 
  CHALLENGE_TAGS 
} from '@/types'

import { 
  getUserProfile, 
  upsertUserProfile 
} from '@/lib/userProfile'

// 如果没有报错，说明导入成功
console.log('类型和函数导入成功')
```

## 📝 使用示例

### 示例 1: 获取并显示用户个人资料
```typescript
const profile = await getUserProfile(userId)
if (profile) {
  console.log(`专业: ${profile.major}`)
  console.log(`年级: ${profile.grade}`)
  console.log(`挑战: ${profile.challenges.join(', ')}`)
}
```

### 示例 2: 保存用户个人资料（推荐方式）
```typescript
const result = await upsertUserProfile(userId, {
  major: '计算机科学',
  grade: '大三',
  challenges: ['拖延', '夜猫子'],
  workplaces: ['图书馆', '咖啡厅']
})

if (result.success) {
  console.log('保存成功:', result.data)
} else {
  console.error('保存失败:', result.error)
}
```

### 示例 3: 只更新部分字段
```typescript
// 只更新年级，其他字段不变
const result = await updateUserProfile(userId, {
  grade: '大四'
})
```

## 🎯 第二步完成确认

请确认以下内容:

- [ ] `src/types/index.ts` 已正确扩展
- [ ] `src/lib/userProfile.ts` 已创建
- [ ] 没有 TypeScript 类型错误
- [ ] 可以正常导入新的类型和函数
- [ ] 理解了各个函数的作用

## ⚠️ 注意事项

1. **数据库表必须存在**: 第一步创建的 `user_profiles` 表必须存在
2. **Supabase 客户端**: 确保 `@/lib/supabase-client` 可以正常工作
3. **RLS 策略**: 如果遇到权限问题，需要设置 Row Level Security 策略
4. **空数组默认值**: `challenges` 和 `workplaces` 默认为空数组 `[]`

## 🐛 常见问题

### Q: 导入路径报错
**A**: 确保使用了正确的路径别名:
- `@/types` → `src/types`
- `@/lib/userProfile` → `src/lib/userProfile`

### Q: Supabase 客户端导入错误
**A**: 检查 `src/lib/supabase-client.ts` 文件是否存在，导出了 `createClient` 函数

### Q: 类型不匹配
**A**: 运行 `npm run build` 查看详细的类型错误信息

## ⏭️ 下一步

第二步完成后，我们将进入**第三步:创建用户个人资料编辑弹窗组件**

包括:
1. 创建弹窗组件 `UserProfileModal.tsx`
2. 添加专业输入框
3. 添加年级下拉选择
4. 集成到 Dashboard 页面
5. 测试完整功能

**完成后请告诉我**: "第二步已完成" 或提供遇到的问题。

