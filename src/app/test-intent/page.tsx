'use client'

/**
 * 意图分类器测试页面
 * 访问: http://localhost:3000/test-intent
 */

import { useState } from 'react'
import { classifyIntent, type IntentResult } from '@/lib/intentClassifier'

export default function TestIntentPage() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<IntentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Array<{
    message: string
    result: IntentResult
    expected: string
    pass: boolean
  }>>([])

  // 单个测试
  const handleTest = async () => {
    if (!message.trim()) return
    
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      console.log('🧪 开始测试消息:', message)
      const result = await classifyIntent(message)
      console.log('✅ 分类结果:', result)
      setResult(result)
    } catch (error) {
      console.error('❌ 分类失败:', error)
      setError(error instanceof Error ? error.message : '分类失败')
    } finally {
      setLoading(false)
    }
  }

  // 批量测试
  const handleBatchTest = async () => {
    console.log('🚀 开始批量测试...')
    
    const testCases = [
      // 普通聊天
      { message: '你好', expected: 'casual_chat' },
      { message: '啊啊啊啊', expected: 'casual_chat' },
      { message: '今天天气怎么样？', expected: 'casual_chat' },
      { message: '😊', expected: 'casual_chat' },
      { message: '谢谢', expected: 'casual_chat' },
      { message: 'hi', expected: 'casual_chat' },
      
      // 任务管理
      { message: '帮我创建一个任务：写报告', expected: 'task_management' },
      { message: '今天有什么任务？', expected: 'task_management' },
      { message: '完成买菜任务', expected: 'task_management' },
      { message: '删除第一个任务', expected: 'task_management' },
      { message: '查看我的待办', expected: 'task_management' },
      { message: '明天的任务', expected: 'task_management' },
    ]

    setLoading(true)
    setError(null)
    const results = []

    for (const testCase of testCases) {
      try {
        console.log(`测试: "${testCase.message}"`)
        const result = await classifyIntent(testCase.message)
        console.log(`结果: ${result.type} (期望: ${testCase.expected})`)
        
        results.push({
          message: testCase.message,
          result,
          expected: testCase.expected,
          pass: result.type === testCase.expected
        })
      } catch (error) {
        console.error(`❌ 测试失败: ${testCase.message}`, error)
        setError(error instanceof Error ? error.message : '批量测试失败')
      }
    }

    console.log('✅ 批量测试完成，结果数:', results.length)
    setTestResults(results)
    setLoading(false)
  }

  const passCount = testResults.filter(r => r.pass).length
  const totalCount = testResults.length

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 意图分类器测试</h1>

        {/* 单个测试 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">单条消息测试</h2>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTest()}
              placeholder="输入要测试的消息..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleTest}
              disabled={loading || !message.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '测试中...' : '测试'}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">❌</span>
                <span className="font-semibold text-red-700">分类失败</span>
              </div>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${
              result.type === 'task_management' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">
                  {result.type === 'task_management' ? '📋' : '💬'}
                </span>
                <span className="font-semibold">
                  {result.type === 'task_management' ? '任务管理' : '普通聊天'}
                </span>
                <span className="text-sm text-gray-600">
                  置信度: {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>
              {result.reason && (
                <p className="text-sm text-gray-600">原因: {result.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* 批量测试 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">批量测试</h2>
            <button
              onClick={handleBatchTest}
              disabled={loading}
              className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '测试中...' : '运行批量测试'}
            </button>
          </div>

          {testResults.length > 0 && (
            <>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold">
                  测试结果: {passCount}/{totalCount} 通过
                  <span className={`ml-2 ${passCount === totalCount ? 'text-green-600' : 'text-orange-600'}`}>
                    ({((passCount / totalCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {testResults.map((test, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      test.pass
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">
                        {test.pass ? '✅' : '❌'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">"{test.message}"</div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>期望: {test.expected === 'task_management' ? '📋 任务管理' : '💬 普通聊天'}</span>
                          <span className="mx-2">→</span>
                          <span>实际: {test.result.type === 'task_management' ? '📋 任务管理' : '💬 普通聊天'}</span>
                          <span className="mx-2">|</span>
                          <span>置信度: {(test.result.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {test.result.reason && (
                          <div className="text-xs text-gray-500 mt-1">
                            {test.result.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}





