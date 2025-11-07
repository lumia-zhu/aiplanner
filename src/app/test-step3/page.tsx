'use client'

import { useEffect, useState } from 'react'
import { ReactAgent } from '@/lib/agent/ReactAgent'
import { AgentMemory } from '@/lib/agent/AgentMemory'
import { getAllTools } from '@/lib/agent/tools'
import { doubaoService } from '@/lib/doubaoService'

export default function TestStep3Page() {
  const [agentInstance, setAgentInstance] = useState<ReactAgent | null>(null)
  const [agentMemory] = useState(() => new AgentMemory())
  const [testResults, setTestResults] = useState<string[]>([])
  const [isAgentMode, setIsAgentMode] = useState(false)

  // 测试 Agent 初始化
  useEffect(() => {
    if (!agentInstance) {
      try {
        const tools = getAllTools()
        const agent = new ReactAgent(doubaoService, tools, agentMemory)
        setAgentInstance(agent)
        addTestResult('✅ ReactAgent 初始化成功')
        addTestResult(`✅ 工具数量: ${tools.length} 个`)
        console.log('✅ ReactAgent 初始化成功')
      } catch (error: any) {
        addTestResult(`❌ ReactAgent 初始化失败: ${error.message}`)
        console.error('❌ ReactAgent 初始化失败:', error)
      }
    }
  }, [agentInstance, agentMemory])

  // 检查 Agent 模式
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('ai_assistant_mode')
      setIsAgentMode(mode === 'agent')
      addTestResult(`ℹ️ 当前模式: ${mode || 'normal'} (Agent 模式: ${mode === 'agent'})`)
    }
  }, [])

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, result])
  }

  const toggleAgentMode = () => {
    if (typeof window !== 'undefined') {
      const newMode = isAgentMode ? 'normal' : 'agent'
      localStorage.setItem('ai_assistant_mode', newMode)
      setIsAgentMode(!isAgentMode)
      addTestResult(`🔄 切换模式为: ${newMode}`)
    }
  }

  const testBasicCall = async () => {
    if (!agentInstance) {
      addTestResult('❌ Agent 实例不存在')
      return
    }

    try {
      addTestResult('🧪 测试基本调用: "你好"')
      const result = await agentInstance.run('你好', {
        userId: 'test_user',
        userProfile: null,
        dateScope: {
          type: 'day',
          start: '2025-11-07',
          end: '2025-11-07'
        }
      })
      
      addTestResult(`✅ Agent 返回类型: ${result.type}`)
      addTestResult(`✅ 迭代次数: ${result.metadata?.thoughts?.length || 0}`)
      console.log('📊 Agent 返回结果:', result)
    } catch (error: any) {
      addTestResult(`❌ 调用失败: ${error.message}`)
      console.error('❌ 调用失败:', error)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🧪 Phase 4 Step 3 测试
          </h1>
          <p className="text-gray-600">
            测试 ReactAgent 在 dashboard 中的集成
          </p>
        </div>

        {/* Agent Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 Agent 状态</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Agent 实例:</span>
              <span className={`font-semibold ${agentInstance ? 'text-green-600' : 'text-red-600'}`}>
                {agentInstance ? '✅ 已初始化' : '❌ 未初始化'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">当前模式:</span>
              <span className={`font-semibold ${isAgentMode ? 'text-blue-600' : 'text-gray-600'}`}>
                {isAgentMode ? '🤖 Agent 模式' : '💬 普通模式'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">内存实例:</span>
              <span className="font-semibold text-green-600">
                ✅ 已创建
              </span>
            </div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🎯 测试操作</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleAgentMode}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {isAgentMode ? '切换到普通模式' : '切换到 Agent 模式'}
            </button>
            <button
              onClick={testBasicCall}
              disabled={!agentInstance}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              测试 Agent 调用
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              清空结果
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">📝 测试结果</h2>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500 italic">暂无测试结果</p>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {testResults.map((result, index) => (
                  <div key={index} className="text-gray-700">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📖 测试说明
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>检查 Agent 实例是否成功初始化</li>
            <li>尝试切换 Agent 模式和普通模式</li>
            <li>点击"测试 Agent 调用"按钮，发送简单消息</li>
            <li>检查控制台是否有错误日志</li>
            <li>查看测试结果，确认 Agent 正常响应</li>
          </ol>
        </div>

        {/* Success Criteria */}
        <div className="bg-green-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">
            ✅ 成功标准
          </h3>
          <ul className="list-disc list-inside space-y-2 text-green-800">
            <li>✅ Agent 实例初始化成功（无错误）</li>
            <li>✅ 能够切换 Agent 模式和普通模式</li>
            <li>✅ Agent 能够响应简单消息</li>
            <li>✅ 控制台没有 TypeScript 错误或运行时错误</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

