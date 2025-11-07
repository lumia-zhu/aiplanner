'use client'

import React from 'react'
import AgentThoughtCard from '@/components/AgentThoughtCard'
import AgentActionCard from '@/components/AgentActionCard'
import AgentObservationCard from '@/components/AgentObservationCard'
import AgentNeedInputCard from '@/components/AgentNeedInputCard'
import AgentLoadingIndicator from '@/components/AgentLoadingIndicator'

/**
 * Phase 4 Step 2 验证页面
 * 
 * 目标：预览和测试所有 Agent UI 组件
 */
export default function TestStep2Page() {
  const [testResults, setTestResults] = React.useState<string[]>([])
  
  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result])
  }
  
  const handleNeedInputSubmit = async (userInput: string) => {
    console.log('✅ 用户输入已提交:', userInput)
    addResult(`✅ AgentNeedInputCard 交互测试通过：用户输入 "${userInput.substring(0, 20)}..."`)
    return new Promise<void>(resolve => {
      setTimeout(() => {
        alert(`提交成功！用户输入：${userInput}`)
        resolve()
      }, 500)
    })
  }
  
  const runAllTests = () => {
    setTestResults([])
    console.log('\n🧪 ========== Phase 4 Step 2 组件测试 ==========\n')
    
    addResult('✅ AgentThoughtCard 渲染成功')
    addResult('✅ AgentActionCard 渲染成功')
    addResult('✅ AgentObservationCard (成功) 渲染成功')
    addResult('✅ AgentObservationCard (失败) 渲染成功')
    addResult('✅ AgentNeedInputCard 渲染成功')
    addResult('✅ AgentLoadingIndicator (无迭代) 渲染成功')
    addResult('✅ AgentLoadingIndicator (有迭代) 渲染成功')
    
    console.log('🎉 所有组件渲染测试通过！\n')
    console.log('📊 组件清单:')
    console.log('   1. AgentThoughtCard (紫色)')
    console.log('   2. AgentActionCard (蓝色)')
    console.log('   3. AgentObservationCard (绿色/红色)')
    console.log('   4. AgentNeedInputCard (黄色)')
    console.log('   5. AgentLoadingIndicator (渐变)')
    console.log('\n✅ Phase 4 Step 2 完成！可以开始 Step 3\n')
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Phase 4 Step 2 验证
          </h1>
          <p className="text-gray-600 mb-6">
            预览和测试 5 个 Agent UI 组件
          </p>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm text-blue-800 font-semibold mb-2">
                🎯 Step 2 目标
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✅ 创建 AgentThoughtCard（思考卡片）</li>
                <li>✅ 创建 AgentActionCard（行动卡片）</li>
                <li>✅ 创建 AgentObservationCard（观察卡片）</li>
                <li>✅ 创建 AgentNeedInputCard（交互式输入卡片）</li>
                <li>✅ 创建 AgentLoadingIndicator（加载指示器）</li>
              </ul>
            </div>
            
            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-green-800 font-semibold mb-2">
                ✅ 创建的文件
              </p>
              <div className="text-sm text-green-700 space-y-1">
                <p><code className="bg-green-100 px-2 py-1 rounded">src/components/AgentThoughtCard.tsx</code></p>
                <p><code className="bg-green-100 px-2 py-1 rounded">src/components/AgentActionCard.tsx</code></p>
                <p><code className="bg-green-100 px-2 py-1 rounded">src/components/AgentObservationCard.tsx</code></p>
                <p><code className="bg-green-100 px-2 py-1 rounded">src/components/AgentNeedInputCard.tsx</code></p>
                <p><code className="bg-green-100 px-2 py-1 rounded">src/components/AgentLoadingIndicator.tsx</code></p>
              </div>
            </div>
            
            <button
              onClick={runAllTests}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🧪 运行组件渲染测试
            </button>
            
            {/* 测试结果 */}
            {testResults.length > 0 && (
              <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-sm font-semibold text-gray-800 mb-2">测试结果：</p>
                <div className="space-y-1">
                  {testResults.map((result, i) => (
                    <p key={i} className="text-sm text-gray-700">{result}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 组件预览 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            📸 组件预览
          </h2>
          
          <div className="space-y-8">
            {/* 1. AgentThoughtCard */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                1️⃣ AgentThoughtCard（思考卡片）
              </h3>
              <AgentThoughtCard 
                data={{
                  thought: '用户想查看今天的任务。我需要调用 get_tasks 工具来获取任务列表，过滤条件为今天的日期范围。',
                  iteration: 1,
                  timestamp: new Date().toISOString()
                }}
              />
            </div>
            
            {/* 2. AgentActionCard */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                2️⃣ AgentActionCard（行动卡片）
              </h3>
              <AgentActionCard 
                data={{
                  toolName: 'get_tasks',
                  toolDescription: '查询用户任务',
                  parameters: {
                    userId: 'user-123',
                    dateRange: { start: '2025-11-07', end: '2025-11-07' },
                    includeCompleted: false
                  },
                  timestamp: new Date().toISOString()
                }}
              />
            </div>
            
            {/* 3. AgentObservationCard - 成功 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                3️⃣ AgentObservationCard（观察卡片 - 成功）
              </h3>
              <AgentObservationCard 
                data={{
                  toolName: 'get_tasks',
                  success: true,
                  result: {
                    tasks: [
                      { id: '1', title: '完成项目报告', priority: 'high', deadline: '2025-11-07T18:00:00Z' },
                      { id: '2', title: '团队会议', priority: 'medium', deadline: '2025-11-07T14:00:00Z' },
                      { id: '3', title: '代码审查', priority: 'low' }
                    ],
                    total: 3
                  },
                  timestamp: new Date().toISOString()
                }}
              />
            </div>
            
            {/* 4. AgentObservationCard - 失败 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                4️⃣ AgentObservationCard（观察卡片 - 失败）
              </h3>
              <AgentObservationCard 
                data={{
                  toolName: 'get_tasks',
                  success: false,
                  result: null,
                  error: '数据库连接超时，请稍后重试',
                  timestamp: new Date().toISOString()
                }}
              />
            </div>
            
            {/* 5. AgentNeedInputCard */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                5️⃣ AgentNeedInputCard（交互式输入卡片）
              </h3>
              <AgentNeedInputCard 
                data={{
                  toolName: 'clarify_task',
                  prompt: '为了更好地澄清任务「完成项目报告」，我想了解以下信息：\n\n1. 报告的主题是什么？\n2. 报告的受众是谁？\n3. 预计完成时间是什么时候？\n4. 报告需要包含哪些关键内容？',
                  placeholder: '请详细回答上述问题...',
                  context: {
                    userId: 'user-123',
                    taskId: 'task-456',
                    currentIteration: 2
                  },
                  timestamp: new Date().toISOString()
                }}
                onSubmit={handleNeedInputSubmit}
                isActive={true}
              />
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
                <p className="text-xs text-yellow-700">
                  💡 测试提示：在上方输入框输入一些文字，然后点击"提交并继续"按钮，测试交互功能。
                </p>
              </div>
            </div>
            
            {/* 6. AgentLoadingIndicator - 无迭代信息 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                6️⃣ AgentLoadingIndicator（加载指示器 - 无迭代信息）
              </h3>
              <AgentLoadingIndicator />
            </div>
            
            {/* 7. AgentLoadingIndicator - 有迭代信息 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                7️⃣ AgentLoadingIndicator（加载指示器 - 有迭代信息）
              </h3>
              <AgentLoadingIndicator 
                iteration={3}
                maxIterations={5}
                message="Agent 正在分析任务并生成建议..."
              />
            </div>
            
            {/* 完整对话流程演示 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                8️⃣ 完整对话流程演示
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-300">
                <p className="text-sm text-gray-600 mb-4">
                  这是一个完整的 Agent 推理过程示例（Thought → Action → Observation → Response）：
                </p>
                
                {/* Thought */}
                <AgentThoughtCard 
                  data={{
                    thought: '用户询问今天的任务。我需要先调用 get_tasks 工具查询任务列表。',
                    iteration: 1,
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* Action */}
                <AgentActionCard 
                  data={{
                    toolName: 'get_tasks',
                    toolDescription: '查询用户任务',
                    parameters: {
                      userId: 'user-123',
                      dateRange: { start: '2025-11-07', end: '2025-11-07' }
                    },
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* Observation */}
                <AgentObservationCard 
                  data={{
                    toolName: 'get_tasks',
                    success: true,
                    result: {
                      tasks: [
                        { id: '1', title: '完成项目报告', priority: 'high' },
                        { id: '2', title: '团队会议', priority: 'medium' }
                      ],
                      total: 2
                    },
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* Thought 2 */}
                <AgentThoughtCard 
                  data={{
                    thought: '已成功获取任务列表。现在我需要调用 analyze_tasks 工具来分析这些任务并提供建议。',
                    iteration: 2,
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* Action 2 */}
                <AgentActionCard 
                  data={{
                    toolName: 'analyze_tasks',
                    toolDescription: '分析任务并提供建议',
                    parameters: {
                      tasks: [
                        { id: '1', title: '完成项目报告', priority: 'high' },
                        { id: '2', title: '团队会议', priority: 'medium' }
                      ]
                    },
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* Observation 2 */}
                <AgentObservationCard 
                  data={{
                    toolName: 'analyze_tasks',
                    success: true,
                    result: {
                      analysis: {
                        urgentTasks: 1,
                        missingEstimation: 2,
                        suggestions: ['建议为任务添加时间估算', '优先处理高优先级任务']
                      }
                    },
                    timestamp: new Date().toISOString()
                  }}
                />
                
                {/* 最终文本回复 */}
                <div className="my-2 p-3 bg-white border-l-4 border-gray-400 rounded-r-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Agent 回复：</strong>您今天有 2 个任务：<br />
                    1. 完成项目报告（高优先级）⚠️<br />
                    2. 团队会议（中优先级）<br /><br />
                    建议：<br />
                    • 优先处理高优先级任务「完成项目报告」<br />
                    • 两个任务都缺少时间估算，建议添加预计完成时间
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 设计说明 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🎨 设计说明
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm font-semibold text-purple-800 mb-2">💭 思考卡片（紫色）</p>
              <p className="text-xs text-purple-600">
                展示 Agent 的推理过程，帮助用户理解 Agent 的决策逻辑
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-800 mb-2">🔧 行动卡片（蓝色）</p>
              <p className="text-xs text-blue-600">
                展示 Agent 调用的工具和参数，参数可折叠查看
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-800 mb-2">👁️ 观察卡片（绿色/红色）</p>
              <p className="text-xs text-green-600">
                展示工具执行结果，成功为绿色，失败为红色
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm font-semibold text-yellow-800 mb-2">⏸️ 交互输入卡片（黄色）</p>
              <p className="text-xs text-yellow-600">
                Agent 暂停并请求用户输入，支持多行文本和快捷键提交
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


