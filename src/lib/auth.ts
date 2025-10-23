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
        return { error: 'Username already exists' }
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
    
    return { error: 'Registration failed' }
  } catch (error) {
    return { error: 'Registration error' }
  }
}

// 用户登录
export async function loginUser(username: string, password: string): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const supabase = createClient()
    
    // 简单密码哈希
    const passwordHash = btoa(password)
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()
    
    if (error || !data) {
      return { error: 'Invalid username or password' }
    }
    
    // 验证密码
    if (data.password_hash !== passwordHash) {
      return { error: 'Invalid username or password' }
    }
    
    return {
      user: {
        id: data.id,
        username: data.username
      }
    }
  } catch (error) {
    return { error: 'Login error' }
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

