# 📋 Simple English Translation Plan

## 🎯 Goal
直接将所有中文文本替换为英文，不使用复杂的 i18n 框架。

## 策略
- ✅ 简单直接：直接修改源代码中的中文字符串
- ✅ 保持功能：不改变任何逻辑，只替换显示文本
- ✅ 逐个文件：一个文件一个文件地翻译和验证

---

## 📊 翻译优先级

### P0 - 核心UI（用户最常见）
1. **Dashboard 主页** (`src/app/dashboard/page.tsx`)
2. **任务表单** (`src/components/TaskForm.tsx`)
3. **任务列表** (`src/components/TaskItem.tsx`, `src/components/DraggableTaskItem.tsx`)
4. **日历** (`src/components/CalendarView.tsx`)
5. **日期选择器** (`src/components/DateScopeSelector.tsx`)

### P1 - AI功能（核心特色）
6. **AI聊天侧边栏** (`src/components/ChatSidebar.tsx`)
7. **AI工作流** (`src/hooks/useWorkflowAssistant.ts`)
8. **AI Prompts** (`src/lib/clarificationAI.ts`, `src/lib/decompositionAI.ts`, `src/lib/doubaoService.ts`)
9. **交互按钮** (`src/components/InteractiveButtons.tsx`)

### P2 - 认证和其他
10. **登录/注册** (`src/app/auth/login/page.tsx`, `src/app/auth/register/page.tsx`)
11. **用户资料** (`src/components/UserProfileModal.tsx`)
12. **导入功能** (`src/components/CanvasImport.tsx`, `src/components/OutlookImport.tsx`, 等)
13. **错误和成功消息** (各个文件中的 toast/alert)

---

## 🚀 实施步骤

### Step 1: 元数据和标题
- [ ] `src/app/layout.tsx` - 页面标题和描述
- [ ] `README.md` - 项目文档

### Step 2: Dashboard 主页
- [ ] `src/app/dashboard/page.tsx` - 所有UI文本
- [ ] 优先级标签（高/中/低）
- [ ] 按钮文本
- [ ] 提示信息

### Step 3: 任务管理组件
- [ ] `src/components/TaskForm.tsx` - 表单标签和占位符
- [ ] `src/components/TaskItem.tsx` - 任务操作按钮
- [ ] `src/components/DraggableTaskItem.tsx` - 拖拽提示
- [ ] `src/components/SubtaskList.tsx` - 子任务相关

### Step 4: 日历组件
- [ ] `src/components/CalendarView.tsx` - 周/月视图，今天按钮等
- [ ] `src/components/DateScopeSelector.tsx` - 日期范围选项
- [ ] `src/utils/dateUtils.ts` - 日期格式化函数

### Step 5: AI 聊天功能
- [ ] `src/components/ChatSidebar.tsx` - 侧边栏UI
- [ ] `src/hooks/useWorkflowAssistant.ts` - 工作流消息
- [ ] `src/components/InteractiveButtons.tsx` - 按钮文本

### Step 6: AI Prompts（最关键）
- [ ] `src/lib/clarificationAI.ts` - 任务澄清提示词
- [ ] `src/lib/decompositionAI.ts` - 任务拆解提示词
- [ ] `src/lib/doubaoService.ts` - AI服务消息
- [ ] `src/lib/guidanceService.ts` - 引导消息
- [ ] `src/lib/timeEstimationAI.ts` - 时间估算

### Step 7: 认证页面
- [ ] `src/app/auth/login/page.tsx`
- [ ] `src/app/auth/register/page.tsx`

### Step 8: 其他组件
- [ ] 导入组件
- [ ] 用户资料模态框
- [ ] 各种提示和错误消息

---

## 📝 翻译对照表（常用术语）

| 中文 | English |
|------|---------|
| 任务管理器 | Task Manager |
| 待办事项 | To-Do / Tasks |
| 优先级 | Priority |
| 高 | High |
| 中 | Medium |
| 低 | Low |
| 截止时间 | Deadline |
| 标题 | Title |
| 描述 | Description |
| 标签 | Tags |
| 完成 | Complete |
| 未完成 | Incomplete |
| 今天 | Today |
| 本周 | This Week |
| 下周 | Next Week |
| 自定义范围 | Custom Range |
| 回到今天 | Back to Today |
| 周视图 | Week View |
| 月视图 | Month View |
| AI辅助完善计划 | AI-Assisted Planning |
| 开始AI辅助 | Start AI Assistance |
| 结束AI辅助 | End AI Assistance |
| 完善单个任务 | Refine Single Task |
| 对所有任务排序 | Sort All Tasks |
| 澄清 | Clarify |
| 拆解 | Decompose |
| 估时 | Estimate Time |
| 返回上一级 | Go Back |
| 确认 | Confirm |
| 取消 | Cancel |
| 保存 | Save |
| 删除 | Delete |
| 编辑 | Edit |
| 添加任务 | Add Task |
| 快速添加 | Quick Add |
| 预估时长 | Estimated Duration |
| 分钟 | minutes |
| 子任务 | Subtasks |
| 登录 | Login |
| 注册 | Register |
| 用户名 | Username |
| 密码 | Password |
| 专业 | Major |
| 年级 | Grade |
| 挑战 | Challenges |
| 工作场所 | Workplaces |

---

## ⚠️ 注意事项

1. **AI Prompt 翻译**：
   - 保持 Socratic 提问风格
   - 保持 ADHD 友好原则
   - 确保示例和反例的清晰度

2. **日期格式**：
   - 保持 ISO 格式不变
   - 显示格式改为英文习惯

3. **错误消息**：
   - 清晰、可操作
   - 提供下一步建议

4. **代码注释**：
   - 保留中文注释或翻译为英文（可选）
   - 优先翻译用户可见的文本

---

## 🧪 验证方法

每完成一个文件后：
1. 启动开发服务器
2. 手动测试该功能
3. 确认文本显示正确
4. 确认功能正常工作

---

**预计时间**: 2-3天（比复杂的 i18n 框架快得多）

**优势**:
- ✅ 简单直接，不易出错
- ✅ 不需要学习新框架
- ✅ 易于维护
- ✅ 性能更好（无运行时翻译）

**劣势**:
- ❌ 无法动态切换语言
- ❌ 如果以后需要多语言支持，需要重构

但对于当前需求（只要英文版本），这是最快最稳的方案！
