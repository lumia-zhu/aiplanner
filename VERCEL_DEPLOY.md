# 🚀 Vercel 部署指南

## 📋 部署前准备

### 1. 确保代码已推送到 GitHub
```bash
cd task-manager
git add -A
git commit -m "prepare for vercel deployment"
git push
```

### 2. 准备环境变量
你需要准备以下环境变量（从 `.env.local` 获取）:

#### ✅ Supabase 配置（必需）
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 公开密钥

#### ✅ 豆包 AI 配置（必需）
- `DOUBAO_APP_ID` - 豆包应用 ID
- `DOUBAO_TOKEN` - 豆包访问令牌
- `DOUBAO_CLUSTER` - 豆包集群地址

#### 🔧 可选配置
- `NEXT_PUBLIC_AZURE_CLIENT_ID` - Azure OAuth 客户端 ID（如果使用 Outlook 导入）
- `NEXT_PUBLIC_REDIRECT_URI` - OAuth 重定向 URI

---

## 🌐 方法一：通过 Vercel 网站部署（推荐）

### Step 1: 登录 Vercel
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录

### Step 2: 导入项目
1. 点击 "Add New..." → "Project"
2. 选择你的 GitHub 仓库（`aiplanner`）
3. 点击 "Import"

### Step 3: 配置项目
在项目配置页面:

#### 📁 Root Directory
- 设置为 `task-manager`
- ✅ 勾选 "Include source files outside of the Root Directory in the Build Step"

#### ⚙️ Build & Output Settings
- Framework Preset: `Next.js` (自动检测)
- Build Command: `npm run build` (默认)
- Output Directory: `.next` (默认)
- Install Command: `npm install` (默认)

### Step 4: 添加环境变量
在 "Environment Variables" 部分，逐个添加:

```
NEXT_PUBLIC_SUPABASE_URL = https://eipmjbxhwaviitzerjkr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = 你的实际密钥
DOUBAO_APP_ID = 你的实际APP_ID
DOUBAO_TOKEN = 你的实际Token
DOUBAO_CLUSTER = 你的实际Cluster
```

**重要提示**:
- ⚠️ 不要添加引号
- ⚠️ 确保 `NEXT_PUBLIC_` 开头的变量拼写正确（客户端可见）
- ⚠️ 敏感信息（如 `DOUBAO_TOKEN`）不要以 `NEXT_PUBLIC_` 开头（仅服务端使用）

### Step 5: 部署
1. 点击 "Deploy" 按钮
2. 等待构建完成（约 2-5 分钟）
3. 部署成功后会显示项目 URL

---

## 💻 方法二：通过 Vercel CLI 部署

### Step 1: 安装 Vercel CLI
```bash
npm install -g vercel
```

### Step 2: 登录
```bash
vercel login
```

### Step 3: 初始化项目
在 `task-manager` 目录下运行:
```bash
cd task-manager
vercel
```

### Step 4: 回答配置问题
```
? Set up and deploy "task-manager"? [Y/n] y
? Which scope do you want to deploy to? 选择你的账号
? Link to existing project? [y/N] n
? What's your project's name? task-manager
? In which directory is your code located? ./
? Want to override the settings? [y/N] n
```

### Step 5: 添加环境变量
```bash
# Supabase 配置
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# 豆包 AI 配置
vercel env add DOUBAO_APP_ID production
vercel env add DOUBAO_TOKEN production
vercel env add DOUBAO_CLUSTER production
```

输入每个变量的值后，会自动保存到 Vercel 项目。

### Step 6: 部署到生产环境
```bash
vercel --prod
```

---

## 🔧 部署后配置

### 1. 配置自定义域名（可选）
1. 在 Vercel 项目设置中，点击 "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

### 2. 更新 OAuth 回调地址
如果使用了 Outlook 导入功能，需要更新 Azure 应用的回调 URL:
- 旧地址: `http://localhost:3000/api/outlook-callback`
- 新地址: `https://你的域名.vercel.app/api/outlook-callback`

