/**
 * 任务卡片组件
 * 用于矩阵视图中显示任务
 * 支持拖拽、完成状态
 */

'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ============================================
// 类型定义
// ============================================

interface TaskCardProps {
  task: {
    id: string
    title: string              // 任务标题
    isCompleted: boolean       // 是否已完成
  }
  onComplete?: (id: string) => void  // 完成/取消完成回调
  showCheckbox?: boolean             // 是否显示复选框（默认显示）
  isDraggable?: boolean              // 是否可拖拽（默认可拖拽）
}

// ============================================
// 主组件
// ============================================

export default function TaskCard({
  task,
  onComplete,
  showCheckbox = true,
  isDraggable = true,
}: TaskCardProps) {
  
  // 拖拽功能
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    disabled: !isDraggable, // 如果不可拖拽，禁用拖拽功能
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  
  // 处理复选框点击
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onComplete) {
      onComplete(task.id)
    }
  }
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-200
        hover:shadow-md transition-all duration-200
        ${isDraggable ? 'cursor-move' : 'cursor-default'}
        ${isDragging ? 'opacity-50 scale-95 shadow-lg z-50' : ''}
        ${task.isCompleted ? 'opacity-60 bg-gray-50' : ''}
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* 复选框 */}
        {showCheckbox && (
          <div 
            className="flex-shrink-0 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={task.isCompleted}
              onChange={handleCheckboxClick}
              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded 
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
                         cursor-pointer transition-colors
                         hover:border-blue-400"
            />
          </div>
        )}
        
        {/* 任务标题 */}
        <div className="flex-1 min-w-0">
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
        </div>
      </div>
    </div>
  )
}


