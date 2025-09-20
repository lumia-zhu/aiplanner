'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function QuickTestPage() {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const quickTest = async () => {
    setIsLoading(true)
    setResult('开始快速测试...\n')
    
    try {
      const supabase = createClient()
      
      // 1. 测试基本连接
      setResult(prev => prev + '1️⃣ 测试数据库连接...\n')
      const { data: testConnection, error: connectionError } = await supabase
        .from('tasks')
        .select('count', { count: 'exact', head: true })
      
      if (connectionError) {
        setResult(prev => prev + `❌ 连接失败: ${connectionError.message}\n`)
        return
      }
      
      setResult(prev => prev + '✅ 数据库连接成功\n\n')
      
      // 2. 检查用户表
      setResult(prev => prev + '2️⃣ 检查用户表...\n')
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, username')
        .limit(5)
      
      if (userError) {
        setResult(prev => prev + `❌ 用户表查询失败: ${userError.message}\n`)
      } else {
        setResult(prev => prev + `✅ 找到 ${users?.length || 0} 个用户\n`)
        if (users && users.length > 0) {
          users.forEach(user => {
            setResult(prev => prev + `  - ${user.username} (${user.id})\n`)
          })
        }
      }
      
      // 3. 尝试创建任务
      setResult(prev => prev + '\n3️⃣ 测试任务创建...\n')
      
      let testUserId = '00000000-0000-0000-0000-000000000000'
      if (users && users.length > 0) {
        testUserId = users[0].id
        setResult(prev => prev + `使用真实用户ID: ${testUserId}\n`)
      } else {
        setResult(prev => prev + `使用测试用户ID: ${testUserId}\n`)
      }
      
      // 使用本地时区创建测试时间
      const now = new Date()
      const year = now.getFullYear()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const day = now.getDate().toString().padStart(2, '0')
      const localDateTime = new Date(`${year}-${month}-${day}T17:00:00`)
      
      const testTask = {
        user_id: testUserId,
        title: '快速测试任务',
        description: '验证数据库表结构',
        deadline_datetime: localDateTime.toISOString(),
        priority: 'medium',
        completed: false
      }
      
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([testTask])
        .select()
      
      if (taskError) {
        setResult(prev => prev + `❌ 任务创建失败: ${taskError.message}\n`)
        
        // 分析具体错误
        const errorMsg = taskError.message.toLowerCase()
        if (errorMsg.includes('deadline_datetime')) {
          setResult(prev => prev + '💡 问题：deadline_datetime 字段不存在\n')
          setResult(prev => prev + '🔧 解决方案：需要运行数据库更新脚本\n')
        }
        if (errorMsg.includes('foreign key') || errorMsg.includes('user_id')) {
          setResult(prev => prev + '💡 问题：用户ID不存在或外键约束失败\n')
        }
      } else {
        setResult(prev => prev + '✅ 任务创建成功！\n')
        setResult(prev => prev + `📋 任务ID: ${taskData[0]?.id}\n`)
        setResult(prev => prev + `📅 截止时间: ${taskData[0]?.deadline_datetime}\n`)
        
        // 清理测试数据
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskData[0].id)
        
        if (deleteError) {
          setResult(prev => prev + `⚠️ 清理失败: ${deleteError.message}\n`)
        } else {
          setResult(prev => prev + '🧹 测试数据已清理\n')
        }
      }
      
      setResult(prev => prev + '\n🎉 快速测试完成！\n')
      
    } catch (error) {
      setResult(prev => prev + `\n💥 测试异常: ${error}\n`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            快速测试
          </h1>
          <p className="text-gray-600">
            一键测试数据库连接和任务创建功能
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <button
            onClick={quickTest}
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isLoading ? '测试中...' : '🚀 开始快速测试'}
          </button>
          
          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {result}
              </pre>
            </div>
          )}
          
          <div className="text-xs text-gray-500 space-y-2">
            <p><strong>🎯 测试内容：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>数据库连接测试</li>
              <li>用户表查询</li>
              <li>任务创建功能</li>
              <li>数据清理</li>
            </ul>
            
            <p className="mt-4"><strong>📝 如果测试失败：</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>检查 Supabase 连接配置</li>
              <li>确认已运行数据库更新脚本</li>
              <li>检查表结构和权限设置</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
