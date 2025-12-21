'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import AddContextInfoModal from '@/components/AddContextInfoModal'
import type { QuestionAnswerPair } from '@/types/task-context'

interface Task {
  id: string
  title: string
}

export default function TestContextModalPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [message, setMessage] = useState('')

  // 预设的问答示例
  const exampleQA: QuestionAnswerPair = {
    question: '这个原型开发是针对什么产品或项目的？',
    answer: 'ADHD任务管理是一个研究项目，目前已经有一些需求文档了，我们希望通过这个原型来验证一些想法'
  }

  // 加载任务列表
  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('加载任务失败:', error)
        setMessage('⚠️ 加载任务失败')
      } else if (data && data.length > 0) {
        setAvailableTasks(data)
        setSelectedTaskId(data[0].id)
        setMessage(`✅ 已加载 ${data.length} 个任务`)
      } else {
        setMessage('⚠️ 暂无任务，请先在笔记面板创建任务')
      }
    } catch (error) {
      console.error('加载任务失败:', error)
      setMessage('❌ 加载任务失败')
    }
  }

  const handleOpenModal = () => {
    if (availableTasks.length === 0) {
      setMessage('❌ 请先加载任务')
      return
    }
    setIsModalOpen(true)
  }

  const handleModalSuccess = () => {
    setMessage('✅ 上下文信息添加成功！')
    setTimeout(() => {
      setMessage('')
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">添加上下文信息弹窗测试</h1>
        <p className="text-gray-600 mb-8">测试预览弹窗的完整功能</p>

        {/* 状态显示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 当前状态</h2>
          
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700">可用任务数：</span>
              <span className="ml-2 text-sm text-gray-900">{availableTasks.length} 个</span>
            </div>

            {availableTasks.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-700">当前选中任务：</span>
                <div className="mt-1 text-sm text-gray-900">
                  {availableTasks.find(t => t.id === selectedTaskId)?.title || '未选择'}
                </div>
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-gray-700">测试问答：</span>
              <div className="mt-1 bg-gray-50 p-3 rounded text-sm">
                <p className="text-gray-600">Q: {exampleQA.question}</p>
                <p className="text-gray-600 mt-1">A: {exampleQA.answer}</p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-800'
                : message.startsWith('⚠️')
                ? 'bg-yellow-50 text-yellow-800'
                : 'bg-red-50 text-red-800'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">🎬 操作</h2>

          <div className="flex gap-3">
            <button
              onClick={loadTasks}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              🔄 重新加载任务
            </button>

            <button
              onClick={handleOpenModal}
              disabled={availableTasks.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ➕ 打开添加弹窗
            </button>
          </div>

          <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800">
            <p className="font-medium mb-2">💡 测试步骤：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>确保已加载任务（如果没有，先去笔记面板创建）</li>
              <li>点击"打开添加弹窗"按钮</li>
              <li>观察 LLM 自动提取关键信息的过程</li>
              <li>可以编辑提取的内容</li>
              <li>选择目标任务</li>
              <li>点击"确认添加"</li>
              <li>检查是否成功添加</li>
            </ol>
          </div>
        </div>

        {/* 任务列表 */}
        {availableTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">📋 可用任务列表</h2>
            <div className="space-y-2">
              {availableTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    task.id === selectedTaskId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500 mt-1">ID: {task.id.substring(0, 8)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 弹窗组件 */}
      <AddContextInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        questionAnswer={exampleQA}
        defaultTaskId={selectedTaskId}
        availableTasks={availableTasks}
        source="clarity-reflection"
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}









