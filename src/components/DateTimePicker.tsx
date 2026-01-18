'use client'

/**
 * DateTimePicker - 日期时间选择器
 * 支持两种模式：
 * 1. 截止时间：单个时间点
 * 2. 时间间隔：开始时间 ~ 结束时间
 */

import { useState, useEffect, useRef } from 'react'
import { DateTimeSetting, DateTimeMode } from '@/types/datetime'

interface DateTimePickerProps {
  position: { x: number; y: number }  // 弹窗位置
  initialValue?: DateTimeSetting      // 初始值（编辑时使用）
  onSelect: (value: DateTimeSetting) => void  // 选择回调
  onClear?: () => void                // 清除时间回调（可选）
  onClose: () => void                 // 关闭回调
}

export default function DateTimePicker({
  position,
  initialValue,
  onSelect,
  onClear,
  onClose
}: DateTimePickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  
  // 模式：截止时间 or 时间间隔
  const [mode, setMode] = useState<DateTimeMode>(
    initialValue?.mode || 'deadline'
  )
  
  // 截止时间模式的状态
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  
  // 时间间隔模式的状态
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  
  // 动态调整位置（防止超出屏幕）
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  
  // 初始化表单数据
  useEffect(() => {
    if (initialValue) {
      if (initialValue.mode === 'deadline') {
        const date = new Date(initialValue.time)
        setDeadlineDate(formatDateForInput(date))
        setDeadlineTime(formatTimeForInput(date))
      } else {
        const start = new Date(initialValue.startTime)
        const end = new Date(initialValue.endTime)
        setStartDate(formatDateForInput(start))
        setStartTime(formatTimeForInput(start))
        setEndDate(formatDateForInput(end))
        setEndTime(formatTimeForInput(end))
      }
    } else {
      // 默认值：今天
      const now = new Date()
      setDeadlineDate(formatDateForInput(now))
      setDeadlineTime('18:00')
      setStartDate(formatDateForInput(now))
      setStartTime('09:00')
      setEndDate(formatDateForInput(now))
      setEndTime('18:00')
    }
  }, [initialValue])
  
  // 边界检测，防止超出屏幕
  useEffect(() => {
    if (pickerRef.current) {
      requestAnimationFrame(() => {
        if (!pickerRef.current) return
        
        const rect = pickerRef.current.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        let newX = position.x
        let newY = position.y
        
        // 右边界检测
        if (rect.right > viewportWidth) {
          newX = viewportWidth - rect.width - 20
        }
        
        // 左边界检测
        if (newX < 20) {
          newX = 20
        }
        
        // 底部边界检测
        if (rect.bottom > viewportHeight) {
          newY = viewportHeight - rect.height - 20
        }
        
        // 顶部边界检测
        if (newY < 20) {
          newY = 20
        }
        
        if (newX !== position.x || newY !== position.y) {
          setAdjustedPosition({ x: newX, y: newY })
        }
      })
    }
  }, [position])
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])
  
  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])
  
  // 格式化日期为 input[type="date"] 格式 (YYYY-MM-DD)
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // 格式化时间为 input[type="time"] 格式 (HH:mm)
  function formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  // 解析日期时间字符串为 Date 对象
  function parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`)
  }
  
  // 验证表单
  function validateForm(): string | null {
    if (mode === 'deadline') {
      if (!deadlineDate || !deadlineTime) {
        return '请选择日期和时间'
      }
    } else {
      if (!startDate || !startTime || !endDate || !endTime) {
        return '请选择开始和结束时间'
      }
      
      // 验证结束时间必须在开始时间之后
      const start = parseDateTime(startDate, startTime)
      const end = parseDateTime(endDate, endTime)
      
      if (end <= start) {
        return '结束时间必须晚于开始时间'
      }
    }
    
    return null
  }
  
  // 确认选择
  function handleConfirm() {
    const error = validateForm()
    if (error) {
      alert(error)
      return
    }
    
    if (mode === 'deadline') {
      const datetime = parseDateTime(deadlineDate, deadlineTime)
      onSelect({
        mode: 'deadline',
        time: datetime
      })
    } else {
      const start = parseDateTime(startDate, startTime)
      const end = parseDateTime(endDate, endTime)
      onSelect({
        mode: 'interval',
        startTime: start,
        endTime: end
      })
    }
  }
  
  return (
    <div
      ref={pickerRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[340px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-40px)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
      }}
    >
      {/* 标题 */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          ⏰ 设置截止时间
        </h3>
      </div>
      
      {/* 模式切换 */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('deadline')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'deadline'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📅 截止时间
        </button>
        <button
          type="button"
          onClick={() => setMode('interval')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'interval'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ⏱️ 时间间隔
        </button>
      </div>
      
      {/* 表单内容 */}
      <div className="mb-4">
        {mode === 'deadline' ? (
          // 截止时间模式
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                日期
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                时间
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        ) : (
          // 时间间隔模式
          <div className="space-y-4">
            {/* 开始时间 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                开始时间
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    日期
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    时间
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            {/* 结束时间 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                结束时间
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    日期
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    时间
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          取消
        </button>
        {/* 只有当任务已有时间设置时才显示清除按钮 */}
        {initialValue && onClear && (
          <button
            type="button"
            onClick={() => {
              onClear()
              onClose()
            }}
            className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
          >
            清除
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          确定
        </button>
      </div>
    </div>
  )
}

