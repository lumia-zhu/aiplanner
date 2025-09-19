'use client'

import { useState } from 'react'
import { testDatabaseConnection, createTestUser } from '@/lib/test-connection'

export default function TestPage() {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    setTestResult('正在测试连接...')
    
    try {
      const isConnected = await testDatabaseConnection()
      
      if (isConnected) {
        setTestResult('✅ 数据库连接测试成功！请查看浏览器控制台查看详细信息。')
      } else {
        setTestResult('❌ 数据库连接测试失败。请检查表是否已创建，并查看控制台错误信息。')
      }
    } catch (error) {
      setTestResult(`❌ 测试异常: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const createUser = async () => {
    setIsLoading(true)
    setTestResult('正在创建测试用户...')
    
    try {
      const user = await createTestUser()
      
      if (user) {
        setTestResult(`✅ 测试用户创建成功！用户ID: ${user.id}`)
      } else {
        setTestResult('❌ 测试用户创建失败。请查看控制台错误信息。')
      }
    } catch (error) {
      setTestResult(`❌ 创建用户异常: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            数据库连接测试
          </h1>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="space-y-4">
            <button
              onClick={runTest}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试数据库连接'}
            </button>
            
            <button
              onClick={createUser}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isLoading ? '创建中...' : '创建测试用户'}
            </button>
          </div>
          
          {testResult && (
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {testResult}
              </p>
            </div>
          )}
          
          <div className="mt-6 text-xs text-gray-500">
            <p>💡 提示：</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>确保已在 Supabase 中执行了 schema-custom-auth.sql</li>
              <li>检查环境变量是否正确配置</li>
              <li>打开浏览器开发者工具查看详细日志</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
