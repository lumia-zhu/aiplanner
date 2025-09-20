# 豆包 AI 助手配置指南

本项目已集成火山引擎豆包大模型，支持文本对话和图片理解功能。

## 🔑 配置步骤

### 1. 获取 API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey)
2. 登录您的火山引擎账户
3. 创建或获取 API Key

### 2. 配置环境变量

在项目根目录创建或编辑 `.env.local` 文件，添加：

```env
NEXT_PUBLIC_DOUBAO_API_KEY=your_api_key_here
```

**注意**: 请将 `your_api_key_here` 替换为您从火山引擎获取的实际 API Key。

### 3. 重启开发服务器

配置完成后，重启开发服务器：

```bash
npm run dev
```

## ✨ 功能特性

- **文本对话**: 任务管理咨询、工作计划建议
- **图片理解**: 上传图片进行分析，获得基于图片的任务建议
- **流式输出**: 实时显示AI回复内容，类似打字效果
- **对话历史**: 保持上下文，支持连续对话
- **实时状态**: 显示发送状态和AI思考过程
- **自动滚动**: 消息自动滚动到最新内容

## 🎯 使用模型

- **模型ID**: `doubao-seed-1-6-vision-250815`
- **支持功能**: 文本生成 + 图片理解
- **API端点**: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`

## 🔒 安全说明

- API Key 通过环境变量管理
- 仅在客户端使用，不会发送到第三方服务器
- 建议定期更换 API Key

## 🛠️ 故障排除

### 常见问题

1. **API Key 无效**: 检查环境变量配置是否正确
2. **网络错误**: 确保网络可以访问火山引擎 API
3. **权限不足**: 确保 API Key 有调用豆包模型的权限

### 支持的图片格式

- JPG/JPEG、PNG、GIF、WebP
- 建议文件大小小于 10MB

## 📚 参考文档

- [火山引擎豆包大模型文档](https://www.volcengine.com/docs/82379/1399008)
- [API 接口说明](https://www.volcengine.com/docs/82379/1399008#1008bfdb)
