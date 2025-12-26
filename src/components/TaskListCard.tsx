/**
 * TaskListCard - Agent 任务列表卡片组件
 * 
 * 功能：
 * - 结构化展示任务列表（完成状态、任务名、截止日期、时间估算）
 * - 支持勾选框直接标记完成
 * - 当任务数 > 5 时，默认折叠显示前 5 个，可展开查看全部
 */

import { useState, useCallback } from 'react'
import { format, isToday } from 'date-fns'
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
  // 🆕 父子任务层级关系
  depth?: number              // 任务层级：0=父任务，1=子任务，2=孙任务
  parentId?: string           // 父任务ID
  children?: TaskForDisplay[] // 子任务列表
}

interface TaskListCardProps {
  tasks: TaskForDisplay[]
  totalCount: number
  onTaskToggle?: (taskId: string, noteId: string, newCompletedState: boolean) => void
  onMoveToToday?: (taskId: string, noteId: string, noteDate: string) => void // 🆕 移动到今天的回调
  isRefreshing?: boolean // 🆕 刷新状态
}

export default function TaskListCard({ tasks, totalCount, onTaskToggle, onMoveToToday, isRefreshing }: TaskListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  // 🆕 跟踪每个父任务的子任务展开状态
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  
  // 是否需要分页（超过 5 个任务）
  const shouldPaginate = totalCount > 5
  
  // 显示的任务列表（只显示顶层任务）
  const displayedTasks = shouldPaginate && !isExpanded ? tasks.slice(0, 5) : tasks
  
  // 隐藏的任务数量
  const hiddenCount = totalCount - 5

  const handleToggle = useCallback((task: TaskForDisplay) => {
    if (onTaskToggle) {
      onTaskToggle(task.id, task.noteId, !task.isCompleted)
    }
  }, [onTaskToggle])

  const handleMoveToToday = useCallback((task: TaskForDisplay) => {
    if (onMoveToToday && task.noteDate) {
      onMoveToToday(task.id, task.noteId, task.noteDate)
    }
  }, [onMoveToToday])
  
  // 🆕 切换子任务展开/折叠
  const toggleChildren = useCallback((taskId: string) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }, [])

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-md">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4.5 h-4.5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-semibold text-sm text-white">任务列表</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 🆕 刷新指示器 */}
          {isRefreshing && (
            <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-medium">
            {totalCount}
          </span>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-gray-100">
        {displayedTasks.length > 0 ? (
          displayedTasks.map((task, index) => (
            <TaskItemWithChildren
              key={task.id}
              task={task}
              index={index}
              onToggle={() => handleToggle(task)}
              onMoveToToday={() => handleMoveToToday(task)}
              onToggleChildren={() => toggleChildren(task.id)}
              isChildrenExpanded={expandedParents.has(task.id)}
              onChildToggle={handleToggle}
              onChildMoveToToday={handleMoveToToday}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无任务
          </div>
        )}
      </div>

      {/* 展开/折叠按钮 */}
      {shouldPaginate && (
        <div className="border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 flex items-center justify-center gap-1.5 font-medium group"
          >
            {isExpanded ? (
              <>
                <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>收起</span>
              </>
            ) : (
              <>
                <span>展开剩余 {hiddenCount} 个</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
 * 🆕 带子任务的任务项组件
 */
interface TaskItemWithChildrenProps {
  task: TaskForDisplay
  index: number
  onToggle: () => void
  onMoveToToday: () => void
  onToggleChildren: () => void
  isChildrenExpanded: boolean
  onChildToggle: (task: TaskForDisplay) => void
  onChildMoveToToday: (task: TaskForDisplay) => void
}

function TaskItemWithChildren({ 
  task, 
  index, 
  onToggle, 
  onMoveToToday,
  onToggleChildren,
  isChildrenExpanded,
  onChildToggle,
  onChildMoveToToday
}: TaskItemWithChildrenProps) {
  const hasChildren = task.children && task.children.length > 0
  
  return (
    <div>
      {/* 父任务 */}
      <TaskItem 
        task={task} 
        index={index} 
        onToggle={onToggle} 
        onMoveToToday={onMoveToToday}
        hasChildren={hasChildren}
        onToggleChildren={onToggleChildren}
        isChildrenExpanded={isChildrenExpanded}
      />
      
      {/* 子任务列表（可折叠） */}
      {hasChildren && isChildrenExpanded && (
        <div className="bg-gray-50 border-l-4 border-blue-200">
          {task.children!.map((child, childIndex) => (
            <TaskItem
              key={child.id}
              task={child}
              index={childIndex}
              onToggle={() => onChildToggle(child)}
              onMoveToToday={() => onChildMoveToToday(child)}
              isSubtask={true}
            />
          ))}
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
  onMoveToToday: () => void
  // 🆕 父子任务相关
  hasChildren?: boolean
  onToggleChildren?: () => void
  isChildrenExpanded?: boolean
  isSubtask?: boolean // 是否是子任务
}

function TaskItem({ 
  task, 
  index, 
  onToggle, 
  onMoveToToday,
  hasChildren,
  onToggleChildren,
  isChildrenExpanded,
  isSubtask
}: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  // 格式化截止日期
  const formattedDeadline = task.deadline
    ? format(new Date(task.deadline), 'MM/dd (EEE)', { locale: zhCN })
    : null

  // 格式化时间估算
  const formattedEstimation = task.estimatedMinutes
    ? task.estimatedMinutes >= 60
      ? `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}`
      : `${task.estimatedMinutes}m`
    : null

  // 判断是否逾期
  const isOverdue = task.deadline && !task.isCompleted
    ? new Date(task.deadline) < new Date()
    : false

  // 格式化归属日期
  const formattedNoteDate = task.noteDate
    ? format(new Date(task.noteDate), 'MM/dd (EEE)', { locale: zhCN })
    : null

  // 判断是否是今天的任务
  const isTaskToday = task.noteDate ? isToday(new Date(task.noteDate)) : false

  return (
    <div
      className={`
        transition-all duration-150 hover:bg-gray-50
        ${task.isCompleted ? 'opacity-50' : ''}
        ${isSubtask ? 'bg-gray-50/50' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`px-4 py-3 flex items-start gap-3 ${isSubtask ? 'pl-8' : ''}`}>
        {/* 序号 + 勾选框 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 🆕 子任务展开/折叠按钮（仅父任务显示） */}
          {hasChildren && onToggleChildren ? (
            <button
              onClick={onToggleChildren}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
              title={isChildrenExpanded ? '收起子任务' : '展开子任务'}
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${isChildrenExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="text-xs font-medium text-gray-400 w-5 text-right">
              {isSubtask ? '•' : index + 1}
            </span>
          )}
          <button
            onClick={onToggle}
            className={`
              w-4.5 h-4.5 rounded border-2 transition-all duration-150
              ${task.isCompleted
                ? 'bg-green-500 border-green-500 scale-110'
                : isHovered 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 bg-white'
              }
              flex items-center justify-center
            `}
          >
            {task.isCompleted && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          {/* 任务标题 */}
          <div className={`
            text-sm font-medium leading-tight mb-1.5 flex items-center gap-2
            ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}
          `}>
            <span>{task.title}</span>
            {/* 🆕 子任务数量标签 */}
            {hasChildren && task.children && task.children.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-normal">
                {task.children.length}个子任务
              </span>
            )}
          </div>

          {/* 任务元信息 - 紧凑排列 */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* 归属日期 */}
            {formattedNoteDate && (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formattedNoteDate}
              </span>
            )}
            
            {/* 截止日期 */}
            {formattedDeadline && (
              <>
                {formattedNoteDate && <span className="text-gray-300">·</span>}
                <span className={`inline-flex items-center gap-1 font-medium ${
                  isOverdue ? 'text-red-600' : 'text-blue-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formattedDeadline}
                  {isOverdue && <span className="text-[10px] px-1 bg-red-100 rounded">逾期</span>}
                </span>
              </>
            )}

            {/* 时间估算 */}
            {formattedEstimation && (
              <>
                {(formattedNoteDate || formattedDeadline) && <span className="text-gray-300">·</span>}
                <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {formattedEstimation}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 🆕 移动到今天按钮 - 仅在非今天的任务时显示 */}
        {!isTaskToday && (
          <button
            onClick={onMoveToToday}
            className="flex-shrink-0 p-1.5 rounded-md transition-all duration-150 hover:bg-blue-50 group"
            title="移动到今天"
          >
            <svg 
              className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10l3 3-3 3" 
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}





