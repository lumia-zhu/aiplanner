import { useState } from 'react'
import type { Task } from '@/types'
import { isTaskOverdue } from '@/lib/tasks'

interface TaskItemProps {
  task: Task
  onToggleComplete: (taskId: string, completed: boolean) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  isDragging?: boolean
  dragHandleProps?: any
}

export default function TaskItem({ task, onToggleComplete, onEdit, onDelete, isDragging, dragHandleProps }: TaskItemProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const isOverdue = isTaskOverdue(task)
  
  const handleDelete = async () => {
    if (window.confirm('确定要删除这个任务吗？')) {
      setIsDeleting(true)
      await onDelete(task.id)
      setIsDeleting(false)
    }
  }

  const handleToggleComplete = (completed: boolean) => {
    onToggleComplete(task.id, completed)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高'
      case 'medium': return '中'
      case 'low': return '低'
      default: return '未知'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    // 将24小时制时间转换为更友好的显示格式
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const minute = minutes
    
    if (hour === 0) return `午夜 12:${minute}`
    if (hour < 12) return `上午 ${hour}:${minute}`
    if (hour === 12) return `中午 12:${minute}`
    return `下午 ${hour - 12}:${minute}`
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 transition-all duration-200 ${
      isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
    } ${task.completed ? 'opacity-60' : ''} ${
      isDragging ? 'shadow-2xl scale-105 z-50 bg-blue-50 border-blue-300' : 'hover:shadow-md'
    }`}>
      <div className="flex items-start space-x-3">
        {/* 拖拽手柄 */}
        <div className="flex-shrink-0 pt-1">
          <div 
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="4" cy="4" r="1"/>
              <circle cx="4" cy="8" r="1"/>
              <circle cx="4" cy="12" r="1"/>
              <circle cx="8" cy="4" r="1"/>
              <circle cx="8" cy="8" r="1"/>
              <circle cx="8" cy="12" r="1"/>
              <circle cx="12" cy="4" r="1"/>
              <circle cx="12" cy="8" r="1"/>
              <circle cx="12" cy="12" r="1"/>
            </svg>
          </div>
        </div>
        
        {/* 完成状态复选框 */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(e) => {
              e.stopPropagation()
              handleToggleComplete(e.target.checked)
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>

        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-medium ${
              task.completed ? 'line-through text-gray-500' : 'text-gray-900'
            }`}>
              {task.title}
              {isOverdue && !task.completed && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  已过期
                </span>
              )}
            </h3>
            
            {/* 优先级标签 */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {getPriorityText(task.priority)}优先级
            </span>
          </div>

          {task.description && (
            <p className={`mt-1 text-sm ${
              task.completed ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {task.description}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              {task.deadline_time && (
                <span className={isOverdue && !task.completed ? 'text-red-600 font-medium' : ''}>
                  ⏰ {formatTime(task.deadline_time)}
                </span>
              )}
              <span>
                🕐 {formatDate(task.created_at)}
              </span>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(task)
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                编辑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
