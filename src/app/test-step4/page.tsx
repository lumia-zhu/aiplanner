'use client'

import { useState } from 'react'
import AgentThoughtCard from '@/components/AgentThoughtCard'
import AgentActionCard from '@/components/AgentActionCard'
import AgentObservationCard from '@/components/AgentObservationCard'
import AgentNeedInputCard from '@/components/AgentNeedInputCard'
import AgentLoadingIndicator from '@/components/AgentLoadingIndicator'
import type { AgentThoughtData, AgentActionData, AgentObservationData, AgentNeedInputData, AgentLoadingData } from '@/lib/doubaoService'

export default function TestStep4Page() {
  const [userInput, setUserInput] = useState('')
  const [submittedInputs, setSubmittedInputs] = useState<string[]>([])

  // 模拟数据
  const thoughtData: AgentThoughtData = {
    thought: '用户想查看今天的任务，我需要先调用 load_task_context 加载任务上下文，然后调用 get_tasks 获取今天的任务列表。',
    iteration: 1,
    timestamp: new Date().toISOString()
  }

  const actionData: AgentActionData = {
    toolName: 'get_tasks',
    toolDescription: '查询用户任务',
    parameters: {
      userId: 'a224d5b0-4991-4344-ac77-3f4f2c08a081',
      dateRange: {
        start: '2025-11-07',
        end: '2025-11-07'
      },
      includeCompleted: false
    },
    timestamp: new Date().toISOString()
  }

  const observationSuccessData: AgentObservationData = {
    toolName: 'get_tasks',
    success: true,
    result: {
      tasks: [
        { id: '1', title: '完成报告', priority: 'high' },
        { id: '2', title: '开会讨论', priority: 'medium' }
      ],
      count: 2
    },
    timestamp: new Date().toISOString()
  }

  const observationErrorData: AgentObservationData = {
    toolName: 'get_tasks',
    success: false,
    result: null,
    error: '数据库连接超时，请稍后重试',
    timestamp: new Date().toISOString()
  }

  const needInputData: AgentNeedInputData = {
    toolName: 'clarify_task',
    prompt: '为了更好地澄清任务「完成产品设计」，请回答以下问题：\n1. 这个产品的核心功能是什么？\n2. 预计完成时间是什么时候？\n3. 有哪些关键的里程碑？',
    placeholder: '请输入您的回答...',
    context: {
      taskId: '123',
      currentIteration: 2
    },
    timestamp: new Date().toISOString()
  }

  const loadingData: AgentLoadingData = {
    iteration: 2,
    message: 'Agent 正在分析任务并生成建议...'
  }

  const handleInputSubmit = (input: string) => {
    console.log('📝 用户提交输入:', input)
    setSubmittedInputs(prev => [...prev, input])
    setUserInput('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🧪 Phase 4 Step 4 测试
          </h1>
          <p className="text-gray-600">
            测试 ChatSidebar 中 Agent 组件的渲染
          </p>
        </div>

        {/* Test Cases */}
        <div className="space-y-6">
          {/* 1. Agent Thought */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">1️⃣ Agent Thought Card</h2>
            <p className="text-sm text-gray-600 mb-3">
              显示 Agent 的推理过程（紫色主题）
            </p>
            <AgentThoughtCard data={thoughtData} />
          </div>

          {/* 2. Agent Action */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">2️⃣ Agent Action Card</h2>
            <p className="text-sm text-gray-600 mb-3">
              显示 Agent 调用的工具和参数（蓝色主题）
            </p>
            <AgentActionCard data={actionData} />
          </div>

          {/* 3. Agent Observation (Success) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">3️⃣ Agent Observation Card (成功)</h2>
            <p className="text-sm text-gray-600 mb-3">
              显示工具执行成功的结果（绿色主题）
            </p>
            <AgentObservationCard data={observationSuccessData} />
          </div>

          {/* 4. Agent Observation (Error) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">4️⃣ Agent Observation Card (失败)</h2>
            <p className="text-sm text-gray-600 mb-3">
              显示工具执行失败的错误信息（红色主题）
            </p>
            <AgentObservationCard data={observationErrorData} />
          </div>

          {/* 5. Agent Need Input */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">5️⃣ Agent Need Input Card</h2>
            <p className="text-sm text-gray-600 mb-3">
              Agent 需要用户输入时显示（黄色主题，带输入框）
            </p>
            <AgentNeedInputCard 
              data={needInputData}
              isActive={true}
              onSubmit={handleInputSubmit}
            />
            
            {/* 显示已提交的输入 */}
            {submittedInputs.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  📝 已提交的输入:
                </p>
                <ul className="space-y-1">
                  {submittedInputs.map((input, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {index + 1}. {input}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 6. Agent Loading */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">6️⃣ Agent Loading Indicator</h2>
            <p className="text-sm text-gray-600 mb-3">
              Agent 正在处理时显示（渐变动画）
            </p>
            <AgentLoadingIndicator data={loadingData} />
          </div>

          {/* 7. Agent Error (inline in ChatSidebar) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">7️⃣ Agent Error Message</h2>
            <p className="text-sm text-gray-600 mb-3">
              Agent 执行错误时显示（红色主题）
            </p>
            <div className="my-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 mb-1">
                    ❌ Agent 执行错误
                  </p>
                  <p className="text-sm text-red-600">
                    LLM 输出解析失败：无法识别输出格式
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full Conversation Flow */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">8️⃣ 完整对话流程演示</h2>
            <p className="text-sm text-gray-600 mb-4">
              模拟一个完整的 Agent 对话流程：Thought → Action → Observation → Response
            </p>
            
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              {/* User Message */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  U
                </div>
                <div className="bg-blue-100 rounded-lg px-3 py-2 max-w-[80%]">
                  <p className="text-sm text-gray-800">
                    我今天有哪些任务？
                  </p>
                </div>
              </div>
              
              {/* Agent Thought */}
              <AgentThoughtCard data={thoughtData} />
              
              {/* Agent Action */}
              <AgentActionCard data={actionData} />
              
              {/* Agent Observation */}
              <AgentObservationCard data={observationSuccessData} />
              
              {/* Agent Response */}
              <div className="flex items-start gap-3">
                <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[80%] border border-gray-200">
                  <p className="text-sm text-gray-800">
                    你今天有 <strong>2 个任务</strong>：<br />
                    1. 📌 <strong className="text-red-600">完成报告</strong> (高优先级)<br />
                    2. 📌 <strong className="text-yellow-600">开会讨论</strong> (中优先级)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Criteria */}
        <div className="bg-green-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">
            ✅ 成功标准
          </h3>
          <ul className="list-disc list-inside space-y-2 text-green-800">
            <li>✅ 所有 6 种 Agent 消息类型都能正确显示</li>
            <li>✅ 每种卡片的颜色主题正确（紫/蓝/绿/红/黄）</li>
            <li>✅ Agent Need Input 卡片的输入和提交功能正常</li>
            <li>✅ 折叠/展开功能（参数、结果）工作正常</li>
            <li>✅ 时间戳正确显示（无 Hydration 错误）</li>
            <li>✅ 完整对话流程展示清晰</li>
            <li>✅ 移动端适配良好（可缩小浏览器窗口测试）</li>
          </ul>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📖 测试说明
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>检查每个组件是否正确渲染，颜色主题是否符合预期</li>
            <li>点击 "查看参数" 和 "查看结果" 按钮，测试折叠/展开功能</li>
            <li>在 Agent Need Input 卡片中输入文本并提交</li>
            <li>查看完整对话流程，确认消息顺序和样式</li>
            <li>缩小浏览器窗口，测试移动端适配</li>
            <li>打开控制台（F12），确认没有错误</li>
          </ol>
        </div>
      </div>
    </div>
  )
}





