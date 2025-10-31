/**
 * 任务卡片组件
 * 用于矩阵视图中显示任务
 * 支持拖拽、完成状态、时间显示
 */

'use client'

import React from 'react'

// ============================================
// 类型定义
// ============================================

interface TaskCardProps {
  task: {
    id: string
    title: string              // 任务标题
    timeRange?: string         // 时间范围（如 "09:00-10:00"）
    deadline?: string          // 截止时间（如 "18:00"）
    isCompleted: boolean       // 是否已完成
  }
  onComplete?: (id: string) => void  // 完成/取消完成回调
  isDragging?: boolean               // 是否正在拖拽
  showCheckbox?: boolean             // 是否显示复选框（默认显示）
}

// ============================================
// 主组件
// ============================================

export default function TaskCard({
  task,
  onComplete,
  isDragging = false,
  showCheckbox = true,
}: TaskCardProps) {
  
  // 处理复选框点击
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onComplete) {
      onComplete(task.id)
    }
  }
  
  // 格式化时间显示
  const timeDisplay = task.timeRange || task.deadline
  
  return (
    <div
      className={`
        bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-200
        hover:shadow-md transition-all duration-200 cursor-move
        ${isDragging ? 'opacity-50 scale-95 shadow-lg' : ''}
        ${task.isCompleted ? 'opacity-60 bg-gray-50' : ''}
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* 复选框 */}
        {showCheckbox && (
          <div className="flex-shrink-0 pt-0.5">
            <input
              type="checkbox"
              checked={task.isCompleted}
              onChange={handleCheckboxClick}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded 
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
                         cursor-pointer transition-colors
                         hover:border-blue-400"
            />
          </div>
        )}
        
        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div
            className={`
              text-sm font-medium leading-snug
              ${task.isCompleted 
                ? 'line-through text-gray-400' 
                : 'text-gray-800'
              }
            `}
          >
            {task.title}
          </div>
          
          {/* 时间信息 */}
          {timeDisplay && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {/* 时钟图标 */}
              <svg
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  task.isCompleted ? 'text-gray-300' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              
              {/* 时间文本 */}
              <span
                className={`text-xs ${
                  task.isCompleted 
                    ? 'text-gray-400 line-through' 
                    : 'text-gray-500'
                }`}
              >
                {timeDisplay}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

