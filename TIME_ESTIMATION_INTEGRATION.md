# 🎯 时间估算功能集成指南

## ✅ 已完成的工作

### 1. 数据库迁移
- ✅ `estimated_duration` 从 `TEXT` 迁移到 `INTEGER`
- ✅ 编码scheme: `10000+` 表示含buffer

### 2. 工具函数库
- ✅ `src/utils/timeEstimation.ts` - 完整的时间解析/格式化/编码/解码工具

### 3. UI组件
- ✅ `TimeEstimationInput` - 滑动条+快选+自定义输入
- ✅ `EstimationConfirmOptions` - Buffer确认UI
- ✅ `TaskItem` - 显示预估时长
- ✅ `TaskForm` - 编辑预估时长

### 4. AI服务
- ✅ `timeEstimationAI.ts` - 个性化反思问题生成

### 5. 对话流程
- ✅ `useWorkflowAssistant` 扩展
  - 新增状态: `estimationTask`, `estimationInitial`, `estimationReflection`
  - 新增方法: `selectTaskForEstimation`, `submitInitialEstimation`, `confirmEstimation`, `cancelEstimation`

### 6. ChatSidebar集成
- ✅ 添加了时间估算UI渲染
- ✅ Props扩展完成

## 📋 Dashboard集成步骤

### Step 1: 解构useWorkflowAssistant返回值

在 `src/app/dashboard/page.tsx` 中，找到 `useWorkflowAssistant` 的调用，添加新的解构：

```typescript
const {
  // ... 现有的解构
  
  // ⭐ 新增：时间估算相关
  estimationTask,
  estimationInitial,
  estimationReflection,
  selectTaskForEstimation,
  submitInitialEstimation,
  confirmEstimation,
  cancelEstimation,
} = useWorkflowAssistant({
  tasks,
  userProfile,
  setChatMessages,
  setStreamingMessage,
  setIsSending
})
```

### Step 2: 添加时间估算确认处理函数

在Dashboard组件中添加：

```typescript
/**
 * 处理时间估算确认
 */
const handleEstimationConfirm = useCallback(async (withBuffer: boolean) => {
  if (!estimationTask || !estimationInitial) return
  
  const finalMinutes = encodeEstimatedDuration(estimationInitial, withBuffer)
  
  // 更新任务
  const result = await updateTask(estimationTask.id, {
    estimated_duration: finalMinutes
  })
  
  if (result.task) {
    // 更新本地状态
    setTasks(prevTasks => taskOperations.updateTask(prevTasks, result.task!))
  }
  
  // 调用hook的确认方法（显示确认消息并清理状态）
  confirmEstimation(withBuffer)
}, [estimationTask, estimationInitial, confirmEstimation])
```

### Step 3: 传递Props给ChatSidebar

在ChatSidebar组件调用处，添加新的props：

```typescript
<ChatSidebar
  {/* ... 现有的props */}
  
  {/* ⭐ 新增：时间估算相关props */}
  onEstimationSubmit={submitInitialEstimation}
  onEstimationConfirm={handleEstimationConfirm}
  onEstimationCancel={cancelEstimation}
  estimationInitial={estimationInitial}
  
  {/* ... 其他props */}
/>
```

### Step 4: 导入必要的工具函数

在Dashboard文件顶部添加：

```typescript
import { encodeEstimatedDuration } from '@/utils/timeEstimation'
```

## 🧪 测试清单

### 基础功能测试
- [ ] 数据库迁移成功
- [ ] 工具函数解析各种时间格式
- [ ] 时间估算输入组件正常工作
- [ ] Buffer确认UI显示正确

### 集成测试
- [ ] 在聊天中选择"任务时间估计"
- [ ] 选择一个任务进行估算
- [ ] 使用滑动条输入时间
- [ ] 使用快速选择输入时间
- [ ] 使用自定义输入各种格式
- [ ] AI反思问题正确显示
- [ ] 确认with/without buffer都能正确保存
- [ ] TaskItem正确显示估算时间
- [ ] TaskForm能编辑并保存新的估算时间

### 边缘情况测试
- [ ] 输入无效格式的时间
- [ ] 取消估算流程
- [ ] 重新估算已有估算的任务
- [ ] 编辑任务时清空估算时间

## 📊 数据格式说明

### 数据库存储
```sql
estimated_duration INTEGER
-- 例子：
-- 120          = 120分钟（无buffer）
-- 10144        = 10000 + 144 = 120分钟 + 20% buffer
```

### 前端显示
```typescript
formatEncodedDuration(120)    // "2小时"
formatEncodedDuration(10144)  // "2小时 + buffer"
```

### 用户输入解析
```typescript
parseTimeEstimate("2小时")      // 120
parseTimeEstimate("2.5h")      // 150
parseTimeEstimate("90分钟")    // 90
parseTimeEstimate("2小时30分") // 150
```

## 🚀 下一步工作（可选扩展）

1. **历史数据分析**
   - 收集实际完成时间vs估算时间
   - 计算用户的估算准确度
   - 优化AI反思问题

2. **智能推荐**
   - 基于相似任务推荐时间
   - 自动检测需要估算的任务

3. **统计面板**
   - 显示今日/本周总预估时长
   - 任务完成率vs时间分布

## 💡 提示

- 所有时间都以**分钟**为单位存储在数据库
- Buffer使用**编码scheme**(`10000+`)来节省字段
- AI反思有降级机制，API失败时使用规则反思
- 组件设计遵循ADHD友好原则（简洁、视觉反馈强）







