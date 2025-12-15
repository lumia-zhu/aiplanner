'use client'

import { useState } from 'react'
import { generateDynamicClarificationQuestions } from '@/lib/clarificationAI'
import { generateTimeQuestions, generatePriorityQuestions } from '@/lib/reflectionFlow'
import type { Task } from '@/types'
import type { TaskSnapshot } from '@/types/reflection'

export default function TestReflectionQuestionsPage() {
  // 任务输入状态
  const [taskTitle, setTaskTitle] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | ''>('')
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [deadline, setDeadline] = useState('')
  
  // 生成选项
  const [generateClarity, setGenerateClarity] = useState(true)
  const [generateTime, setGenerateTime] = useState(true)
  const [generatePriority, setGeneratePriority] = useState(true)
  
  // 生成结果
  const [clarityQuestions, setClarityQuestions] = useState<string[]>([])
  const [timeQuestions, setTimeQuestions] = useState<string[]>([])
  const [priorityQuestions, setPriorityQuestions] = useState<string[]>([])
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 生成问题
  const handleGenerate = async () => {
    if (!taskTitle.trim()) {
      setError('请输入任务标题')
      return
    }

    setIsLoading(true)
    setError(null)
    
    // 清空之前的结果
    setClarityQuestions([])
    setTimeQuestions([])
    setPriorityQuestions([])

    try {
      // 构建任务对象
      const task: Task = {
        id: 'test-task-1',
        user_id: 'test-user',
        title: taskTitle,
        completed: false,
        priority: priority || undefined,
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
        deadline_datetime: deadline || undefined,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // 构建 TaskSnapshot
      const taskSnapshot: TaskSnapshot = {
        id: 'test-task-1',
        title: taskTitle,
        priority: priority || undefined,
        estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
        deadline: deadline || undefined,
        isCompleted: false,
        notePosition: 0,
        depth: 0
      }

      // 生成澄清任务问题
      if (generateClarity) {
        console.log('🔵 生成澄清任务问题...')
        const questions = await generateDynamicClarificationQuestions(task)
        setClarityQuestions(questions)
        console.log('✅ 澄清任务问题:', questions)
      }

      // 生成时间规划问题
      if (generateTime) {
        console.log('🟢 生成时间规划问题...')
        const questions = await generateTimeQuestions([taskSnapshot])
        setTimeQuestions(questions)
        console.log('✅ 时间规划问题:', questions)
      }

      // 生成优先级问题
      if (generatePriority) {
        console.log('🟠 生成优先级问题...')
        const questions = await generatePriorityQuestions([taskSnapshot])
        setPriorityQuestions(questions)
        console.log('✅ 优先级问题:', questions)
      }

    } catch (err: any) {
      console.error('❌ 生成问题失败:', err)
      setError(`生成失败: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 清空表单
  const handleClear = () => {
    setTaskTitle('')
    setPriority('')
    setEstimatedDuration('')
    setDeadline('')
    setClarityQuestions([])
    setTimeQuestions([])
    setPriorityQuestions([])
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 反思问题生成测试工具
          </h1>
          <p className="text-gray-600">
            测试和调整澄清任务、时间规划、优先级排列的反思性问题生成
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入区 */}
          <div className="space-y-6">
            {/* 任务输入区 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                📝 任务输入
              </h2>
              
              <div className="space-y-4">
                {/* 任务标题 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    任务标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="例如：准备Qualify Exam"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 优先级 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优先级 (可选)
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">未设置</option>
                    <option value="high">High - 高优先级</option>
                    <option value="medium">Medium - 中优先级</option>
                    <option value="low">Low - 低优先级</option>
                  </select>
                </div>

                {/* 预估时长 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    预估时长 (可选，分钟)
                  </label>
                  <input
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    placeholder="例如：120"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 截止日期 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    截止日期 (可选)
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 生成选项 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ⚙️ 生成选项
              </h2>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={generateClarity}
                    onChange={(e) => setGenerateClarity(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">📝 澄清任务 (Clarity)</div>
                    <div className="text-sm text-gray-600">明确任务目标和边界</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={generateTime}
                    onChange={(e) => setGenerateTime(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">⏱️ 时间规划 (Time Planning)</div>
                    <div className="text-sm text-gray-600">校准时间估计和识别依赖</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={generatePriority}
                    onChange={(e) => setGeneratePriority(e.target.checked)}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">🎯 优先级排列 (Priority)</div>
                    <div className="text-sm text-gray-600">梳理任务轻重缓急</div>
                  </div>
                </label>
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !taskTitle.trim()}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? '生成中...' : '🚀 生成问题'}
                </button>
                <button
                  onClick={handleClear}
                  disabled={isLoading}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  🔄 清空
                </button>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ❌ {error}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：结果展示区 */}
          <div className="space-y-6">
            {/* 澄清任务问题 */}
            {generateClarity && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📝</span>
                  <h2 className="text-xl font-semibold text-blue-900">
                    澄清任务问题
                  </h2>
                </div>
                
                {clarityQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {clarityQuestions.map((question, index) => (
                      <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-blue-700 mt-0.5">
                            {index + 1}.
                          </span>
                          <p className="text-gray-800 flex-1">{question}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    {isLoading ? '生成中...' : '点击"生成问题"查看结果'}
                  </p>
                )}
              </div>
            )}

            {/* 时间规划问题 */}
            {generateTime && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⏱️</span>
                  <h2 className="text-xl font-semibold text-green-900">
                    时间规划问题
                  </h2>
                </div>
                
                {timeQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {timeQuestions.map((question, index) => (
                      <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-green-700 mt-0.5">
                            {index + 1}.
                          </span>
                          <p className="text-gray-800 flex-1">{question}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    {isLoading ? '生成中...' : '点击"生成问题"查看结果'}
                  </p>
                )}
              </div>
            )}

            {/* 优先级问题 */}
            {generatePriority && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🎯</span>
                  <h2 className="text-xl font-semibold text-orange-900">
                    优先级排列问题
                  </h2>
                </div>
                
                {priorityQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {priorityQuestions.map((question, index) => (
                      <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-orange-700 mt-0.5">
                            {index + 1}.
                          </span>
                          <p className="text-gray-800 flex-1">{question}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    {isLoading ? '生成中...' : '点击"生成问题"查看结果'}
                  </p>
                )}
              </div>
            )}

            {/* 空状态提示 */}
            {!generateClarity && !generateTime && !generatePriority && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-400 text-lg">
                  请至少选择一个生成选项
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}





