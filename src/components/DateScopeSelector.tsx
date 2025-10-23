'use client'

import React, { useState, useEffect } from 'react'
import type { DateScope, DateScopePreset } from '@/types'

interface DateScopeSelectorProps {
  scope: DateScope
  onScopeChange: (scope: DateScope) => void
}

/**
 * 日期范围选择器组件
 * 提供起止日期输入框 + 快捷预设按钮 + 逾期任务勾选
 */
export default function DateScopeSelector({ scope, onScopeChange }: DateScopeSelectorProps) {
  // 本地状态：用于日期输入框的字符串值
  const [startDateStr, setStartDateStr] = useState('')
  const [endDateStr, setEndDateStr] = useState('')
  const [dateError, setDateError] = useState('')

  // 预设按钮配置
  const presetOptions: Array<{ id: DateScopePreset; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: '3days', label: '3 days' },
    { id: '7days', label: '7 days' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ]

  // 初始化：将 Date 对象转换为字符串（YYYY-MM-DD）
  useEffect(() => {
    setStartDateStr(formatDateToInputString(scope.start))
    setEndDateStr(formatDateToInputString(scope.end))
  }, [scope.start, scope.end])

  /**
   * 格式化 Date 为 input[type="date"] 需要的字符串格式
   */
  function formatDateToInputString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 解析 input[type="date"] 的字符串为 Date 对象（零点）
   */
  function parseInputStringToDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return null
    return date
  }

  /**
   * 获取日期的零点时间
   */
  function getStartOfDay(date: Date): Date {
    const newDate = new Date(date)
    newDate.setHours(0, 0, 0, 0)
    return newDate
  }

  /**
   * 获取日期的结束时间（23:59:59.999）
   */
  function getEndOfDay(date: Date): Date {
    const newDate = new Date(date)
    newDate.setHours(23, 59, 59, 999)
    return newDate
  }

  /**
   * 根据预设计算起止日期
   */
  function calculatePresetDates(preset: DateScopePreset): { start: Date; end: Date } {
    const now = new Date()
    const today = getStartOfDay(now)

    switch (preset) {
      case 'today':
        return {
          start: today,
          end: getEndOfDay(today)
        }

      case '3days': {
        const end = new Date(today)
        end.setDate(today.getDate() + 2) // 今天 + 2天 = 3天
        return {
          start: today,
          end: getEndOfDay(end)
        }
      }

      case '7days': {
        const end = new Date(today)
        end.setDate(today.getDate() + 6) // 今天 + 6天 = 7天
        return {
          start: today,
          end: getEndOfDay(end)
        }
      }

      case 'week': {
        // 本周一至周日
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 周日算作-6
        const monday = new Date(today)
        monday.setDate(today.getDate() + mondayOffset)
        
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        
        return {
          start: getStartOfDay(monday),
          end: getEndOfDay(sunday)
        }
      }

      case 'month': {
        // 本月1号至月末
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        
        return {
          start: getStartOfDay(firstDay),
          end: getEndOfDay(lastDay)
        }
      }

      case 'custom':
      default:
        return { start: scope.start, end: scope.end }
    }
  }

  /**
   * 处理预设按钮点击
   */
  const handlePresetClick = (preset: DateScopePreset) => {
    const { start, end } = calculatePresetDates(preset)
    
    onScopeChange({
      ...scope,
      start,
      end,
      preset
    })
    
    setDateError('') // 清除错误
  }

  /**
   * 处理起始日期变化
   */
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartStr = e.target.value
    setStartDateStr(newStartStr)
    
    const newStart = parseInputStringToDate(newStartStr)
    if (!newStart) return
    
    // 检查是否结束日期早于开始日期
    const currentEnd = parseInputStringToDate(endDateStr)
    if (currentEnd && newStart > currentEnd) {
      setDateError('End date cannot be earlier than start date')
      return
    }
    
    setDateError('')
    
    // 更新为自定义范围
    onScopeChange({
      ...scope,
      start: getStartOfDay(newStart),
      end: currentEnd ? getEndOfDay(currentEnd) : scope.end,
      preset: 'custom'
    })
  }

  /**
   * 处理结束日期变化
   */
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndStr = e.target.value
    setEndDateStr(newEndStr)
    
    const newEnd = parseInputStringToDate(newEndStr)
    if (!newEnd) return
    
    // 检查是否结束日期早于开始日期
    const currentStart = parseInputStringToDate(startDateStr)
    if (currentStart && newEnd < currentStart) {
      setDateError('End date cannot be earlier than start date')
      return
    }
    
    setDateError('')
    
    // 更新为自定义范围
    onScopeChange({
      ...scope,
      start: currentStart ? getStartOfDay(currentStart) : scope.start,
      end: getEndOfDay(newEnd),
      preset: 'custom'
    })
  }

  /**
   * 处理"包含逾期任务"勾选变化
   */
  const handleIncludeOverdueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onScopeChange({
      ...scope,
      includeOverdue: e.target.checked
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* 第一行：日期选择器 + 预设按钮 */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* 起止日期选择器 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDateStr}
            onChange={handleStartDateChange}
            className={`px-3 py-2 border rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              dateError ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <span className="text-gray-500">-</span>
          <input
            type="date"
            value={endDateStr}
            onChange={handleEndDateChange}
            className={`px-3 py-2 border rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              dateError ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>

        {/* 快捷预设按钮 */}
        <div className="flex items-center gap-2">
          {presetOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handlePresetClick(option.id)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                scope.preset === option.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 第二行：逾期任务勾选 + 错误提示 */}
      <div className="flex items-center justify-between mt-3">
        {/* 逾期任务勾选 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scope.includeOverdue}
            onChange={handleIncludeOverdueChange}
            className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Include overdue tasks</span>
        </label>

        {/* 错误提示 */}
        {dateError && (
          <span className="text-sm text-red-500">{dateError}</span>
        )}
      </div>
    </div>
  )
}