### 3. 更新 Supabase 允许的 URL
在 Supabase 项目设置中:
1. 进入 "Authentication" → "URL Configuration"
2. 在 "Site URL" 中添加你的 Vercel 域名
3. 在 "Redirect URLs" 中添加:
   ```
   https://你的域名.vercel.app/*
   https://你的域名.vercel.app/auth/callback
   ```

---

## 🐛 常见问题排查

### ❌ 问题 1: 构建失败 - "Module not found"
**原因**: 依赖安装失败或 Node 版本不兼容

**解决**:
1. 在 Vercel 项目设置 → "General" → "Node.js Version" 
2. 设置为 `20.x` 或 `18.x`
3. 重新部署

### ❌ 问题 2: 环境变量不生效
**原因**: 环境变量配置错误或未重新部署

**解决**:
1. 检查变量名拼写（大小写敏感）
2. 确保客户端变量以 `NEXT_PUBLIC_` 开头
3. 修改环境变量后，点击 "Redeploy"

### ❌ 问题 3: API 路由 404
**原因**: Root Directory 配置错误

**解决**:
1. 确保 Root Directory 设置为 `task-manager`
2. 确保勾选了 "Include source files outside..."

### ❌ 问题 4: Supabase 连接失败
**原因**: Supabase URL 或密钥错误

**解决**:
1. 检查环境变量中的 URL 是否正确
2. 确保使用的是 `anon public` 密钥，不是 `service_role` 密钥
3. 检查 Supabase 项目的网络限制设置

### ❌ 问题 5: 豆包 AI 调用失败
**原因**: 豆包配置错误或超出配额

**解决**:
1. 检查 `DOUBAO_APP_ID`、`DOUBAO_TOKEN`、`DOUBAO_CLUSTER` 是否正确
2. 登录火山引擎控制台检查配额使用情况
3. 查看 Vercel 函数日志获取详细错误信息

---

## 📊 查看部署日志

### 方法 1: Vercel 网站
1. 进入项目页面
2. 点击 "Deployments"
3. 选择具体的部署记录
4. 查看 "Build Logs" 或 "Function Logs"

### 方法 2: Vercel CLI
```bash
# 查看最新部署
vercel inspect

# 查看函数日志
vercel logs
```

---

## 🔄 持续部署

Vercel 会自动监听你的 GitHub 仓库:
- ✅ 推送到主分支 → 自动部署到生产环境
- ✅ 推送到其他分支 → 自动部署预览版本
- ✅ 每个 Pull Request 都会有独立的预览 URL

**建议工作流**:
1. 在 `feature/*` 分支开发新功能
2. 推送后在 PR 的预览 URL 测试
3. 测试通过后合并到 `main` 分支
4. 自动部署到生产环境

---

## 🎯 性能优化建议

### 1. 启用 Edge Runtime（可选）
在需要快速响应的 API 路由中添加:
```typescript
export const runtime = 'edge'
```

### 2. 配置缓存策略
在 `next.config.ts` 中优化:
```typescript
export default {
  // ... 其他配置
  compress: true, // 启用 gzip 压缩
  poweredByHeader: false, // 隐藏 X-Powered-By 头
}
```

### 3. 图片优化
使用 Next.js Image 组件:
```typescript
import Image from 'next/image'
```

---

## 📞 获取帮助

- **Vercel 文档**: https://vercel.com/docs
- **Next.js 部署文档**: https://nextjs.org/docs/deployment
- **Vercel 社区**: https://github.com/vercel/vercel/discussions

---

## ✅ 部署检查清单

部署前确认:
- [ ] 代码已推送到 GitHub
- [ ] 所有环境变量已准备好
- [ ] 本地 `npm run build` 测试通过
- [ ] Supabase 数据库已设置好

部署后确认:
- [ ] 网站可以正常访问
- [ ] 用户登录/注册功能正常
- [ ] 任务创建/编辑功能正常
- [ ] AI 聊天功能正常
- [ ] 数据库读写正常

---

**祝你部署顺利! 🎉**

如果遇到问题，可以查看:
1. Vercel 部署日志
2. 浏览器开发者工具控制台
3. Vercel 函数日志（Monitoring → Logs）






