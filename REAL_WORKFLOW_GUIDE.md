# 🚀 真实 AI 工作流集成指南

## ✅ **已完成的真实集成**

你现在已经完成了从 Mock 到真实 AI 工作流的集成!系统会自动检测 API 密钥并切换模式。

---

## 📋 **当前状态**

### ✅ **已集成的功能**

1. **工作流初始化系统** (`src/lib/workflow/init.ts`)
   - ✅ 自动创建 AIService
   - ✅ 注册豆包适配器
   - ✅ 初始化 5 个工具
   - ✅ 创建 WorkflowOrchestrator

2. **真实工作流 Hook** (`src/hooks/useRealWorkflow.ts`)
   - ✅ 连接到真实的 WorkflowOrchestrator
   - ✅ 监听上下文变化
   - ✅ 实时更新进度
   - ✅ 收集 AI 建议

3. **智能模式切换** (`src/app/dashboard/page.tsx`)
   - ✅ 自动检测 `NEXT_PUBLIC_DOUBAO_API_KEY`
   - ✅ 有 Key → 使用真实工作流
   - ✅ 无 Key → 使用 Mock 演示
   - ✅ 显示当前模式状态

---

## 🎯 **如何测试真实工作流**

### **步骤 1: 确认环境配置**

确保你的 `.env.local` 文件包含:

```bash
# 豆包 API 配置
NEXT_PUBLIC_DOUBAO_API_KEY=your_api_key_here
NEXT_PUBLIC_DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

### **步骤 2: 重启开发服务器**

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### **步骤 3: 测试工作流**

1. 打开浏览器访问 `http://localhost:3000/dashboard`
2. 添加一些任务
3. 点击 **"✨ 写好任务了，AI帮忙完善计划"** 按钮
4. 查看按钮下方的模式指示器:
   - 🟢 **真实 AI 模式** - 使用真实 API
   - 🟡 **Mock 演示模式** - 使用模拟数据

### **步骤 4: 观察工作流执行**

在 **ChatSidebar (AI 助手)** 中,你应该看到:

1. **工作流进度条** - 显示当前执行阶段
2. **流式消息** - 实时显示 AI 的思考过程
3. **AI 建议芯片** - 可交互的建议列表

---

## 🔍 **调试和日志**

### **浏览器控制台日志**

打开浏览器控制台 (F12),你会看到:

```
🔧 初始化 AI 工作流系统...
✅ 豆包 API 配置已加载
✅ 豆包适配器已注册
✅ 工具已注册: 任务拆解 (decompose)
✅ 工具已注册: 时间估算 (estimate)
✅ 工具已注册: 优先级排序 (prioritize)
✅ 工具已注册: 任务澄清 (clarify)
✅ 工具已注册: 检查清单 (checklist)
✅ 所有工具已初始化
🎉 工作流系统初始化完成!
🚀 开始真实 AI 工作流...
```

### **工作流执行日志**

```
📍 进度: 分析任务 (0%)
📍 进度: 澄清需求 (17%)
📍 进度: 拆解任务 (33%)
💡 新建议: 子任务: 完成需求分析
📍 进度: 估算时间 (50%)
📍 进度: 排序优先级 (67%)
📍 进度: 生成检查清单 (83%)
✅ 工作流完成
```

---

## 🛠️ **工作流执行流程**

### **真实执行步骤**

```
1. 用户点击 "AI帮忙完善计划"
   ↓
2. Dashboard 检测到 API 密钥,使用 useRealWorkflow
   ↓
3. 初始化真实的 WorkflowOrchestrator
   ↓
4. 执行 6 个工作流阶段:
   
   📊 analyzing (分析任务)
   └─ 调用 AI 分析任务复杂度
   
   ❓ clarifying (澄清需求)
   └─ 使用 ClarifyTaskTool 生成问题
   └─ 生成建议芯片: "澄清问题: XXX"
   
   🔨 decomposing (拆解任务)
   └─ 使用 DecomposeTaskTool 拆解
   └─ 生成建议芯片: "子任务: XXX"
   
   ⏱️ estimating (估算时间)
   └─ 使用 EstimateTimeTool 估算
   └─ 生成建议芯片: "预计耗时: XX 分钟"
   
   🎯 prioritizing (排序优先级)
   └─ 使用 PrioritizeTasksTool 排序
   └─ 生成建议芯片: "优先级: XXX"
   
   ✅ checking (生成检查清单)
   └─ 使用 ChecklistTool 生成
   └─ 生成建议芯片: "检查项: XXX"
   ↓
5. ChatSidebar 实时显示:
   - 工作流进度
   - AI 建议芯片
   ↓
6. 用户可以接受/拒绝建议
```

