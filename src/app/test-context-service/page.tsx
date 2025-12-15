'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { 
  createContextInfo, 
  getContextInfoByTaskId,
  updateContextInfo,
  deleteContextInfo 
} from '@/lib/taskContextService'
import type { TaskContextInfo } from '@/types/task-context'

interface Task {
  id: string
  title: string
  user_id: string
}

export default function TestContextServicePage() {
  const [testTaskId, setTestTaskId] = useState('')
  const [content, setContent] = useState('测试上下文信息')
  const [contextList, setContextList] = useState<TaskContextInfo[]>([])
  const [message, setMessage] = useState('')
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  // 自动加载可用任务列表
  useEffect(() => {
    loadAvailableTasks()
  }, [])

  const loadAvailableTasks = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('id, title, user_id')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) {
        console.error('获取任务列表失败:', error)
        setMessage('⚠️ 获取任务列表失败，请确保已登录')
      } else {
        setAvailableTasks(data || [])
        if (data && data.length > 0) {
          setTestTaskId(data[0].id) // 自动选择第一个任务
          setMessage(`✅ 已加载 ${data.length} 个任务（来自 daily_tasks），已自动选择第一个`)
        } else {
          setMessage('⚠️ 暂无任务，请先在笔记面板创建任务')
        }
      }
    } catch (error: any) {
      console.error('加载任务失败:', error)
      setMessage(`❌ 加载失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!testTaskId) {
      setMessage('❌ 请输入任务ID')
      return
    }

    try {
      const result = await createContextInfo({
        task_id: testTaskId,
        content: content,
        source: 'clarity-reflection',
        source_question: '测试问题',
        source_answer: '测试答案'
      })
      setMessage(`✅ 创建成功！ID: ${result.id}`)
      // 自动刷新列表
      handleGetList()
    } catch (error: any) {
      setMessage(`❌ 创建失败: ${error.message}`)
    }
  }

  const handleGetList = async () => {
    if (!testTaskId) {
      setMessage('❌ 请输入任务ID')
      return
    }

    try {
      const list = await getContextInfoByTaskId(testTaskId)
      setContextList(list)
      setMessage(`✅ 获取成功！共 ${list.length} 条`)
    } catch (error: any) {
      setMessage(`❌ 获取失败: ${error.message}`)
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      await updateContextInfo(id, {
        content: content + ' (已更新)'
      })
      setMessage(`✅ 更新成功！`)
      handleGetList()
    } catch (error: any) {
      setMessage(`❌ 更新失败: ${error.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteContextInfo(id)
      setMessage(`✅ 删除成功！`)
      handleGetList()
    } catch (error: any) {
      setMessage(`❌ 删除失败: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">任务上下文信息服务测试</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试输入</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择任务 {loading && '(加载中...)'}
              </label>
              {availableTasks.length > 0 ? (
                <select
                  value={testTaskId}
                  onChange={(e) => setTestTaskId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {availableTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} (ID: {task.id.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  ⚠️ 暂无可用任务。请先访问 
                  <a href="/notes-dashboard" className="text-blue-600 hover:underline ml-1">
                    笔记面板
                  </a> 
                  创建任务，或 
                  <button
                    onClick={loadAvailableTasks}
                    className="text-blue-600 hover:underline ml-1"
                  >
                    点击重新加载
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                任务ID: {testTaskId || '未选择'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上下文信息内容
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4 flex-wrap">
            <button
              onClick={handleCreate}
              disabled={!testTaskId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ➕ 创建上下文信息
            </button>
            <button
              onClick={handleGetList}
              disabled={!testTaskId}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              📋 获取列表
            </button>
            <button
              onClick={loadAvailableTasks}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              🔄 刷新任务列表
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            上下文信息列表 ({contextList.length})
          </h2>

          {contextList.length === 0 ? (
            <p className="text-gray-500">暂无数据，请先创建或获取列表</p>
          ) : (
            <div className="space-y-3">
              {contextList.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-md p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">
                        ID: {item.id}
                      </p>
                      <p className="font-medium mb-2">💡 {item.content}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>来源: {item.source}</p>
                        {item.source_question && (
                          <p>问题: {item.source_question}</p>
                        )}
                        {item.source_answer && (
                          <p>答案: {item.source_answer}</p>
                        )}
                        <p>创建时间: {new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleUpdate(item.id)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                      >
                        ✏️ 更新
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

