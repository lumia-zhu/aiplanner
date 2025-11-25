'use client'

/**
 * TaskDurationPicker - 任务时长选择器
 * 
 * 功能：
 * 1. 设置任务预计时长（分钟/小时）
 * 2. 支持滑动条调节
 * 3. 提供快捷选项
 */

import { useState, useEffect, useRef } from 'react'

interface TaskDurationPickerProps {
  position: { x: number; y: number }  // 弹窗位置
  initialDuration?: number            // 初始时长（分钟），可选
  onSelect: (duration: number) => void // 选择回调（返回分钟数）
  onClose: () => void                 // 关闭回调
}

type DurationUnit = 'minute' | 'hour'

export default function TaskDurationPicker({
  position,
  initialDuration = 30, // 默认30分钟
  onSelect,
  onClose
}: TaskDurationPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  
  // 动态调整位置
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  
  // 单位：分钟 or 小时
  const [unit, setUnit] = useState<DurationUnit>('minute')
  
  // 内部存储始终为分钟，展示时转换
  const [duration, setDuration] = useState(initialDuration)
  
  // 初始化逻辑：如果初始值 > 180分钟，自动切换到小时模式
  useEffect(() => {
    if (initialDuration > 180) {
      setUnit('hour')
    } else {
      setUnit('minute')
    }
    setDuration(initialDuration)
  }, [initialDuration])

  // 边界检测，防止超出屏幕
  useEffect(() => {
    if (pickerRef.current) {
      const rect = pickerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      let newX = position.x
      let newY = position.y
      
      if (rect.right > viewportWidth) newX = viewportWidth - rect.width - 20
      if (newX < 20) newX = 20
      if (rect.bottom > viewportHeight) newY = viewportHeight - rect.height - 20
      if (newY < 20) newY = 20
      
      if (newX !== position.x || newY !== position.y) {
        setAdjustedPosition({ x: newX, y: newY })
      }
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

  // 确认选择
  const handleConfirm = () => {
    onSelect(duration)
    onClose()
  }

  // 快捷选项配置
  const quickOptions = unit === 'minute' 
    ? [15, 30, 45, 60]
    : [60, 120, 240, 480] // 1h, 2h, 4h, 8h (存储为分钟)

  // 格式化显示值
  const displayValue = unit === 'minute' 
    ? duration 
    : Number((duration / 60).toFixed(1)) // 小时保留1位小数

  // 滑动条配置
  const sliderConfig = unit === 'minute'
    ? { min: 5, max: 180, step: 5 }
    : { min: 0.5, max: 8, step: 0.5 }

  // 处理滑动条变更
  const handleSliderChange = (val: number) => {
    if (unit === 'minute') {
      setDuration(val)
    } else {
      setDuration(Math.round(val * 60))
    }
  }

  return (
    <div
      ref={pickerRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[300px] animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
      }}
    >
      {/* 标题与数值展示 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          ⏳ 预计时长
        </h3>
        <div className="text-2xl font-bold text-blue-600">
          {displayValue}
          <span className="text-sm font-normal text-gray-500 ml-1">
            {unit === 'minute' ? '分钟' : '小时'}
          </span>
        </div>
      </div>

      {/* 单位切换 */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
        <button
          type="button"
          onClick={() => setUnit('minute')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            unit === 'minute'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          按分钟
        </button>
        <button
          type="button"
          onClick={() => setUnit('hour')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            unit === 'hour'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          按小时
        </button>
      </div>

      {/* 滑动条 */}
      <div className="mb-6 px-1">
        <input
          type="range"
          min={sliderConfig.min}
          max={sliderConfig.max}
          step={sliderConfig.step}
          value={unit === 'minute' ? duration : duration / 60}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{sliderConfig.min}{unit === 'minute' ? 'm' : 'h'}</span>
          <span>{sliderConfig.max}{unit === 'minute' ? 'm' : 'h'}</span>
        </div>
      </div>

      {/* 快捷选项 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {quickOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setDuration(opt)}
            className={`py-1.5 px-2 text-xs rounded border transition-colors ${
              duration === opt
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-medium'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {unit === 'minute' ? `${opt}m` : `${opt/60}h`}
          </button>
        ))}
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
        >
          确定
        </button>
      </div>
    </div>
  )
}

