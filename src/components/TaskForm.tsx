import { useState, useEffect } from 'react'
import type { Task } from '@/types'
import TaskTagSelector from './TaskTagSelector'
import { parseTimeEstimate, formatMinutes } from '@/utils/timeEstimation'

export interface TaskFormProps {
  task?: Task // 如果提供了task，则为编辑模式
  defaultDate?: Date // 默认截止日期
  customTags?: string[] // 用户的自定义标签池
  onSubmit: (taskData: {
    title: string
    description?: string
    deadline_time?: string
    priority?: 'low' | 'medium' | 'high' // ⭐ 修改: 优先级可选
    tags?: string[] // ⭐ 新增: 任务标签
    estimated_duration?: number // ⭐ 新增: 预估时长（分钟数）
  }) => Promise<void>
  onCancel: () => void
  onAddCustomTag?: (tag: string) => void // 添加新标签到用户标签池
  isLoading?: boolean
  animationOrigin?: { x: number; y: number } | null
}

export default function TaskForm({ task, defaultDate, customTags = [], onSubmit, onCancel, onAddCustomTag, isLoading, animationOrigin }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>('') // ⭐ 修改: 默认为空
  const [tags, setTags] = useState<string[]>([]) // ⭐ 新增: 标签状态
  const [estimatedDuration, setEstimatedDuration] = useState('') // ⭐ 新增: 时间估算输入
  const [parsedMinutes, setParsedMinutes] = useState<number | null>(null) // ⭐ 解析后的分钟数
  const [error, setError] = useState('')

  // 初始化表单数据
  useEffect(() => {
    if (task) {
      // 编辑模式：使用任务的现有数据
      setTitle(task.title)
      setDescription(task.description || '')
      setTags(task.tags || []) // ⭐ 新增: 初始化标签
      
      if (task.deadline_datetime) {
        const date = new Date(task.deadline_datetime)
        // 设置日期
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        setDeadlineDate(`${year}-${month}-${day}`)
        // 设置时间
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        setDeadlineTime(`${hours}:${minutes}`)
      } else {
        setDeadlineDate('')
        setDeadlineTime('')
      }
      
      setPriority(task.priority || '') // ⭐ 修改: 如果没有优先级则设为空
      
      // ⭐ 新增: 初始化时间估算
      if (task.estimated_duration) {
        const formatted = formatMinutes(task.estimated_duration)
        setEstimatedDuration(formatted)
        setParsedMinutes(task.estimated_duration)
      }
    } else if (defaultDate) {
      // 新建模式：使用默认日期
      const year = defaultDate.getFullYear()
      const month = (defaultDate.getMonth() + 1).toString().padStart(2, '0')
      const day = defaultDate.getDate().toString().padStart(2, '0')
      setDeadlineDate(`${year}-${month}-${day}`)
      setDeadlineTime('') // 时间留空让用户选择
    }
  }, [task, defaultDate])

  // ⭐ 实时解析时间估算输入
  useEffect(() => {
    if (estimatedDuration.trim()) {
      const parsed = parseTimeEstimate(estimatedDuration)
      setParsedMinutes(parsed)
    } else {
      setParsedMinutes(null)
    }
  }, [estimatedDuration])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Please enter task title')
      return
    }

    setError('')
    
    // 组合日期和时间
    let deadlineDateTime = undefined
    if (deadlineDate && deadlineTime) {
      deadlineDateTime = `${deadlineDate}T${deadlineTime}:00`
    } else if (deadlineDate) {
      // 如果只有日期没有时间，设置为当天23:59
      deadlineDateTime = `${deadlineDate}T23:59:00`
    }

    try {
      await onSubmit({
        title: title.trim(),
        // ⭐ 关键修复: 总是提交description字段，即使是空字符串
        // 这样才能清空description
        description: description.trim(),
        deadline_time: deadlineDateTime,
        priority: priority || undefined, // ⭐ 修改: 只在有优先级时提交
        tags: tags.length > 0 ? tags : undefined, // ⭐ 新增: 提交标签
        estimated_duration: parsedMinutes || undefined // ⭐ 新增: 提交时间估算
      })
    } catch (err) {
      setError('Save failed, please try again')
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-modal-scale"
        style={{
          transformOrigin: animationOrigin 
            ? `${((animationOrigin.x / window.innerWidth) * 100)}% ${((animationOrigin.y / window.innerHeight) * 100)}%`
            : 'center center'
        }}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {task ? 'Edit Task' : 'Create New Task'}
        </h2>
        
        {/* 必填项说明 */}
        <p className="text-xs text-gray-500 mb-4">
          <span className="text-red-500">*</span> Required field
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 任务标题 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="Enter task title"
              disabled={isLoading}
            />
          </div>

          {/* 任务描述 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="Enter task description"
              disabled={isLoading}
            />
          </div>

          {/* 截止日期和时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* 日期选择 */}
              <div>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
                  disabled={isLoading}
                />
                {deadlineDate && (
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(deadlineDate + 'T00:00:00').toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </p>
                )}
              </div>
              {/* 时间选择 */}
              <div>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
                  placeholder="Select time (optional)"
                  disabled={isLoading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave blank for no specific deadline</p>
          </div>

          {/* 优先级 */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              disabled={isLoading}
            >
              <option value="">No priority</option>
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
          </div>

          {/* ⭐ 任务标签选择器 */}
          <TaskTagSelector
            selectedTags={tags}
            customTags={customTags}
            onTagsChange={setTags}
            onAddCustomTag={onAddCustomTag}
          />

          {/* ⭐ 时间估算输入 */}
          <div>
            <label htmlFor="estimatedDuration" className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Duration
            </label>
            <input
              type="text"
              id="estimatedDuration"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(e.target.value)}
              placeholder="e.g., 30 minutes, 1.5 hours, 2 days"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              disabled={isLoading}
            />
            {parsedMinutes && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Will be recorded as: {formatMinutes(parsedMinutes)}
              </p>
            )}
            {estimatedDuration && !parsedMinutes && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠️ Invalid format, try "2 hours" or "120 minutes"
              </p>
            )}
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
              {isLoading ? 'Saving...' : (task ? 'Save Changes' : 'Create Task')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
