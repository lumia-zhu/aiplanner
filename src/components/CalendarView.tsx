'use client'

import React, { useState, useMemo } from 'react'
import { Task } from '@/lib/types'

interface CalendarViewProps {
  tasks: Task[]
  onDateSelect?: (date: Date) => void
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  tasks: Task[]
}

export default function CalendarView({ tasks, onDateSelect }: CalendarViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  // 获取当前周的日期范围
  const getCurrentWeek = () => {
    const today = new Date()
    const startOfWeek = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // 周一开始
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
        if (!task.deadline_time) return false
        const taskDate = new Date(task.deadline_time)
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
      if (!task.deadline_time) return false
      const taskDate = new Date(task.deadline_time)
      return taskDate.toDateString() === date.toDateString()
    })
  }

  // 月份导航
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const today = new Date()
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* 头部 - 展开/收起控制 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {isExpanded 
              ? `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
              : '本周日程'
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
          <span>{isExpanded ? '收起' : '展开月视图'}</span>
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
                
                return (
                  <div
                    key={index}
                    className={`text-center p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 text-gray-700 ${
                      isToday ? 'bg-blue-100' : ''
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
              {monthDays.map((day, index) => (
                <div
                  key={index}
                  className={`relative h-12 p-1 text-center cursor-pointer transition-colors rounded ${
                    day.isToday ? 'bg-blue-100' : 'hover:bg-gray-50'
                  } ${
                    !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  onClick={() => onDateSelect?.(day.date)}
                >
                  <div className="text-sm pt-1">
                    {day.date.getDate()}
                  </div>
                  
                  {/* 任务指示器 */}
                  {day.tasks.length > 0 && (
                    <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
                      {day.tasks.length <= 3 ? (
                        <div className="flex space-x-0.5">
                          {day.tasks.slice(0, 3).map((task, taskIndex) => (
                            <div
                              key={taskIndex}
                              className={`w-1.5 h-1.5 rounded-full ${
                                task.completed ? 'bg-green-400' : 
                                task.priority === 'high' ? 'bg-red-400' :
                                task.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {day.tasks.length}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
