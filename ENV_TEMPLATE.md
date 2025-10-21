# 📝 环境变量配置模板

## 本地开发环境

创建 `task-manager/.env.local` 文件（不会被提交到 Git）:

```env
# ===================================
# Supabase 配置（必需）
# ===================================
# 获取方式: https://supabase.com → 项目 → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ===================================
# 豆包 AI 配置（必需）
# ===================================
# 获取方式: 参考 docs/AI_SETUP.md
DOUBAO_APP_ID=your-app-id-here
DOUBAO_TOKEN=your-token-here
DOUBAO_CLUSTER=your-cluster-here

# ===================================
# Azure OAuth 配置（可选）
# ===================================
# 仅在使用 Outlook 日历导入功能时需要
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/outlook-callback
```

---

## Vercel 部署环境

在 Vercel 项目设置 → Environment Variables 中添加:

### 必需变量

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase 公开密钥 |
| `DOUBAO_APP_ID` | `123456789` | 豆包应用 ID |
| `DOUBAO_TOKEN` | `token_xxx` | 豆包访问令牌 |
| `DOUBAO_CLUSTER` | `maas-xxx` | 豆包集群地址 |

### 可选变量

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | `xxx-xxx-xxx` | Azure OAuth 客户端 ID |
| `NEXT_PUBLIC_REDIRECT_URI` | `https://your-app.vercel.app/api/outlook-callback` | OAuth 回调地址 |

---

## ⚠️ 重要提示

### 关于 NEXT_PUBLIC_ 前缀

- ✅ **带前缀** (`NEXT_PUBLIC_`): 
  - 会被打包到客户端代码
  - 任何人都可以在浏览器中看到
  - 适用于: API URL、客户端 ID 等公开信息

- 🔒 **不带前缀**: 
  - 仅在服务端可用
  - 不会暴露给客户端
  - 适用于: 密钥、Token 等敏感信息

### 安全最佳实践

1. ✅ **永远不要提交 `.env.local` 到 Git**
2. ✅ **使用不同的密钥用于开发和生产环境**
3. ✅ **定期轮换敏感密钥**
4. ✅ **在 Supabase 中启用 Row Level Security (RLS)**
5. ✅ **使用环境变量管理工具（如 1Password、Bitwarden）保存密钥**

---

## 🔍 如何检查环境变量是否生效

### 本地开发
```bash
# 在项目根目录运行
cd task-manager
npm run dev

# 检查控制台是否有环境变量相关错误
```

### Vercel 部署
1. 部署后访问网站
2. 打开浏览器开发者工具 (F12)
3. 查看 Console 标签页
4. 检查是否有连接错误或 API 调用失败

---

## 📚 相关文档

- [ENV_SETUP.md](./ENV_SETUP.md) - 详细的环境变量配置说明
- [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) - Vercel 部署完整指南
- [docs/AI_SETUP.md](./docs/AI_SETUP.md) - 豆包 AI 配置指南
- [docs/OUTLOOK_SETUP.md](./docs/OUTLOOK_SETUP.md) - Outlook 集成配置指南














