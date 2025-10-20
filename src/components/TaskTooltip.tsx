/**
 * 任务浮动提示卡片组件
 * 用于在日历中悬停时显示当天的所有任务
 */

'use client'

import React from 'react'
import type { Task } from '@/types'

interface TaskTooltipProps {
  tasks: Task[]
  date: Date
}

/**
 * 任务排序函数
 * 排序规则：未完成 > 已完成，高优先级 > 低优先级，有时间 > 无时间
 */
function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. 未完成的任务优先
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    
    // 2. 按优先级排序（如果有标签的话）
    const getPriorityValue = (task: Task): number => {
      if (!task.tags || task.tags.length === 0) return 99
      
      if (task.tags.some(tag => tag.includes('高优先级') || tag.includes('紧急'))) return 0
      if (task.tags.some(tag => tag.includes('中优先级'))) return 1
      if (task.tags.some(tag => tag.includes('低优先级'))) return 2
      
      return 99
    }
    
    const aPriority = getPriorityValue(a)
    const bPriority = getPriorityValue(b)
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // 3. 有截止时间的优先
    if (a.deadline_datetime && !b.deadline_datetime) return -1
    if (!a.deadline_datetime && b.deadline_datetime) return 1
    
    return 0
  })
}

/**
 * 截断任务标题
 */
function truncateTitle(title: string, maxLength: number = 25): string {
  if (title.length <= maxLength) return title
  return title.slice(0, maxLength) + '...'
}

export default function TaskTooltip({ tasks, date }: TaskTooltipProps) {
  // 如果没有任务，不显示
  if (tasks.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        这天还没有任务
      </div>
    )
  }

  // 排序任务
  const sortedTasks = sortTasksByPriority(tasks)
  
  // 最多显示 20 个任务
  const displayTasks = sortedTasks.slice(0, 20)
  const hasMore = sortedTasks.length > 20

  // 格式化日期
  const month = date.getMonth() + 1
  const day = date.getDate()

  return (
    <div className="min-w-[200px] max-w-xs">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-900">
          {month}月{day}日
        </span>
        <span className="text-xs text-gray-500">
          {tasks.length} 个任务
        </span>
      </div>

      {/* 任务列表 */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {displayTasks.map((task, index) => (
          <div
            key={task.id || index}
            className={`flex items-start gap-2 text-sm ${
              task.completed ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            {/* 状态图标 */}
            <span className="flex-shrink-0 mt-0.5">
              {task.completed ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-gray-400">○</span>
              )}
            </span>
            
            {/* 任务标题 */}
            <span className={`flex-1 leading-relaxed ${
              task.completed ? 'line-through' : ''
            }`}>
              {truncateTitle(task.title, 30)}
            </span>
          </div>
        ))}
      </div>

      {/* 更多提示 */}
      {hasMore && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 text-center">
          还有 {sortedTasks.length - 20} 个任务...
        </div>
      )}
    </div>
  )
}


