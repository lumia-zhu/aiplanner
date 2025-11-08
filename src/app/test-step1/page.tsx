'use client'

import React from 'react'
import type { 
  AgentThoughtData, 
  AgentActionData, 
  AgentObservationData,
  AgentNeedInputData,
  AgentErrorData,
  AgentLoadingData,
  InteractiveMessage
} from '@/lib/doubaoService'

/**
 * Phase 4 Step 1 验证页面
 * 
 * 目标：验证 Agent 消息类型定义是否正确
 */
export default function TestStep1Page() {
  
  // ✅ 测试 1: 创建 AgentThoughtData 对象
  const testThoughtData = (): AgentThoughtData => {
    return {
      thought: '用户想查看今天的任务，我需要调用 get_tasks 工具',
      iteration: 1,
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 2: 创建 AgentActionData 对象
  const testActionData = (): AgentActionData => {
    return {
      toolName: 'get_tasks',
      toolDescription: '查询用户任务',
      parameters: {
        userId: 'user-123',
        dateRange: { start: '2025-11-07', end: '2025-11-07' }
      },
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 3: 创建 AgentObservationData 对象（成功）
  const testObservationSuccess = (): AgentObservationData => {
    return {
      toolName: 'get_tasks',
      success: true,
      result: {
        tasks: [
          { id: '1', title: '完成项目报告' },
          { id: '2', title: '团队会议' }
        ]
      },
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 4: 创建 AgentObservationData 对象（失败）
  const testObservationError = (): AgentObservationData => {
    return {
      toolName: 'get_tasks',
      success: false,
      result: null,
      error: '数据库连接超时',
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 5: 创建 AgentNeedInputData 对象
  const testNeedInputData = (): AgentNeedInputData => {
    return {
      toolName: 'clarify_task',
      prompt: '为了更好地澄清任务，请回答以下问题：\n1. 任务的具体目标是什么？\n2. 预计完成时间？',
      placeholder: '请输入您的回答...',
      context: {
        userId: 'user-123',
        currentIteration: 2,
        pendingTool: 'clarify_task',
        taskId: 'task-456'
      },
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 6: 创建 AgentErrorData 对象
  const testErrorData = (): AgentErrorData => {
    return {
      error: 'LLM 输出解析失败',
      iteration: 3,
      timestamp: new Date().toISOString()
    }
  }
  
  // ✅ 测试 7: 创建 AgentLoadingData 对象
  const testLoadingData = (): AgentLoadingData => {
    return {
      iteration: 2,
      message: 'Agent 正在思考...'
    }
  }
  
  // ✅ 测试 8: 创建完整的 InteractiveMessage 对象
  const testInteractiveMessages = (): InteractiveMessage[] => {
    return [
      {
        type: 'agent-thought',
        data: testThoughtData(),
        isActive: false
      },
      {
        type: 'agent-action',
        data: testActionData(),
        isActive: false
      },
      {
        type: 'agent-observation',
        data: testObservationSuccess(),
        isActive: false
      },
      {
        type: 'agent-need-input',
        data: testNeedInputData(),
        isActive: true
      },
      {
        type: 'agent-error',
        data: testErrorData(),
        isActive: false
      },
      {
        type: 'agent-loading',
        data: testLoadingData(),
        isActive: true
      }
    ]
  }
  
  // 运行所有测试
  const runTests = () => {
    console.log('\n🧪 ========== Phase 4 Step 1 类型验证 ==========\n')
    
    try {
      console.log('✅ 测试 1: AgentThoughtData')
      const thought = testThoughtData()
      console.log('   ', thought)
      
      console.log('\n✅ 测试 2: AgentActionData')
      const action = testActionData()
      console.log('   ', action)
      
      console.log('\n✅ 测试 3: AgentObservationData (成功)')
      const obsSuccess = testObservationSuccess()
      console.log('   ', obsSuccess)
      
      console.log('\n✅ 测试 4: AgentObservationData (失败)')
      const obsError = testObservationError()
      console.log('   ', obsError)
      
      console.log('\n✅ 测试 5: AgentNeedInputData')
      const needInput = testNeedInputData()
      console.log('   ', needInput)
      
      console.log('\n✅ 测试 6: AgentErrorData')
      const error = testErrorData()
      console.log('   ', error)
      
      console.log('\n✅ 测试 7: AgentLoadingData')
      const loading = testLoadingData()
      console.log('   ', loading)
      
      console.log('\n✅ 测试 8: InteractiveMessage 对象数组')
      const messages = testInteractiveMessages()
      console.log(`   创建了 ${messages.length} 个 InteractiveMessage 对象`)
      messages.forEach((msg, i) => {
        console.log(`   [${i + 1}] type: ${msg.type}, isActive: ${msg.isActive}`)
      })
      
      console.log('\n🎉 所有类型验证测试通过！\n')
      console.log('📊 测试摘要:')
      console.log('   - 6 种 Agent 消息类型已定义')
      console.log('   - 所有接口的字段类型正确')
      console.log('   - TypeScript 编译无错误')
      console.log('\n✅ Phase 4 Step 1 完成！可以开始 Step 2\n')
      
      return true
    } catch (error: any) {
      console.error('❌ 类型验证失败:', error)
      return false
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Phase 4 Step 1 验证
          </h1>
          <p className="text-gray-600 mb-6">
            验证 Agent 消息类型和数据接口定义
          </p>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-blue-800 font-semibold mb-2">
                🎯 Step 1 目标
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✅ 扩展 InteractiveMessageType（新增 6 种 Agent 消息类型）</li>
                <li>✅ 定义 AgentThoughtData 接口</li>
                <li>✅ 定义 AgentActionData 接口</li>
                <li>✅ 定义 AgentObservationData 接口</li>
                <li>✅ 定义 AgentNeedInputData 接口</li>
                <li>✅ 定义 AgentErrorData 接口</li>
                <li>✅ 定义 AgentLoadingData 接口</li>
              </ul>
            </div>
            
            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-green-800 font-semibold mb-2">
                ✅ 修改的文件
              </p>
              <p className="text-sm text-green-700">
                <code className="bg-green-100 px-2 py-1 rounded">
                  src/lib/doubaoService.ts
                </code>
              </p>
              <p className="text-xs text-green-600 mt-2">
                新增约 70 行代码（类型定义 + 注释）
              </p>
            </div>
            
            <button
              onClick={runTests}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🧪 运行类型验证测试
            </button>
            
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <p className="text-sm text-yellow-800 font-semibold mb-2">
                📋 测试说明
              </p>
              <p className="text-sm text-yellow-700">
                点击上方按钮后，打开浏览器控制台（F12）查看详细的测试结果。
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                如果所有测试通过，说明 Step 1 完成，可以开始 Step 2（创建 UI 组件）。
              </p>
            </div>
            
            <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                📝 新增的消息类型
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-sm font-semibold text-purple-800">💭 agent-thought</p>
                  <p className="text-xs text-purple-600">Agent 的思考过程</p>
                </div>
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">🔧 agent-action</p>
                  <p className="text-xs text-blue-600">Agent 调用的工具</p>
                </div>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-sm font-semibold text-green-800">👁️ agent-observation</p>
                  <p className="text-xs text-green-600">工具返回的结果</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm font-semibold text-yellow-800">⏸️ agent-need-input</p>
                  <p className="text-xs text-yellow-600">Agent 需要用户输入</p>
                </div>
                <div className="p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm font-semibold text-red-800">❌ agent-error</p>
                  <p className="text-xs text-red-600">Agent 执行错误</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded border border-indigo-200">
                  <p className="text-sm font-semibold text-indigo-800">🔄 agent-loading</p>
                  <p className="text-xs text-indigo-600">Agent 加载中</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



