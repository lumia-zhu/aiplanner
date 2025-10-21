# 输入框禁用功能说明

## 功能概述

在 AI 工作流的特定阶段，输入框会被禁用，引导用户通过点击按钮进行操作，而不是自由输入文字。

## 当前行为

### 禁用输入框的场景

以下工作流模式会禁用输入框（显示灰色背景，提示"💡 请点击上方按钮选择操作"）：

1. **`initial`** - 初始选项（完善单个任务/排序/结束）
2. **`single-task-action`** - 单任务操作选项（澄清/拆解/估时）
3. **`task-selection`** - 任务选择（选择要操作的任务）
4. **`priority-feeling`** - 优先级排序：询问感觉（截止日期临近/任务太多太乱/大脑一片空白）
5. **`clarification-confirm`** - 澄清确认
6. **`estimation-confirm`** - 估时确认

### 允许输入的场景

以下模式**不禁用**输入框：

1. **`task-context-input`** - 任务拆解上下文输入（显示蓝色高亮）
2. **`task-clarification-input`** - 任务澄清回答输入（显示紫色高亮）
3. **其他自由对话模式** - 工作流结束后的自由对话

## 视觉效果

### 禁用状态
```
┌─────────────────────────────────────────────────────┐
│  📷  💡 请点击上方按钮选择操作  🎤  发送            │
│  ↑                              ↑    ↑              │
│  灰色  灰色背景，置灰            灰色  灰色          │
└─────────────────────────────────────────────────────┘
```

### 启用状态
```
┌─────────────────────────────────────────────────────┐
│  📷  输入消息或粘贴图片 (Ctrl+V)...  🎤  发送       │
│  ↑                                   ↑   ↑          │
│  蓝色  白色背景，正常输入               蓝色 蓝色    │
└─────────────────────────────────────────────────────┘
```

## 如何禁用这个功能

如果你想完全禁用输入框的自动禁用功能，让用户在任何时候都可以输入，请按以下步骤操作：

### 方法 1：完全禁用（最简单）

编辑 `task-manager/src/components/ChatSidebar.tsx`，找到第 158 行附近的 `shouldDisableInput` 计算逻辑：

```tsx
// ⭐ 判断是否应该禁用输入框（引导用户使用按钮）
const shouldDisableInput = (() => {
  // 特殊输入模式不禁用
  if (workflowMode === 'task-context-input' || workflowMode === 'task-clarification-input') {
    return false
  }
  
  // 以下模式需要禁用输入框，引导用户点击按钮
  const buttonGuidedModes: WorkflowMode[] = [
    'initial',
    'single-task-action',
    'task-selection',
    'priority-feeling',
    'clarification-confirm',
    'estimation-confirm',
  ]
  
  return workflowMode ? buttonGuidedModes.includes(workflowMode) : false
})()
```

**修改为：**

```tsx
// ⭐ 禁用输入框引导功能（始终返回 false，允许用户自由输入）
const shouldDisableInput = false
```

### 方法 2：添加开关（推荐）

如果你想保留这个功能，但希望通过配置开关控制，可以：

1. 在 `ChatSidebarProps` 中添加一个可选属性：

```tsx
interface ChatSidebarProps {
  // ... 其他属性
  
  // ⭐ 新增：是否启用输入框引导模式（默认 true）
  enableInputGuidance?: boolean
}
```

2. 修改 `shouldDisableInput` 逻辑：

```tsx
const shouldDisableInput = (() => {
  // 如果禁用了引导模式，始终返回 false
  if (enableInputGuidance === false) {
    return false
  }
  
  // 特殊输入模式不禁用
  if (workflowMode === 'task-context-input' || workflowMode === 'task-clarification-input') {
    return false
  }
  
  // 以下模式需要禁用输入框，引导用户点击按钮
  const buttonGuidedModes: WorkflowMode[] = [
    'initial',
    'single-task-action',
    'task-selection',
    'priority-feeling',
    'clarification-confirm',
    'estimation-confirm',
  ]
  
  return workflowMode ? buttonGuidedModes.includes(workflowMode) : false
})()
```

3. 在 `dashboard/page.tsx` 中传递开关：

```tsx
<ChatSidebar
  {/* ... 其他 props */}
  enableInputGuidance={true}  // 设置为 false 即可禁用
/>
```

### 方法 3：调整禁用的场景

如果你只想在某些场景禁用，可以编辑 `buttonGuidedModes` 数组，移除不需要禁用的模式：

```tsx
const buttonGuidedModes: WorkflowMode[] = [
  'initial',                    // 保留：初始选项
  // 'single-task-action',      // 移除：允许在选择操作时输入
  'task-selection',             // 保留：任务选择时禁用
  // 'matrix-feeling-selection', // 移除：允许在选择感受时输入
  'clarification-confirm',      // 保留：确认时禁用
  'estimation-confirm',         // 保留：确认时禁用
]
```

## 代码位置

- **主要逻辑**：`task-manager/src/components/ChatSidebar.tsx` (第 158-175 行)
- **输入框禁用**：第 674 行
- **图片按钮禁用**：第 598 行
- **语音按钮禁用**：第 683 行
- **发送按钮禁用**：第 695, 718 行

## 相关文件

- `task-manager/src/components/ChatSidebar.tsx` - 主要组件
- `task-manager/src/types/index.ts` - `WorkflowMode` 类型定义
- `task-manager/src/hooks/useWorkflowAssistant.ts` - 工作流状态管理

## 版本历史

- **2025-10-24**: 初始实现（方案 A：简单禁用 + 提示文字）

