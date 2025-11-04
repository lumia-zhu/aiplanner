'use client'

/**
 * Agent 工具测试页面
 * 
 * 用于在浏览器中测试 Agent 工具
 * Phase 2 开发时使用，完成后可删除
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, AuthUser } from '@/lib/auth'

export default function TestAgentToolsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 检查登录状态
  useEffect(() => {
    const userData = getUserFromStorage()
    if (!userData) {
      router.push('/auth/login')
      return
    }
    setUser(userData)
    setIsLoading(false)
  }, [router])

  // 添加测试结果
  const addResult = (message: string) => {
    setTestResults(prev => [...prev, message])
    console.log(message)
  }

  // 测试 LoadTaskContextTool
  const testLoadTaskContextTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 LoadTaskContextTool ==========')
    
    try {
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      const tool = new LoadTaskContextTool()
      
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      addResult(`📝 工具描述: ${tool.description}`)
      
      addResult('\n🔄 执行工具（加载任务上下文）...')
      const result = await tool.execute({ userId: user.id })
      
      if (result.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📊 今天任务数: ${result.data.todayTasks.length}`)
        addResult(`📊 近3个月总任务数: ${result.data.recentTasksSummary.totalCount}`)
        addResult(`📊 紧急任务数: ${result.data.recentTasksSummary.urgentCount}`)
        addResult(`📊 缺少估算任务数: ${result.data.recentTasksSummary.missingEstimationCount}`)
        addResult(`📊 简化任务列表数: ${result.data.recentTasks.length}`)
        
        addResult('\n📅 月度统计:')
        addResult(`  上个月: ${result.data.recentTasksSummary.byMonth.previousMonth.completed}/${result.data.recentTasksSummary.byMonth.previousMonth.total} 已完成`)
        addResult(`  当前月: ${result.data.recentTasksSummary.byMonth.currentMonth.completed}/${result.data.recentTasksSummary.byMonth.currentMonth.total} 已完成`)
        addResult(`  下个月: ${result.data.recentTasksSummary.byMonth.nextMonth.completed}/${result.data.recentTasksSummary.byMonth.nextMonth.total} 已完成`)
        
      } else {
        addResult(`❌ 工具执行失败: ${result.message}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 AgentMemory.ensureTaskContext
  const testAgentMemoryEnsureTaskContext = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 AgentMemory.ensureTaskContext ==========')
    
    try {
      const { AgentMemory } = await import('@/lib/agent/AgentMemory')
      
      const memory = new AgentMemory()
      addResult('✅ AgentMemory 实例化成功')
      
      addResult('\n🔄 第一次调用 ensureTaskContext（应该加载）...')
      await memory.ensureTaskContext(user.id)
      
      const taskContext1 = memory.getTaskContext()
      if (taskContext1) {
        addResult('✅ 任务上下文已加载')
        addResult(`📊 今天任务数: ${taskContext1.todayTasks.length}`)
      } else {
        addResult('❌ 任务上下文未加载')
      }
      
      addResult('\n🔄 第二次调用 ensureTaskContext（应该使用缓存）...')
      await memory.ensureTaskContext(user.id)
      
      const taskContext2 = memory.getTaskContext()
      if (taskContext2 === taskContext1) {
        addResult('✅ 缓存机制生效（返回相同引用）')
      } else {
        addResult('⚠️  缓存机制未生效（返回不同引用）')
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试工具注册
  const testToolsRegistry = async () => {
    addResult('\n🧪 ========== 测试工具注册 ==========')
    
    try {
      const { getAllTools, getTool } = await import('@/lib/agent/tools')
      
      const tools = getAllTools()
      addResult(`✅ 工具数量: ${tools.length}`)
      
      tools.forEach((tool, index) => {
        addResult(`  ${index + 1}. ${tool.name} - ${tool.description.substring(0, 50)}...`)
      })
      
      if (tools.length > 0) {
        const firstTool = getTool(tools[0].name)
        addResult(`✅ getTool 测试成功: ${firstTool.name}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">🧪 Agent 工具测试</h1>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              用户: {user?.email}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Phase 2 - 工具层开发测试
            </p>
          </div>
          
          <div className="space-y-4 mb-6">
            <button
              onClick={testToolsRegistry}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              测试 1: 工具注册中心
            </button>
            
            <button
              onClick={testLoadTaskContextTool}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              测试 2: LoadTaskContextTool
            </button>
            
            <button
              onClick={testAgentMemoryEnsureTaskContext}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              测试 3: AgentMemory.ensureTaskContext
            </button>
            
            <button
              onClick={() => setTestResults([])}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              清空结果
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-[600px]">
            {testResults.length === 0 ? (
              <p className="text-gray-500">点击上方按钮开始测试...</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

