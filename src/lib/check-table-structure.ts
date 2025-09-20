import { createClient } from './supabase-client'

export async function checkTableStructure() {
  try {
    const supabase = createClient()
    
    // 检查 tasks 表的结构
    const { data, error } = await supabase
      .rpc('get_table_structure', { table_name: 'tasks' })
    
    if (error) {
      // 如果 RPC 失败，尝试直接查询
      console.log('尝试直接查询表结构...')
      const { data: directData, error: directError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'tasks')
        .order('ordinal_position')
      
      if (directError) {
        console.error('❌ 查询表结构失败:', directError.message)
        return { success: false, error: directError.message, details: null }
      }
      
      const tableData = directData
      console.log('📋 tasks 表结构:')
      console.table(tableData)
      
      // 检查关键字段
      const hasDeadlineTime = tableData?.some(col => col.column_name === 'deadline_time')
      const hasDeadline = tableData?.some(col => col.column_name === 'deadline')
      const hasUserId = tableData?.some(col => col.column_name === 'user_id')
      const hasTitle = tableData?.some(col => col.column_name === 'title')
      
      console.log('🔍 关键字段检查:')
      console.log('- user_id 字段:', hasUserId ? '✅ 存在' : '❌ 不存在')
      console.log('- title 字段:', hasTitle ? '✅ 存在' : '❌ 不存在')
      console.log('- deadline_time 字段:', hasDeadlineTime ? '✅ 存在' : '❌ 不存在')
      console.log('- deadline 字段:', hasDeadline ? '⚠️ 存在（旧字段）' : '✅ 不存在')
      
      const issues = []
      if (!hasUserId) issues.push('缺少 user_id 字段')
      if (!hasTitle) issues.push('缺少 title 字段')
      if (!hasDeadlineTime) issues.push('缺少 deadline_time 字段')
      if (hasDeadline) issues.push('存在旧的 deadline 字段')
      
      return {
        success: issues.length === 0,
        error: issues.length > 0 ? issues.join('; ') : null,
        details: {
          hasDeadlineTime,
          hasDeadline,
          hasUserId,
          hasTitle,
          columns: tableData
        }
      }
    }
    
    console.log('✅ 表结构检查完成')
    return { success: true, error: null, details: data }
    
  } catch (error) {
    console.error('❌ 检查表结构异常:', error)
    return { success: false, error: `异常: ${error}`, details: null }
  }
}

export async function testTaskCreation() {
  try {
    const supabase = createClient()
    
    // 尝试创建一个测试任务
    const testTask = {
      user_id: '00000000-0000-0000-0000-000000000000', // 临时测试ID
      title: '测试任务',
      description: '这是一个测试任务',
      deadline_time: '14:00',
      priority: 'medium' as const,
      completed: false
    }
    
    console.log('🧪 尝试创建测试任务...')
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([testTask])
      .select()
    
    if (error) {
      console.error('❌ 创建任务失败:', error.message)
      console.log('💡 可能的原因:')
      console.log('1. deadline_time 字段不存在')
      console.log('2. 外键约束失败（user_id 不存在）')
      console.log('3. 其他数据库约束问题')
      return false
    }
    
    console.log('✅ 测试任务创建成功:', data)
    
    // 清理测试数据
    if (data && data[0]) {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', data[0].id)
      console.log('🧹 测试数据已清理')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ 测试任务创建异常:', error)
    return false
  }
}
