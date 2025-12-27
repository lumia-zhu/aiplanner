/**
 * 任务选择组件
 * 用于在任务拆解时让用户选择要拆解的任务
 */

'use client'

import React from 'react'
import type { Task } from '@/types'
import TaskTagBadge from './TaskTagBadge'
import { hasTaskTags } from '@/types'

interface TaskSelectionOptionsProps {
  tasks: Task[]
  onSelect: (task: Task | null) => void  // null 表示返回上一级
  disabled?: boolean
}

/**
 * 任务选择按钮组件
 */
export default function TaskSelectionOptions({ tasks, onSelect, disabled = false }: TaskSelectionOptionsProps) {
  // ⭐ 显示所有任务（包括已完成的），让用户看到完整情况
  const allTasks = tasks
  const hasAnyTask = allTasks.length > 0
  
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
      {!hasAnyTask ? (
        // 没有任何任务
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm">当前范围内暂无任务</p>
        </div>
      ) : (
        // 显示所有任务（包括已完成的）
        allTasks.map((task) => {
          const isCompleted = task.completed
          // 🆕 获取任务层级（0=父任务，1=子任务，2=孙任务，3=曾孙任务）
          const depth = task.level ?? 0
          // 🆕 根据层级计算左侧缩进（每级 16px）
          const indentStyle = depth > 0 ? { marginLeft: `${depth * 16}px` } : {}
          
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => !disabled && onSelect(task)}
              disabled={disabled}
              style={indentStyle}
              className={`
                w-full text-left p-3 rounded-lg border-2 transition-all
                ${disabled 
                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                  : isCompleted
                    ? 'bg-gray-50 border-gray-300 opacity-60'  // ⭐ 已完成：灰色背景，降低透明度
                    : depth === 0
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
                      : depth === 1
                        ? 'bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border-blue-100 hover:border-blue-300 hover:shadow-md'
                        : 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-blue-100/80 hover:border-blue-200 hover:shadow-sm'
                }
              `}
            >
              <div className="flex items-start gap-2.5">
                {/* ⭐ 已完成图标 */}
                {isCompleted && (
                  <div className="flex-shrink-0 text-green-500 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                
                {/* 任务内容 */}
                <div className="flex-1 min-w-0">
                  {/* 任务标题 */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-semibold line-clamp-2 ${
                      isCompleted 
                        ? 'line-through text-gray-500'  // ⭐ 已完成：删除线 + 灰色
                        : depth === 0 
                          ? 'text-blue-900'
                          : 'text-blue-800'
                    }`}>
                      {task.title}
                    </h3>
                    {/* 🆕 层级标识 */}
                    {depth > 0 && (
                      <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                        depth === 1 
                          ? 'text-blue-600 bg-blue-100' 
                          : depth === 2
                            ? 'text-indigo-600 bg-indigo-100'
                            : 'text-purple-600 bg-purple-100'
                      }`}>
                        {depth === 1 ? '子任务' : depth === 2 ? '孙任务' : '曾孙'}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                        已完成
                      </span>
                    )}
                  </div>
                  
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
                  <div className="flex-shrink-0 text-gray-400 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          w-full text-left p-3 rounded-lg border-2 transition-all
          ${disabled 
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
            : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400 hover:shadow-md'
          }
        `}
      >
        <div className="flex items-start gap-2.5">
          {/* 返回图标 */}
          <div className="flex-shrink-0 text-xl mt-0.5">
            ↩️
          </div>
          
          {/* 文本内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-0.5 text-gray-900">
              返回上一级
            </h3>
            <p className="text-xs text-gray-600 leading-snug">
              回到操作选择
            </p>
          </div>

          {/* 箭头指示 */}
          {!disabled && (
            <div className="flex-shrink-0 text-gray-400 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

