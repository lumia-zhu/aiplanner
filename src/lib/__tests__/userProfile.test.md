# 用户个人资料功能测试指南

## 📋 测试准备

在浏览器的开发者控制台中测试这些函数。

### 1. 打开应用
```
http://localhost:3000/dashboard
```

### 2. 打开浏览器开发者工具
- Chrome/Edge: 按 F12 或 Ctrl+Shift+I
- 切换到 Console 标签

## 🧪 测试用例

### 测试 1: 获取用户个人资料（首次获取，应该返回 null）

```javascript
// 导入函数
import { getUserProfile } from '@/lib/userProfile'

// 获取当前用户 ID（从 localStorage）
const user = JSON.parse(localStorage.getItem('user') || '{}')
const userId = user.id

// 测试获取个人资料
const profile = await getUserProfile(userId)
console.log('用户个人资料:', profile)
// 预期结果: null (如果是首次获取)
```

### 测试 2: 创建用户个人资料

```javascript
import { createUserProfile } from '@/lib/userProfile'

const userId = JSON.parse(localStorage.getItem('user') || '{}').id

const profileData = {
  major: '计算机科学',
  grade: '大三',
  challenges: ['拖延', '夜猫子'],
  workplaces: ['图书馆', '咖啡厅']
}

const result = await createUserProfile(userId, profileData)
console.log('创建结果:', result)
// 预期结果: { success: true, data: {...} }
```

### 测试 3: 获取已创建的个人资料

```javascript
import { getUserProfile } from '@/lib/userProfile'

const userId = JSON.parse(localStorage.getItem('user') || '{}').id
const profile = await getUserProfile(userId)
console.log('用户个人资料:', profile)
// 预期结果: 包含刚才创建的数据
```

### 测试 4: 更新用户个人资料

```javascript
import { updateUserProfile } from '@/lib/userProfile'

const userId = JSON.parse(localStorage.getItem('user') || '{}').id

const updates = {
  major: '软件工程',
  grade: '大四',
  challenges: ['拖延', '容易分心', '完美主义']
}

const result = await updateUserProfile(userId, updates)
console.log('更新结果:', result)
// 预期结果: { success: true, data: {...} } 包含更新后的数据
```

### 测试 5: Upsert 操作（创建或更新）

```javascript
import { upsertUserProfile } from '@/lib/userProfile'

const userId = JSON.parse(localStorage.getItem('user') || '{}').id

const profileData = {
  major: '人工智能',
  grade: '硕一',
  challenges: ['时间估算不准'],
  workplaces: ['实验室', '自习室']
}

const result = await upsertUserProfile(userId, profileData)
console.log('Upsert 结果:', result)
// 预期结果: { success: true, data: {...} }
```

### 测试 6: 部分更新（只更新某些字段）

```javascript
import { updateUserProfile } from '@/lib/userProfile'

const userId = JSON.parse(localStorage.getItem('user') || '{}').id

// 只更新年级
const result = await updateUserProfile(userId, { grade: '硕二' })
console.log('部分更新结果:', result)
// 预期结果: 只有 grade 字段被更新，其他字段保持不变
```

## ✅ 验证清单

完成测试后，请确认:

- [ ] 首次获取个人资料返回 `null`
- [ ] 可以成功创建个人资料
- [ ] 创建后可以成功获取个人资料
- [ ] 可以成功更新个人资料
- [ ] `upsert` 操作正常工作
- [ ] 部分更新只影响指定字段
- [ ] 所有函数都正确返回 `{ success: boolean, data?, error? }` 格式

## 🐛 可能的问题

### 问题 1: "user is not defined"
**解决**: 请确保已登录，localStorage 中有 user 数据

### 问题 2: "Cannot import from '@/lib/userProfile'"
**解决**: 在控制台中无法直接使用 import，需要在实际代码中使用这些函数

### 问题 3: RLS 权限错误
**解决**: 请确保在 Supabase 中正确设置了 RLS 策略（参考数据库文档）

## 📝 实际使用方式

这些测试主要用于理解函数的工作原理。实际使用时，这些函数会在：
- 第三步创建的 UI 组件中调用
- React 组件的事件处理函数中使用

## ⏭️ 下一步

如果所有测试通过，就可以进入第三步：创建用户个人资料编辑弹窗组件。



