import { useState, useEffect } from 'react'
import type { Task } from '@/types'

interface TaskFormProps {
  task?: Task // 如果提供了task，则为编辑模式
  onSubmit: (taskData: {
    title: string
    description?: string
    deadline_time?: string
    priority: 'low' | 'medium' | 'high'
  }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export default function TaskForm({ task, onSubmit, onCancel, isLoading }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [error, setError] = useState('')

  // 如果是编辑模式，填充表单数据
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setDeadlineTime(task.deadline_time || '') // 直接使用时间
      setPriority(task.priority)
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }

    setError('')
    
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline_time: deadlineTime || undefined,
        priority
      })
    } catch (err) {
      setError('保存失败，请重试')
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {task ? '编辑任务' : '创建新任务'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 任务标题 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              任务标题 *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="输入任务标题"
              disabled={isLoading}
            />
          </div>

          {/* 任务描述 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              任务描述
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="输入任务描述（可选）"
              disabled={isLoading}
            />
          </div>

          {/* 截止时间 */}
          <div>
            <label htmlFor="deadlineTime" className="block text-sm font-medium text-gray-700 mb-1">
              截止时间 <span className="text-gray-500">(今天)</span>
            </label>
            <input
              id="deadlineTime"
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="选择时间（可选）"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">留空表示无特定截止时间</p>
          </div>

          {/* 优先级 */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              优先级
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              disabled={isLoading}
            >
              <option value="low">低优先级</option>
              <option value="medium">中优先级</option>
              <option value="high">高优先级</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? '保存中...' : (task ? '保存修改' : '创建任务')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
