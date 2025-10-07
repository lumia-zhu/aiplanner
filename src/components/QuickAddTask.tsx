'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useToast, ToastContainer } from './Toast'

interface QuickAddTaskProps {
  selectedDate: Date
  onTaskCreate: (taskData: {
    title: string
    description?: string
    priority: 'high' | 'medium' | 'low'
    deadline_time?: string
  }) => Promise<{ id?: string } | void>
  onBatchUndo?: (taskIds: string[]) => Promise<void>
}

export default function QuickAddTask({ selectedDate, onTaskCreate, onBatchUndo }: QuickAddTaskProps) {
  // 状态管理
  const [isExpanded, setIsExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // 批量任务检测状态
  const [batchPreview, setBatchPreview] = useState<{
    isMultiple: boolean
    tasks: string[]
    count: number
  } | null>(null)
  
  // 最近批量创建的任务记录（用于撤销）
  const [lastBatchCreated, setLastBatchCreated] = useState<{
    taskIds: string[]
    count: number
  } | null>(null)

  // Toast 提示
  const { toasts, dismissToast, success, error, info } = useToast()

  // 引用
  const titleInputRef = useRef<HTMLInputElement>(null)

  // 分隔符检测函数
  const detectMultipleTasks = (input: string) => {
    // 同时支持中文分号和英文分号
    const separators = /[;；]/g
    const tasks = input.split(separators)
      .map(t => t.trim())
      .filter(t => t.length > 0)
    
    return {
      isMultiple: tasks.length > 1,
      tasks: tasks,
      count: tasks.length
    }
  }

  // 当选中日期变化时，更新默认截止日期
  useEffect(() => {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    setDeadlineDate(`${year}-${month}-${day}`)
  }, [selectedDate])
  
  // 监听输入框内容变化，实时检测批量任务
  useEffect(() => {
    if (title.trim()) {
      const detection = detectMultipleTasks(title)
      if (detection.isMultiple) {
        setBatchPreview(detection)
      } else {
        setBatchPreview(null)
      }
    } else {
      setBatchPreview(null)
    }
  }, [title])

  // 处理Enter键快速添加
  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      // Enter键：快速添加或批量添加
      e.preventDefault()
      if (title.trim()) {
        // 检查是否为批量任务
        if (batchPreview && batchPreview.isMultiple) {
          // 批量创建
          await handleBatchCreate(batchPreview.tasks)
        } else {
          // 单任务创建
          await handleQuickAdd()
        }
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

  // 批量撤销
  const handleBatchUndo = async () => {
    if (!lastBatchCreated || !onBatchUndo) return

    const { taskIds, count } = lastBatchCreated
    
    try {
      await onBatchUndo(taskIds)
      setLastBatchCreated(null)
      info(`↩️ 已撤销 ${count} 个任务`)
    } catch (err) {
      console.error('撤销失败:', err)
      error('❌ 撤销失败，请重试')
    }
  }

  // 批量创建任务
  const handleBatchCreate = async (titles: string[]) => {
    if (titles.length === 0) return

    setIsLoading(true)
    try {
      // 逐个创建任务并收集任务ID
      const results = await Promise.all(
        titles.map(taskTitle => 
          onTaskCreate({
            title: taskTitle,
            priority: 'medium',
          })
        )
      )
      
      // 提取任务ID（过滤掉undefined）
      const taskIds = results
        .map(result => result?.id)
        .filter((id): id is string => id !== undefined)
      
      // 清空输入并聚焦
      setTitle('')
      setBatchPreview(null)
      titleInputRef.current?.focus()
      
      // 保存批量创建的任务记录
      if (taskIds.length > 0 && onBatchUndo) {
        setLastBatchCreated({
          taskIds,
          count: taskIds.length
        })
        
        // 显示带撤销按钮的成功提示
        success(`✨ 成功创建 ${taskIds.length} 个任务！`)
      } else {
        // 如果没有撤销功能，显示普通成功提示
        success(`✨ 成功创建 ${titles.length} 个任务！`)
      }
      
      // 返回成功创建的任务数量
      return titles.length
    } catch (err) {
      console.error('批量创建任务失败:', err)
      error('❌ 批量创建任务失败，请重试')
      throw err
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
            placeholder="输入任务，用 ; 或 ； 分隔可批量添加，Enter 快速创建"
            disabled={isLoading}
            className={`w-full pl-12 pr-4 py-2.5 border-2 rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400 transition-all ${
              batchPreview && batchPreview.isMultiple
                ? 'border-purple-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-purple-50/30'
                : 'border-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 hover:border-gray-300'
            }`}
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

      {/* 批量任务预览提示 */}
      {batchPreview && batchPreview.isMultiple && !isExpanded && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-blue-800">
              检测到 {batchPreview.count} 个任务，按 Enter 将批量创建
            </span>
          </div>
          <div className="ml-7 space-y-1">
            <div className="text-xs font-medium text-blue-700 mb-1.5">📝 任务预览：</div>
            {batchPreview.tasks.map((task, index) => (
              <div key={index} className="text-sm text-blue-900 flex items-start gap-2">
                <span className="text-blue-400 font-medium flex-shrink-0">{index + 1}.</span>
                <span className="break-all">{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 批量撤销按钮 */}
      {lastBatchCreated && onBatchUndo && !isExpanded && (
        <div className="mt-2 animate-fade-in">
          <button
            onClick={handleBatchUndo}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>撤销刚才创建的 {lastBatchCreated.count} 个任务</span>
          </button>
        </div>
      )}

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

      {/* Toast 通知容器 */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

