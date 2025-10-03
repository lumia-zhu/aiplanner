'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface QuickAddTaskProps {
  selectedDate: Date
  onTaskCreate: (taskData: {
    title: string
    description?: string
    priority: 'high' | 'medium' | 'low'
    deadline_time?: string
  }) => Promise<void>
}

export default function QuickAddTask({ selectedDate, onTaskCreate }: QuickAddTaskProps) {
  // 状态管理
  const [isExpanded, setIsExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 引用
  const titleInputRef = useRef<HTMLInputElement>(null)

  // 当选中日期变化时，更新默认截止日期
  useEffect(() => {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    setDeadlineDate(`${year}-${month}-${day}`)
  }, [selectedDate])

  // 处理Enter键快速添加
  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      // Enter键：快速添加
      e.preventDefault()
      if (title.trim()) {
        await handleQuickAdd()
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      // Ctrl+Enter：展开详细模式
      e.preventDefault()
      if (!isExpanded) {
        setIsExpanded(true)
      } else if (title.trim()) {
        await handleDetailedAdd()
      }
    } else if (e.key === 'Escape') {
      // Esc：取消
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'ArrowDown' && !isExpanded) {
      // 方向键下：展开
      e.preventDefault()
      setIsExpanded(true)
    }
  }

  // 快速添加（使用默认值）
  const handleQuickAdd = async () => {
    if (!title.trim()) return

    setIsLoading(true)
    try {
      await onTaskCreate({
        title: title.trim(),
        priority: 'medium',
      })
      
      // 清空输入并聚焦
      setTitle('')
      titleInputRef.current?.focus()
    } catch (error) {
      console.error('快速添加任务失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 详细添加
  const handleDetailedAdd = async () => {
    if (!title.trim()) return

    setIsLoading(true)
    try {
      // 组合日期和时间
      let deadline_time_value = undefined
      if (deadlineDate && deadlineTime) {
        deadline_time_value = `${deadlineDate} ${deadlineTime}:00`
      } else if (deadlineDate) {
        // 如果只有日期没有时间，设置为当天23:59
        deadline_time_value = `${deadlineDate} 23:59:00`
      }

      await onTaskCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        deadline_time: deadline_time_value,
      })
      
      // 重置所有状态
      setTitle('')
      setDescription('')
      setPriority('medium')
      setDeadlineTime('')
      // 保持日期为当前选中日期
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      setDeadlineDate(`${year}-${month}-${day}`)
      setIsExpanded(false)
      titleInputRef.current?.focus()
    } catch (error) {
      console.error('详细添加任务失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 取消
  const handleCancel = () => {
    if (isExpanded) {
      setIsExpanded(false)
      setDescription('')
      setPriority('medium')
      setDeadlineTime('')
      // 重置日期为当前选中日期
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      setDeadlineDate(`${year}-${month}-${day}`)
    } else {
      setTitle('')
    }
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 p-5 mb-6 transition-all duration-300 hover:shadow-md">
      {/* 简洁模式 - 标题输入 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          {/* 输入框内的+号图标 */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入任务标题，按 Enter 快速创建，点击右侧展开添加更多属性..."
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400 transition-all hover:border-gray-300"
          />
        </div>
        
        {/* 展开/折叠按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isLoading}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50 border border-gray-200 hover:border-blue-300"
          title={isExpanded ? "折叠" : "展开详细选项"}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 详细模式 - 展开表单 */}
      {isExpanded && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {/* 任务描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务描述（可选）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加更多细节..."
              disabled={isLoading}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* 优先级选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              优先级
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPriority('high')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  priority === 'high'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                高
              </button>
              <button
                onClick={() => setPriority('medium')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  priority === 'medium'
                    ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                中
              </button>
              <button
                onClick={() => setPriority('low')}
                disabled={isLoading}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  priority === 'low'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                低
              </button>
            </div>
          </div>

          {/* 截止日期和时间 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 截止日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                截止日期
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-gray-900"
              />
            </div>
            
            {/* 截止时间 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                截止时间（可选）
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                disabled={isLoading}
                placeholder="默认23:59"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-gray-900"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDetailedAdd}
              disabled={isLoading || !title.trim()}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isLoading ? '添加中...' : '保存任务'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              取消
            </button>
          </div>

          {/* 快捷键提示 */}
          <div className="flex items-center gap-3 text-xs text-gray-500 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mt-2">
              <kbd className="px-2 py-1 bg-white rounded border border-gray-300 font-mono shadow-sm">Ctrl+Enter</kbd>
              <span className="text-gray-600">保存</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <kbd className="px-2 py-1 bg-white rounded border border-gray-300 font-mono shadow-sm">Esc</kbd>
              <span className="text-gray-600">取消</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

