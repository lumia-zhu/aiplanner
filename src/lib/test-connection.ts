import { createClient } from './supabase-client'

// 测试数据库连接
export async function testDatabaseConnection() {
  try {
    console.log('🔍 测试 Supabase 连接...')
    const supabase = createClient()
    
    // 1. 测试 users 表
    console.log('📋 测试 users 表...')
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username, created_at')
      .limit(5)
    
    console.log('- Users 表:', usersError ? `❌ 错误: ${usersError.message}` : '✅ 可访问')
    if (usersData) {
      console.log(`- Users 记录数: ${usersData.length}`)
      if (usersData.length > 0) {
        console.log('- 示例用户:', usersData[0])
      }
    }
    
    // 2. 测试 tasks 表
    console.log('📋 测试 tasks 表...')
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, priority, completed, created_at')
      .limit(5)
    
    console.log('- Tasks 表:', tasksError ? `❌ 错误: ${tasksError.message}` : '✅ 可访问')
    if (tasksData) {
      console.log(`- Tasks 记录数: ${tasksData.length}`)
      if (tasksData.length > 0) {
        console.log('- 示例任务:', tasksData[0])
      }
    }
    
    // 3. 总结
    const success = !usersError && !tasksError
    if (success) {
      console.log('✅ 数据库连接测试成功!')
    } else {
      console.log('❌ 数据库连接测试失败')
    }
    
    return success
    
  } catch (error) {
    console.error('❌ 连接测试异常:', error)
    return false
  }
}

// 创建测试用户的函数
export async function createTestUser() {
  try {
    const supabase = createClient()
    const testUser = {
      username: 'testuser',
      password_hash: '$2b$10$example.hash.for.testuser123' // 实际使用时会用真实的哈希
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert([testUser])
      .select()
    
    if (error) {
      console.error('创建测试用户失败:', error.message)
      return null
    }
    
    console.log('✅ 测试用户创建成功:', data)
    return data[0]
  } catch (error) {
    console.error('创建测试用户异常:', error)
    return null
  }
}
