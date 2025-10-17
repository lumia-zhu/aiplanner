# 🔐 环境变量配置说明

## 📋 需要的环境变量

### Supabase 配置
在 Supabase 项目设置中可以找到这两个值：
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥（公开密钥）

**获取方式**：
1. 登录 https://supabase.com
2. 进入你的项目
3. 点击左侧 "Settings" → "API"
4. 复制 "Project URL" 和 "anon public" 密钥

---

### 豆包 AI 配置
在火山引擎控制台获取：
- `DOUBAO_APP_ID` - 豆包应用 ID
- `DOUBAO_TOKEN` - 豆包访问令牌
- `DOUBAO_CLUSTER` - 豆包集群地址

**获取方式**：
参考 `docs/AI_SETUP.md` 文档

---

## 💻 本地开发配置

创建 `task-manager/.env.local` 文件（不要提交到 Git）：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://eipmjbxhwaviitzerjkr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的实际密钥

# 豆包 AI
DOUBAO_APP_ID=你的实际APP_ID
DOUBAO_TOKEN=你的实际Token
DOUBAO_CLUSTER=你的实际Cluster
```

---

## 🚀 Vercel 部署配置

在 Vercel 项目设置中配置环境变量：

1. 进入 Vercel 项目仪表板
2. 点击 "Settings" → "Environment Variables"
3. 逐个添加上述所有变量
4. 选择环境：Production（生产）、Preview（预览）、Development（开发）
5. 点击 "Save"

**重要提示**：
- ✅ 所有变量都要添加
- ✅ 变量名必须完全一致（包括大小写）
- ✅ `NEXT_PUBLIC_` 开头的变量会暴露到浏览器端（这是正常的）
- ❌ 不要把 `.env.local` 文件提交到 GitHub

---

## 🔍 验证配置

本地验证：
```bash
npm run dev
```

访问 http://localhost:3000 测试功能是否正常。

生产环境验证（部署后）：
1. 检查浏览器控制台是否有 Supabase 连接错误
2. 测试登录功能
3. 测试 AI 对话功能
4. 检查任务保存功能

---

## ⚠️ 常见问题

**Q: 为什么有些变量以 `NEXT_PUBLIC_` 开头？**  
A: Next.js 要求暴露到浏览器端的变量必须以 `NEXT_PUBLIC_` 开头。Supabase URL 和 Key 需要在前端使用，所以要加这个前缀。

**Q: 豆包的变量为什么不加 `NEXT_PUBLIC_`？**  
A: 豆包 API 只在服务端（Next.js API 路由）调用，不需要暴露到浏览器，所以不加前缀更安全。

**Q: 部署到 Vercel 后提示环境变量未定义？**  
A: 检查变量名是否完全一致，包括大小写和下划线。部署后需要重新部署才能生效。







