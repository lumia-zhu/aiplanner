import { createClient } from './supabase-client'

// 简单的认证工具函数
export interface AuthUser {
  id: string
  username: string
}

// 用户注册
export async function registerUser(username: string, password: string): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const supabase = createClient()
    
    // 简单密码哈希（原型用，生产环境应该用bcrypt）
    const passwordHash = btoa(password) // 简单base64编码
    
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          password_hash: passwordHash
        }
      ])
      .select()
    
    if (error) {
      if (error.code === '23505') { // 唯一约束违反
        return { error: '用户名已存在' }
      }
      return { error: error.message }
    }
    
    if (data && data[0]) {
      return {
        user: {
          id: data[0].id,
          username: data[0].username
        }
      }
    }
    
    return { error: '注册失败' }
  } catch (error) {
    return { error: '注册异常' }
  }
}

// 用户登录
export async function loginUser(username: string, password: string): Promise<{ user?: AuthUser; error?: string }> {
  try {
    console.log('🔑 loginUser 开始执行...')
    const supabase = createClient()
    console.log('🔑 Supabase 客户端已创建')
    
    // 简单密码哈希
    const passwordHash = btoa(password)
    
    console.log('🔑 正在查询 users 表...')
    const { data, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()
    
    console.log('🔑 查询完成:', { error: error?.message, hasData: !!data })
    
    if (error || !data) {
      console.log('🔑 查询失败或无数据:', error)
      return { error: '用户名或密码错误' }
    }
    
    // 验证密码
    if (data.password_hash !== passwordHash) {
      console.log('🔑 密码不匹配')
      return { error: '用户名或密码错误' }
    }
    
    console.log('🔑 登录成功!')
    return {
      user: {
        id: data.id,
        username: data.username
      }
    }
  } catch (error) {
    console.error('🔑 登录异常:', error)
    return { error: '登录异常' }
  }
}

// 本地存储用户信息
export function saveUserToStorage(user: AuthUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user))
  }
}

// 从本地存储获取用户信息
export function getUserFromStorage(): AuthUser | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
  }
  return null
}

// 清除用户信息
export function clearUserFromStorage() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user')
  }
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  return getUserFromStorage() !== null
}

