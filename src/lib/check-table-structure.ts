import { createClient } from './supabase-client'

export async function checkTableStructure() {
  try {
    const supabase = createClient()
    
    // 直接尝试创建一个测试任务来检查表结构
    console.log('🔍 通过测试任务创建来检查表结构...')
    
    // 首先尝试查询现有任务来了解表结构
    const { data: existingTasks, error: queryError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1)
    
    if (queryError) {
      console.error('❌ 查询任务表失败:', queryError.message)
      return { success: false, error: `无法访问任务表: ${queryError.message}`, details: null }
    }
    
    console.log('✅ 成功访问任务表')
    
    // 检查表结构通过分析现有数据或尝试插入测试数据
    const testUserId = '00000000-0000-0000-0000-000000000000'
    const today = new Date().toISOString().split('T')[0]
    
    const testTask = {
      user_id: testUserId,
      title: '结构测试任务',
      description: '用于测试表结构',
      deadline_datetime: `${today}T15:30:00`,
      priority: 'medium',
      completed: false
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('tasks')
      .insert([testTask])
      .select()
    
    let hasCorrectStructure = true
    let structureError = ''
    
    if (insertError) {
      console.error('❌ 测试插入失败:', insertError.message)
      
      // 分析错误信息来判断缺少什么字段
      const errorMsg = insertError.message.toLowerCase()
      
      if (errorMsg.includes('deadline_datetime')) {
        if (errorMsg.includes('does not exist') || errorMsg.includes('column') && errorMsg.includes('not found')) {
          structureError = '缺少 deadline_datetime 字段'
          hasCorrectStructure = false
        }
      }
      
      if (errorMsg.includes('user_id')) {
        structureError += (structureError ? '; ' : '') + 'user_id 字段问题'
        hasCorrectStructure = false
      }
      
      if (!structureError) {
        structureError = insertError.message
        hasCorrectStructure = false
      }
    } else {
      console.log('✅ 测试任务创建成功，表结构正确')
      
      // 清理测试数据
      if (insertData && insertData[0]) {
        await supabase
          .from('tasks')
          .delete()
          .eq('id', insertData[0].id)
        console.log('🧹 测试数据已清理')
      }
    }
    
    // 尝试用 SQL 查询来获取表结构信息（作为备用）
    let tableData = null
    const { data: sqlData, error: sqlError } = await supabase
      .rpc('exec_sql', { 
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'tasks' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })
    
    if (!sqlError && sqlData) {
      tableData = sqlData
      console.log('📋 通过 SQL 获取的表结构:')
      console.table(tableData)
    } else {
      // 如果 SQL 查询也失败，我们从错误信息推断
      console.log('⚠️ 无法通过 SQL 查询获取表结构，基于测试结果推断')
    }
    
    // 分析表结构（基于测试结果和可能的 SQL 查询结果）
    let hasDeadlineDateTime = hasCorrectStructure
    let hasDeadlineTime = false
    let hasDeadline = false
    let hasUserId = true // 基本字段，应该存在
    let hasTitle = true // 基本字段，应该存在
    
    if (tableData && Array.isArray(tableData)) {
      hasDeadlineDateTime = tableData.some(col => col.column_name === 'deadline_datetime')
      hasDeadlineTime = tableData.some(col => col.column_name === 'deadline_time')
      hasDeadline = tableData.some(col => col.column_name === 'deadline')
      hasUserId = tableData.some(col => col.column_name === 'user_id')
      hasTitle = tableData.some(col => col.column_name === 'title')
      
      console.log('📋 表结构分析:')
      console.table(tableData)
    }
    
    console.log('🔍 关键字段检查:')
    console.log('- user_id 字段:', hasUserId ? '✅ 存在' : '❌ 不存在')
    console.log('- title 字段:', hasTitle ? '✅ 存在' : '❌ 不存在')
    console.log('- deadline_datetime 字段:', hasDeadlineDateTime ? '✅ 存在' : '❌ 不存在')
    console.log('- deadline_time 字段:', hasDeadlineTime ? '⚠️ 存在（旧字段）' : '✅ 不存在')
    console.log('- deadline 字段:', hasDeadline ? '⚠️ 存在（旧字段）' : '✅ 不存在')
    
    const issues = []
    if (!hasUserId) issues.push('缺少 user_id 字段')
    if (!hasTitle) issues.push('缺少 title 字段')
    if (!hasDeadlineDateTime) issues.push('缺少 deadline_datetime 字段')
    if (hasDeadlineTime) issues.push('存在旧的 deadline_time 字段')
    if (hasDeadline) issues.push('存在旧的 deadline 字段')
    
    // 如果有结构错误，添加到问题列表
    if (structureError && !hasCorrectStructure) {
      issues.push(structureError)
    }
    
    return {
      success: issues.length === 0 && hasCorrectStructure,
      error: issues.length > 0 ? issues.join('; ') : (structureError || null),
      details: {
        hasDeadlineDateTime,
        hasDeadlineTime,
        hasDeadline,
        hasUserId,
        hasTitle,
        columns: tableData,
        testResult: hasCorrectStructure ? '测试通过' : '测试失败'
      }
    }
    
  } catch (error) {
    console.error('❌ 检查表结构异常:', error)
    return { success: false, error: `异常: ${error}`, details: null }
  }
}

export async function testTaskCreation() {
  try {
    const supabase = createClient()
    
    // 先检查是否有用户存在，如果没有就创建一个测试用户
    const { data: users, error: userQueryError } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    let testUserId = '00000000-0000-0000-0000-000000000000'
    
    if (!userQueryError && users && users.length > 0) {
      testUserId = users[0].id
      console.log('✅ 找到现有用户:', testUserId)
    } else {
      console.log('⚠️ 没有找到用户，使用临时测试ID')
    }
    
    // 尝试创建一个测试任务
    const today = new Date().toISOString().split('T')[0]
    const testTask = {
      user_id: testUserId,
      title: '功能测试任务',
      description: '用于验证任务创建功能',
      deadline_datetime: `${today}T16:30:00`,
      priority: 'high' as const,
      completed: false
    }
    
    console.log('🧪 尝试创建功能测试任务...')
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([testTask])
      .select()
    
    if (error) {
      console.error('❌ 创建任务失败:', error.message)
      
      const errorMsg = error.message.toLowerCase()
      console.log('💡 错误分析:')
      
      if (errorMsg.includes('deadline_datetime')) {
        console.log('- deadline_datetime 字段问题')
      }
      if (errorMsg.includes('foreign key') || errorMsg.includes('user_id')) {
        console.log('- 外键约束失败（用户不存在）')
      }
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        console.log('- 某个必需字段不存在')
      }
      
      return false
    }
    
    console.log('✅ 功能测试任务创建成功!')
    console.log('📋 任务详情:', {
      id: data[0]?.id,
      title: data[0]?.title,
      deadline_datetime: data[0]?.deadline_datetime
    })
    
    // 清理测试数据
    if (data && data[0]) {
      const deleteResult = await supabase
        .from('tasks')
        .delete()
        .eq('id', data[0].id)
      
      if (deleteResult.error) {
        console.log('⚠️ 清理测试数据失败:', deleteResult.error.message)
      } else {
        console.log('🧹 测试数据已清理')
      }
    }
    
    return true
    
  } catch (error) {
    console.error('❌ 测试任务创建异常:', error)
    return false
  }
}
