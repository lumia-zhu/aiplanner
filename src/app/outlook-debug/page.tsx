'use client'

import { useState } from 'react'
import { microsoftAuth } from '@/lib/microsoftAuth'

export default function OutlookDebugPage() {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const runDiagnostics = async () => {
    setIsLoading(true)
    setResult('🔍 开始诊断 Outlook 集成...\n\n')
    
    try {
      // 1. 检查环境变量
      setResult(prev => prev + '1️⃣ 检查环境变量配置...\n')
      const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID
      if (!clientId) {
        setResult(prev => prev + '❌ NEXT_PUBLIC_MICROSOFT_CLIENT_ID 未配置\n')
        setResult(prev => prev + '💡 请在 .env.local 中添加 Microsoft 客户端 ID\n\n')
        return
      } else {
        setResult(prev => prev + `✅ 客户端 ID: ${clientId.substring(0, 8)}...\n\n`)
      }

      // 2. 初始化 MSAL
      setResult(prev => prev + '2️⃣ 初始化 Microsoft 认证...\n')
      try {
        await microsoftAuth.initialize()
        setResult(prev => prev + '✅ MSAL 初始化成功\n\n')
      } catch (error) {
        setResult(prev => prev + `❌ MSAL 初始化失败: ${error}\n\n`)
        return
      }

      // 3. 检查登录状态
      setResult(prev => prev + '3️⃣ 检查登录状态...\n')
      const isLoggedIn = microsoftAuth.isLoggedIn()
      if (isLoggedIn) {
        const account = microsoftAuth.getCurrentAccount()
        setResult(prev => prev + `✅ 已登录: ${account?.username}\n\n`)
      } else {
        setResult(prev => prev + '⚠️ 未登录，尝试登录...\n')
        try {
          const account = await microsoftAuth.login()
          if (account) {
            setResult(prev => prev + `✅ 登录成功: ${account.username}\n\n`)
          } else {
            setResult(prev => prev + '❌ 登录失败\n\n')
            return
          }
        } catch (loginError) {
          setResult(prev => prev + `❌ 登录失败: ${loginError}\n\n`)
          return
        }
      }

      // 4. 测试访问令牌
      setResult(prev => prev + '4️⃣ 获取访问令牌...\n')
      try {
        const token = await microsoftAuth.getAccessToken()
        setResult(prev => prev + `✅ 访问令牌获取成功: ${token.substring(0, 20)}...\n\n`)
      } catch (tokenError) {
        setResult(prev => prev + `❌ 访问令牌获取失败: ${tokenError}\n\n`)
        return
      }

      // 5. 测试 Graph 客户端
      setResult(prev => prev + '5️⃣ 创建 Graph 客户端...\n')
      try {
        const graphClient = await microsoftAuth.createGraphClient()
        setResult(prev => prev + '✅ Graph 客户端创建成功\n\n')

        // 6. 测试用户信息访问
        setResult(prev => prev + '6️⃣ 测试用户信息访问...\n')
        const userResponse = await graphClient.api('/me').get()
        setResult(prev => prev + `✅ 用户信息: ${userResponse.displayName || userResponse.userPrincipalName}\n\n`)

        // 7. 测试任务列表访问
        setResult(prev => prev + '7️⃣ 测试任务列表访问...\n')
        try {
          const todoResponse = await graphClient.api('/me/todo/lists').get()
          setResult(prev => prev + `✅ 任务列表数量: ${todoResponse.value?.length || 0}\n`)
          
          if (todoResponse.value && todoResponse.value.length > 0) {
            setResult(prev => prev + '📋 任务列表:\n')
            todoResponse.value.forEach((list: any, index: number) => {
              setResult(prev => prev + `  ${index + 1}. ${list.displayName} (${list.id})\n`)
            })
            
            // 8. 测试获取任务
            setResult(prev => prev + '\n8️⃣ 测试获取任务...\n')
            const defaultListId = todoResponse.value[0].id
            
            // 先尝试不带 select 的简单请求
            try {
              const simpleTasksResponse = await graphClient
                .api(`/me/todo/lists/${defaultListId}/tasks`)
                .top(5)
                .get()
              
              setResult(prev => prev + `✅ 简单请求成功，任务数量: ${simpleTasksResponse.value?.length || 0}\n`)
              
              // 再尝试带 select 的请求
              const tasksResponse = await graphClient
                .api(`/me/todo/lists/${defaultListId}/tasks`)
                .select('id,title,body,importance,status,dueDateTime')
                .top(5)
                .get()
              
              setResult(prev => prev + `✅ 完整请求成功\n`)
              
            } catch (taskError: any) {
              setResult(prev => prev + `❌ 简单请求也失败: ${taskError.message}\n`)
              
              // 尝试最基础的请求
              try {
                const basicResponse = await graphClient
                  .api(`/me/todo/lists/${defaultListId}/tasks`)
                  .get()
                setResult(prev => prev + `✅ 基础请求成功\n`)
                var tasksResponse = basicResponse
              } catch (basicError: any) {
                setResult(prev => prev + `❌ 基础请求失败: ${basicError.message}\n`)
                throw basicError
              }
            }
            
            setResult(prev => prev + `✅ 任务数量: ${tasksResponse.value?.length || 0}\n`)
            
            if (tasksResponse.value && tasksResponse.value.length > 0) {
              setResult(prev => prev + '📝 前 3 个任务:\n')
              tasksResponse.value.slice(0, 3).forEach((task: any, index: number) => {
                setResult(prev => prev + `  ${index + 1}. ${task.title} (${task.status})\n`)
              })
            }
          } else {
            setResult(prev => prev + '📭 没有找到任务列表\n')
          }
          
        } catch (todoError: any) {
          setResult(prev => prev + `❌ 任务列表访问失败: ${todoError.message}\n`)
          setResult(prev => prev + `错误代码: ${todoError.code || 'Unknown'}\n`)
          setResult(prev => prev + `状态码: ${todoError.statusCode || 'Unknown'}\n`)
        }

      } catch (graphError) {
        setResult(prev => prev + `❌ Graph 客户端创建失败: ${graphError}\n\n`)
        return
      }

      setResult(prev => prev + '\n🎉 诊断完成！如果看到这条消息，说明配置基本正确。\n')

    } catch (error) {
      setResult(prev => prev + `\n💥 诊断过程出现异常: ${error}\n`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setResult('')
  }

  const logout = async () => {
    try {
      await microsoftAuth.logout()
      setResult(prev => prev + '\n🔓 已登出 Microsoft 账户\n')
    } catch (error) {
      setResult(prev => prev + `\n❌ 登出失败: ${error}\n`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Outlook 集成诊断工具
          </h1>
          <p className="text-gray-600">
            检查 Microsoft Graph API 配置和连接状态
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="flex space-x-4">
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              {isLoading ? '诊断中...' : '🔍 开始诊断'}
            </button>
            
            <button
              onClick={clearResults}
              disabled={isLoading}
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              清空结果
            </button>
            
            <button
              onClick={logout}
              disabled={isLoading}
              className="bg-red-100 text-red-700 px-6 py-3 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              登出账户
            </button>
          </div>
          
          {result && (
            <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{result}</pre>
            </div>
          )}
          
          <div className="text-sm text-gray-500 space-y-2">
            <p><strong>💡 使用说明：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>点击"开始诊断"检查完整的配置</li>
              <li>查看控制台输出了解详细的错误信息</li>
              <li>根据诊断结果修复配置问题</li>
            </ul>
            
            <p className="mt-4"><strong>🔧 常见问题：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>环境变量未配置：检查 .env.local 文件</li>
              <li>权限不足：在 Azure AD 中添加 Tasks.Read 权限</li>
              <li>重定向 URI 不匹配：检查 Azure AD 配置</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
