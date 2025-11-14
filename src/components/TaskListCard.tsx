/**
 * TaskListCard - Agent 任务列表卡片组件
 * 
 * 功能：
 * - 结构化展示任务列表（完成状态、任务名、截止日期、时间估算）
 * - 支持勾选框直接标记完成
 * - 当任务数 > 5 时，默认折叠显示前 5 个，可展开查看全部
 */

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export interface TaskForDisplay {
  id: string
  noteId: string
  title: string
  isCompleted: boolean
  deadline?: string
  estimatedMinutes?: number
  hasDeadline?: boolean
  hasEstimation?: boolean
  priority?: 'high' | 'medium' | 'low'
  noteDate?: string
}

interface TaskListCardProps {
  tasks: TaskForDisplay[]
  totalCount: number
  onTaskToggle?: (taskId: string, noteId: string, newCompletedState: boolean) => void
}

export default function TaskListCard({ tasks, totalCount, onTaskToggle }: TaskListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 是否需要分页（超过 5 个任务）
  const shouldPaginate = totalCount > 5
  
  // 显示的任务列表
  const displayedTasks = shouldPaginate && !isExpanded ? tasks.slice(0, 5) : tasks
  
  // 隐藏的任务数量
  const hiddenCount = totalCount - 5

  const handleToggle = useCallback((task: TaskForDisplay) => {
    if (onTaskToggle) {
      onTaskToggle(task.id, task.noteId, !task.isCompleted)
    }
  }, [onTaskToggle])

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 overflow-hidden shadow-sm">
      {/* 头部 */}
      <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-medium text-sm">任务列表</span>
        </div>
        <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
          共 {totalCount} 个
        </span>
      </div>

      {/* 任务列表 */}
      <div className="p-3 space-y-2">
        {displayedTasks.length > 0 ? (
          displayedTasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              onToggle={() => handleToggle(task)}
            />
          ))
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            暂无任务
          </div>
        )}
      </div>

      {/* 展开/折叠按钮 */}
      {shouldPaginate && (
        <div className="border-t border-blue-200 bg-blue-50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {isExpanded ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>收起</span>
              </>
            ) : (
              <>
                <span>展开查看所有 {hiddenCount} 个任务</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 单个任务项组件
 */
interface TaskItemProps {
  task: TaskForDisplay
  index: number
  onToggle: () => void
}

function TaskItem({ task, index, onToggle }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  // 格式化截止日期
  const formattedDeadline = task.deadline
    ? format(new Date(task.deadline), 'MM月dd日 (EEE)', { locale: zhCN })
    : null

  // 格式化时间估算
  const formattedEstimation = task.estimatedMinutes
    ? task.estimatedMinutes >= 60
      ? `${Math.floor(task.estimatedMinutes / 60)}小时${task.estimatedMinutes % 60 > 0 ? ` ${task.estimatedMinutes % 60}分钟` : ''}`
      : `${task.estimatedMinutes}分钟`
    : null

  // 判断是否逾期
  const isOverdue = task.deadline && !task.isCompleted
    ? new Date(task.deadline) < new Date()
    : false

  return (
    <div
      className={`
        bg-white rounded-lg border transition-all duration-200
        ${isHovered ? 'border-blue-300 shadow-md scale-[1.02]' : 'border-gray-200 shadow-sm'}
        ${task.isCompleted ? 'opacity-60' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-3 flex items-start gap-3">
        {/* 勾选框 */}
        <button
          onClick={onToggle}
          className={`
            flex-shrink-0 w-5 h-5 rounded border-2 transition-all duration-200 mt-0.5
            ${task.isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-blue-500'
            }
            flex items-center justify-center
          `}
        >
          {task.isCompleted && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          {/* 任务标题 */}
          <div className={`
            text-sm font-medium leading-snug mb-1
            ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}
          `}>
            {task.title}
          </div>

          {/* 任务元信息 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 🆕 归属日期（任务所在笔记的日期） */}
            {task.noteDate && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{format(new Date(task.noteDate), 'MM月dd日 (EEE)', { locale: zhCN })}</span>
              </div>
            )}
            
            {/* 截止日期 */}
            {formattedDeadline && (
              <div className={`
                flex items-center gap-1 px-2 py-0.5 rounded-full
                ${isOverdue
                  ? 'bg-red-100 text-red-600'
                  : 'bg-blue-100 text-blue-600'
                }
              `}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>截止: {formattedDeadline}</span>
                {isOverdue && (
                  <span className="font-semibold">已逾期</span>
                )}
              </div>
            )}

            {/* 时间估算 */}
            {formattedEstimation && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formattedEstimation}</span>
              </div>
            )}
          </div>
        </div>

        {/* 序号标识 */}
        <div className="flex-shrink-0 text-xs text-gray-400 font-medium mt-0.5">
          #{index + 1}
        </div>
      </div>
    </div>
  )
}

