# Outlook 任务导入设置指南

## 概述
本功能允许用户从 Microsoft Outlook 导入任务到我们的任务管理器中。

## 前置要求
- Microsoft 账户（个人或企业账户）
- Azure AD 应用注册权限

## 设置步骤

### 1. 注册 Azure AD 应用程序

1. **访问 Azure Portal**
   - 前往 [Azure Portal](https://portal.azure.com/)
   - 使用你的 Microsoft 账户登录

2. **创建应用注册**
   - 在搜索栏中输入 "App registrations"
   - 点击 "New registration"
   - 填写应用信息：
     - **Name**: `Task Manager - Outlook Import`
     - **Supported account types**: 选择 "Accounts in any organizational directory and personal Microsoft accounts"
     - **Redirect URI**: 选择 "Single-page application (SPA)" 并输入 `http://localhost:3000`

3. **配置权限**
   - 在应用页面，点击 "API permissions"
   - 点击 "Add a permission"
   - 选择 "Microsoft Graph"
   - 选择 "Delegated permissions"
   - 添加以下权限：
     - `User.Read` - 读取用户基本信息
     - `Tasks.Read` - 读取用户的任务

4. **获取客户端 ID**
   - 在 "Overview" 页面复制 "Application (client) ID"

### 2. 配置环境变量

将获取到的客户端 ID 添加到 `.env.local` 文件中：

```env
# Microsoft Graph API 配置
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your_client_id_here
```

### 3. 生产环境配置

对于生产环境部署，需要：

1. **更新重定向 URI**
   - 在 Azure AD 应用注册中添加生产环境的 URL
   - 例如：`https://yourdomain.com`

2. **配置环境变量**
   - 在 Vercel 或其他部署平台中设置环境变量

## 功能特性

### 支持的数据映射
- **任务标题** → 直接映射
- **任务描述** → 从 Outlook 任务的 body 内容
- **优先级** → 映射关系：
  - Outlook `low` → 本地 `low`
  - Outlook `normal` → 本地 `medium`  
  - Outlook `high` → 本地 `high`
- **截止时间** → 提取日期时间的时间部分（当天任务）
- **完成状态** → 映射 Outlook 的完成状态

### 重复任务检测
- 基于任务标题的完全匹配
- 基于描述内容的相似性检测
- 重复任务会被自动跳过

### 导入流程
1. **连接账户** - 用户授权访问 Outlook 任务
2. **预览任务** - 显示将要导入的任务列表
3. **批量导入** - 带进度显示的批量创建
4. **结果统计** - 显示导入成功、跳过和失败的统计

## 使用说明

1. **点击"导入任务"按钮**
2. **连接 Microsoft 账户** - 首次使用需要授权
3. **预览任务** - 查看将要导入的任务
4. **开始导入** - 批量导入任务到本地
5. **查看结果** - 确认导入统计信息

## 故障排除

### 常见问题

**Q: 连接失败，提示权限错误**
A: 确保在 Azure AD 中正确配置了权限，并且客户端 ID 正确

**Q: 找不到任务**
A: 检查 Outlook 中是否有任务，功能读取的是默认任务列表

**Q: 导入的时间不正确**
A: 系统会将 Outlook 任务的截止日期转换为当天的时间，只保留时间部分

**Q: 重复任务被跳过**
A: 这是正常行为，系统会自动检测并跳过相同标题的任务

### 调试信息
- 打开浏览器开发者工具查看控制台日志
- 所有操作都会有详细的日志输出
- 错误信息会显示在导入结果中

## 安全考虑

- 使用 Microsoft 官方的 MSAL 库进行认证
- 权限范围最小化（只读取必要的任务信息）
- 访问令牌存储在浏览器会话中
- 支持安全的登出流程

## API 限制

- Microsoft Graph API 有速率限制
- 导入过程中添加了适当的延迟
- 大量任务导入可能需要较长时间

## 未来扩展

- 支持选择特定的任务列表
- 支持双向同步
- 支持更多的数据字段映射
- 支持 Google Calendar 集成