---

## ⚙️ **API 调用详情**

### **豆包 API 调用**

每个工具会调用豆包 API:

```typescript
// DecomposeTaskTool 示例
const result = await aiService.generateObject({
  model: 'primary',  // 使用豆包适配器
  messages: [{ 
    role: 'user', 
    content: '请将以下任务拆解为子任务: ...' 
  }],
  schema: DecomposeResultSchema,  // Zod schema 验证
  temperature: 0.7,
});
```

### **API 响应处理**

```typescript
if (result.success && result.data) {
  // 生成建议芯片
  const chips = result.data.subtasks.map(st => ({
    id: `chip-${Date.now()}`,
    text: `子任务: ${st.title}`,
    action: 'add_subtask',
    metadata: { subtask: st }
  }));
  
  // 添加到上下文
  context.addSuggestions(chips);
}
```

---

## 🐛 **常见问题**

### **Q1: 显示 "Mock 演示模式" 而不是 "真实 AI 模式"**

**原因**: 环境变量未加载

**解决**:
1. 检查 `.env.local` 文件是否存在
2. 确认变量名为 `NEXT_PUBLIC_DOUBAO_API_KEY`
3. 重启开发服务器 (`npm run dev`)
4. 强制刷新浏览器 (Ctrl + Shift + R)

### **Q2: 工作流执行失败,显示错误**

**原因**: API 密钥无效或网络问题

**解决**:
1. 检查控制台错误日志
2. 验证 API 密钥是否正确
3. 检查网络连接
4. 查看 BASE_URL 是否正确

### **Q3: 建议芯片不显示**

**原因**: AI 返回的数据格式不符合预期

**解决**:
1. 查看控制台日志中的 AI 返回结果
2. 检查 Zod Schema 验证是否通过
3. 调整 Prompt 模板 (`src/lib/prompts/`)

### **Q4: 工作流卡住不动**

**原因**: 某个工具执行超时

**解决**:
1. 查看控制台最后的日志
2. 检查是否是某个特定工具卡住
3. 增加 timeout 配置
4. 简化任务描述

---

## 📊 **性能监控**

### **查看工具统计**

在浏览器控制台执行:

```javascript
// 查看所有工具统计
globalToolRegistry.getRegistryStats()

// 查看特定工具统计
const tool = globalToolRegistry.getTool('decompose')
console.log(tool.statistics)
```

### **统计信息包含**

```javascript
{
  totalExecutions: 5,
  successfulExecutions: 4,
  failedExecutions: 1,
  averageExecutionTime: 2500,  // 毫秒
  lastExecutionTime: 3000,
  lastError: undefined
}
```

---

## 🔄 **下一步优化**

### **待完善功能**

1. **建议应用到任务**
   - 目前点击建议只显示 alert
   - 需要实际修改数据库中的任务

2. **流式输出优化**
   - 逐字显示 AI 响应
   - 更流畅的用户体验

3. **错误恢复**
   - 工具失败后自动重试
   - 断点续传

4. **Prompt 优化**
   - 根据实际使用调整
   - A/B 测试不同版本

5. **更多工具**
   - 日程安排工具
   - 提醒设置工具
   - 资源分配工具

---

## 📝 **文件清单**

### **新增文件 (真实集成)**

```
src/lib/workflow/init.ts      - 工作流初始化
src/hooks/useRealWorkflow.ts  - 真实工作流 Hook
```

### **修改文件**

```
src/app/dashboard/page.tsx    - 智能模式切换
```

---

## 🎉 **总结**

✅ **真实 AI 工作流已完全集成**  
✅ **自动检测 API 密钥切换模式**  
✅ **所有 5 个工具就绪**  
✅ **实时进度显示和建议收集**  
✅ **错误处理和日志记录**  

**现在可以刷新页面,点击 "AI帮忙完善计划" 按钮,体验真实的 AI 工作流了!** 🚀

---

**文档版本**: v1.0  
**更新日期**: 2024-10-14  
**作者**: AI Assistant

