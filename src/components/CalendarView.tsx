'use client'

import React, { useState, useMemo } from 'react'
import { Task, DateScope } from '@/types'
import { getStartOfDay, isDateInRange, isSameDay } from '@/utils/dateUtils'
import * as Tooltip from '@radix-ui/react-tooltip'
import TaskTooltip from './TaskTooltip'

interface CalendarViewProps {
  tasks: Task[]
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  dateScope: DateScope  // ⭐ 日期范围
  calendarSelectionMode?: 'idle' | 'selecting-range'  // ⭐ 选择模式
  tempStartDate?: Date | null  // ⭐ 临时起始日期
  viewDate?: Date  // ⭐ 日历视图显示的日期（用于周视图和月视图）
  onViewDateChange?: (date: Date) => void  // ⭐ 新增：当用户切换月份时通知父组件
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  tasks: Task[]
}

export default function CalendarView({ 
  tasks, 
  selectedDate, 
  onDateSelect, 
  dateScope,
  calendarSelectionMode = 'idle',
  tempStartDate = null,
  viewDate,  // ⭐ 新增：从外部控制日历显示的日期
  onViewDateChange  // ⭐ 新增：月份切换回调
}: CalendarViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  // ⭐ 使用传入的 viewDate，如果没有则使用 dateScope.start 或当前日期
  const currentDate = viewDate || dateScope.start || new Date()

  /**
   * 检查日期是否在dateScope范围内
   */
  const isDateInScope = (date: Date): boolean => {
    const dayStart = getStartOfDay(date)
    const scopeStart = getStartOfDay(dateScope.start)
    const scopeEnd = getStartOfDay(dateScope.end)
    return dayStart >= scopeStart && dayStart <= scopeEnd
  }

  // 获取当前周的日期范围（基于 currentDate）
  const getCurrentWeek = () => {
    const startOfWeek = new Date(currentDate)
    const day = currentDate.getDay()
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1) // 周一开始
    startOfWeek.setDate(diff)

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      weekDays.push(date)
    }
    return weekDays
  }

  // 获取当前月的日期范围
  const getCurrentMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // 获取月份第一天
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // 获取第一周的开始日期（周一）
    const startDate = new Date(firstDay)
    const firstDayOfWeek = firstDay.getDay()
    const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    startDate.setDate(firstDay.getDate() - daysToSubtract)
    
    // 生成6周的日期
    const monthDays: CalendarDay[] = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      
      const isCurrentMonth = date.getMonth() === month
      const isToday = date.toDateString() === new Date().toDateString()
      
      // 获取该日期的任务
      const dayTasks = tasks.filter(task => {
        if (!task.deadline_datetime) return false
        const taskDate = new Date(task.deadline_datetime)
        return taskDate.toDateString() === date.toDateString()
      })
      
      monthDays.push({
        date,
        isCurrentMonth,
        isToday,
        tasks: dayTasks
      })
    }
    
    return monthDays
  }

  const weekDays = getCurrentWeek()
  const monthDays = getCurrentMonth()

  // 获取指定日期的任务
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.deadline_datetime) return false
      const taskDate = new Date(task.deadline_datetime)
      return taskDate.toDateString() === date.toDateString()
    })
  }

  // 月份导航
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1)
    } else {
      newDate.setMonth(currentDate.getMonth() + 1)
    }
    // ⭐ 通知父组件月份变化
    onViewDateChange?.(newDate)
  }

  const today = new Date()
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* 头部 - 展开/收起控制 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {isExpanded 
              ? `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
              : 'This Week'
            }
          </h3>
          {isExpanded && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <span>{isExpanded ? 'Collapse' : 'Expand Month View'}</span>
          <svg 
            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 日历内容 */}
      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-none' : 'max-h-24'} overflow-hidden`}>
        {!isExpanded ? (
          /* 周视图 */
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((date, index) => {
                const dayTasks = getTasksForDate(date)
                const isToday = date.toDateString() === today.toDateString()
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()
                const inScope = isDateInScope(date)  // ⭐ 检查是否在范围内
                
                return (
                  <Tooltip.Root key={index}>
                    <Tooltip.Trigger asChild>
                      <div
                        className={`text-center p-2 cursor-pointer transition-all rounded-lg ${
                          isToday 
                            ? 'bg-gray-200 text-gray-900 font-semibold'  // ⭐ 今天：灰色填充 + 加粗
                            : inScope 
                              ? `bg-blue-50 text-gray-700 hover:bg-blue-100`  // ⭐ 范围内：淡蓝色背景（包括临时起始点）
                              : isSelected 
                                ? 'bg-gray-200 text-gray-900' 
                                : 'bg-gray-100 text-gray-400 opacity-60'  // ⭐ 非范围内浅灰遮罩
                        }`}
                        onClick={() => onDateSelect?.(date)}
                      >
                        <div className="text-xs text-gray-500 mb-1">
                          {weekdays[index]}
                        </div>
                        <div className="text-sm font-medium">
                          {date.getDate()}
                        </div>
                        {dayTasks.length > 0 && (
                          <div className="flex justify-center mt-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              dayTasks.some(t => !t.completed) ? 'bg-red-400' : 'bg-green-400'
                            }`} />
                          </div>
                        )}
                      </div>
                    </Tooltip.Trigger>
                    {dayTasks.length > 0 && (
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="bottom"
                          align="center"
                          className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in-0 zoom-in-95"
                          sideOffset={5}
                        >
                          <TaskTooltip tasks={dayTasks} date={date} />
                          <Tooltip.Arrow className="fill-white" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                )
              })}
            </div>
          </div>
        ) : (
          /* 月视图 */
          <div className="p-4">
            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekdays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* 月历网格 */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, index) => {
                const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString()
                const inScope = isDateInScope(day.date)  // ⭐ 检查是否在范围内
                
                // 排序任务（未完成优先）
                const sortedTasks = [...day.tasks].sort((a, b) => {
                  if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1
                  }
                  return 0
                })
                
                return (
                  <Tooltip.Root key={index}>
                    <Tooltip.Trigger asChild>
                      <div
                        className={`relative h-24 p-1.5 cursor-pointer transition-all flex flex-col rounded ${
                          day.isToday 
                            ? 'bg-gray-200'  // ⭐ 今天：灰色填充
                            : inScope 
                              ? 'bg-blue-50 hover:bg-blue-100'  // ⭐ 范围内：淡蓝色背景（包括临时起始点）
                              : isSelected 
                                ? 'bg-gray-200' 
                                : 'bg-gray-100 opacity-60'  // ⭐ 非范围内浅灰遮罩
                        } ${
                          !day.isCurrentMonth ? 'text-gray-300' : 
                          inScope || day.isToday ? 'text-gray-700' : 'text-gray-400'  // ⭐ 非范围内文字颜色变浅
                        }`}
                        onClick={() => onDateSelect?.(day.date)}
                      >
                        {/* 日期 + 任务数徽章 */}
                        <div className="flex justify-between items-start mb-0.5">
                          <span className={`text-sm ${day.isToday ? 'font-semibold' : 'font-medium'}`}>
                            {day.date.getDate()}
                          </span>
                          {day.tasks.length > 3 && (
                            <span className="text-xs bg-gray-300 text-gray-700 px-1 rounded">
                              +{day.tasks.length - 3}
                            </span>
                          )}
                        </div>
                      
                        {/* 任务列表（显示前3个） */}
                        {sortedTasks.length > 0 && (
                          <div className="flex-1 space-y-0.5 overflow-hidden">
                            {sortedTasks.slice(0, 3).map((task, taskIndex) => (
                              <div
                                key={taskIndex}
                                className={`text-xs truncate flex items-center gap-1 ${
                                  task.completed ? 'text-gray-400' : 'text-gray-700'
                                }`}
                              >
                                <span className="flex-shrink-0">
                                  {task.completed ? '✓' : '○'}
                                </span>
                                <span className={`truncate ${task.completed ? 'line-through' : ''}`}>
                                  {task.title}
                                  {/* 如果是第3个任务且还有更多，显示省略号 */}
                                  {taskIndex === 2 && sortedTasks.length > 3 && (
                                    <span className="ml-1 text-gray-400">...</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Tooltip.Trigger>
                    {day.tasks.length > 0 && (
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="top"
                          align="center"
                          className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in-0 zoom-in-95"
                          sideOffset={5}
                        >
                          <TaskTooltip tasks={day.tasks} date={day.date} />
                          <Tooltip.Arrow className="fill-white" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
    </Tooltip.Provider>
  )
}
