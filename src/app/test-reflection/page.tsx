'use client'

/**
 * 每日反思 CRUD 测试页面
 * 
 * 访问方式：http://localhost:3000/test-reflection
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage } from '@/lib/auth'
import { dailyReflectionTests } from '@/lib/__tests__/dailyReflections.test'
import { testGenerateReflectionSummary } from '@/lib/reflectionSummaryAI'

export default function TestReflectionPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [testReflectionId, setTestReflectionId] = useState<string | null>(null)

  useEffect(() => {
    const currentUser = getUserFromStorage()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)
  }, [router])

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const colors = {
      info: '🔵',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `${colors[type]} [${timestamp}] ${message}`])
  }

  const clearLogs = () => setLogs([])

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setIsRunning(true)
    try {
      addLog(`开始执行: ${testName}`, 'info')
      const result = await testFn()
      addLog(`${testName} - 通过`, 'success')
      return result
    } catch (error: any) {
      addLog(`${testName} - 失败: ${error.message}`, 'error')
      throw error
    } finally {
      setIsRunning(false)
    }
  }

  const handleRunAllTests = async () => {
    if (!user) return
    clearLogs()
    setIsRunning(true)
    
    try {
      addLog('开始执行完整测试流程...', 'info')
      const reflectionId = await dailyReflectionTests.runAllTests(user.id)
      setTestReflectionId(reflectionId)
      addLog('所有测试通过！', 'success')
    } catch (error: any) {
      addLog(`测试失败: ${error.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const handleCleanup = async () => {
    if (!user) return
    setIsRunning(true)
    
    try {
      addLog('开始清理测试数据...', 'warning')
      await dailyReflectionTests.cleanupTodayReflection(user.id)
      setTestReflectionId(null)
      addLog('清理完成', 'success')
    } catch (error: any) {
      addLog(`清理失败: ${error.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const handleTestAISummary = async () => {
    setIsRunning(true)
    clearLogs()
    
    try {
      addLog('开始测试 AI 总结生成...', 'info')
      addLog('这将测试3个场景：完整回答、部分跳过、全部跳过', 'info')
      
      // 捕获控制台输出
      const originalLog = console.log
      console.log = (...args: any[]) => {
        const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
        addLog(message, 'info')
        originalLog(...args)
      }
      
      await testGenerateReflectionSummary()
      
      // 恢复控制台
      console.log = originalLog
      
      addLog('AI 总结测试完成！', 'success')
    } catch (error: any) {
      addLog(`AI 总结测试失败: ${error.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🧪 每日反思 CRUD 服务测试
          </h1>
          <p className="text-gray-600">
            当前用户: <span className="font-medium">{user.username}</span> ({user.id})
          </p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">测试控制</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRunAllTests}
              disabled={isRunning}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🚀 运行完整测试
            </button>
            
            <button
              onClick={handleTestAISummary}
              disabled={isRunning}
              className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🤖 测试AI总结
            </button>
            
            <button
              onClick={() => runTest('测试1: 随机抽取问题', () => dailyReflectionTests.test1_RandomQuestions())}
              disabled={isRunning}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              测试1: 随机问题
            </button>
            
            <button
              onClick={() => runTest('测试2: 查询今天反思', () => dailyReflectionTests.test2_GetTodayReflection(user.id))}
              disabled={isRunning}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              测试2: 查询反思
            </button>
            
            <button
              onClick={() => runTest('测试3: 创建反思', async () => {
                const r = await dailyReflectionTests.test3_CreateReflection(user.id)
                if (r) setTestReflectionId(r.id)
                return r
              })}
              disabled={isRunning}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              测试3: 创建反思
            </button>
            
            <button
              onClick={() => runTest('测试9: 查询历史', () => dailyReflectionTests.test9_GetHistory(user.id))}
              disabled={isRunning}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              测试9: 查询历史
            </button>
            
            <button
              onClick={() => runTest('测试10: 统计信息', () => dailyReflectionTests.test10_GetStats(user.id))}
              disabled={isRunning}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              测试10: 统计
            </button>
            
            <button
              onClick={handleCleanup}
              disabled={isRunning}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🧹 清理测试数据
            </button>
            
            <button
              onClick={clearLogs}
              disabled={isRunning}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              清空日志
            </button>
          </div>
          
          {testReflectionId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <span className="font-medium">测试反思ID:</span> {testReflectionId}
              </p>
            </div>
          )}
        </div>

        {/* 日志输出 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">测试日志</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">等待测试...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/notes-dashboard')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            返回主页面
          </button>
        </div>
      </div>
    </div>
  )
}

