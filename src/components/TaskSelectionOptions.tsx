/**
 * 任务选择组件
 * 用于在任务拆解时让用户选择要拆解的任务
 */

'use client'

import React from 'react'
import type { Task } from '@/types'
import TaskTagBadge from './TaskTagBadge'
import { hasTaskTags } from '@/types'

/**
 * 判断任务是否是今天的任务
 */
function isTodayTask(task: Task): boolean {
  if (!task.deadline_datetime) return false
  
  try {
    const taskDate = new Date(task.deadline_datetime)
    const today = new Date()
    
    return (
      taskDate.getFullYear() === today.getFullYear() &&
      taskDate.getMonth() === today.getMonth() &&
      taskDate.getDate() === today.getDate()
    )
  } catch (error) {
    return false
  }
}

interface TaskSelectionOptionsProps {
  tasks: Task[]
  onSelect: (task: Task | null) => void  // null 表示返回上一级
  disabled?: boolean
}

/**
 * 任务选择按钮组件
 */
export default function TaskSelectionOptions({ tasks, onSelect, disabled = false }: TaskSelectionOptionsProps) {
  // 只显示今天的未完成任务
  const availableTasks = tasks.filter(task => !task.is_completed && isTodayTask(task))
  
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
      {availableTasks.length === 0 ? (
        // 没有可拆解的任务
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm">今天暂无待拆解的任务</p>
        </div>
      ) : (
        // 显示所有可拆解的任务
        availableTasks.map((task) => {
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => !disabled && onSelect(task)}
              disabled={disabled}
              className={`
                w-full text-left p-4 rounded-lg border-2 transition-all
                ${disabled 
                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* 任务内容 */}
                <div className="flex-1 min-w-0">
                  {/* 任务标题 */}
                  <h3 className="text-sm font-semibold mb-1 text-blue-900 line-clamp-2">
                    {task.title}
                  </h3>
                  
                  {/* 任务标签 */}
                  {hasTaskTags(task) && (
                    <div className="flex flex-wrap gap-1">
                      {task.tags!.slice(0, 3).map((tag) => (
                        <TaskTagBadge key={tag} tag={tag} size="sm" />
                      ))}
                      {task.tags!.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{task.tags!.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 箭头指示 */}
                {!disabled && (
                  <div className="flex-shrink-0 text-gray-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })
      )}
      
      {/* 返回上一级按钮 */}
      <button
        type="button"
        onClick={() => !disabled && onSelect(null)}
        disabled={disabled}
        className={`
          w-full text-left p-4 rounded-lg border-2 transition-all
          ${disabled 
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
            : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400 hover:shadow-md'
          }
        `}
      >
        <div className="flex items-start gap-3">
          {/* 返回图标 */}
          <div className="flex-shrink-0 text-2xl mt-0.5">
            ↩️
          </div>
          
          {/* 文本内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-1 text-gray-900">
              返回上一级
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              回到操作选择
            </p>
          </div>

          {/* 箭头指示 */}
          {!disabled && (
            <div className="flex-shrink-0 text-gray-400 mt-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

