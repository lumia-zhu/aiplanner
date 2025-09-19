import { createClient } from '@supabase/supabase-js'

// 简化：在使用处（server/client工厂）创建，不在模块顶层读取env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
