import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // 调试信息
  console.log('🔍 客户端环境变量检查:')
  console.log('- URL:', supabaseUrl ? '✅ 已设置' : '❌ 未设置')
  console.log('- Key:', supabaseKey ? '✅ 已设置' : '❌ 未设置')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`
❌ 环境变量未正确配置:
- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || '未设置'}
- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseKey ? '已设置' : '未设置'}

请确保 .env.local 文件存在并重启开发服务器。
    `)
  }
  
  return createBrowserClient(supabaseUrl, supabaseKey)
}
