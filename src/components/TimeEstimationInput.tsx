'use client'

import { useState, useEffect } from 'react'
import { parseTimeEstimate, formatMinutes, validateTimeEstimate } from '@/utils/timeEstimation'

interface TimeEstimationInputProps {
  onSubmit: (minutes: number) => void
  onCancel: () => void
  defaultValue?: number
}

type InputMode = 'slider' | 'custom'

export default function TimeEstimationInput({ 
  onSubmit, 
  onCancel,
  defaultValue = 60 
}: TimeEstimationInputProps) {
  const [mode, setMode] = useState<InputMode>('slider')
  const [sliderValue, setSliderValue] = useState(defaultValue)
  const [customInput, setCustomInput] = useState('')
  const [parsedMinutes, setParsedMinutes] = useState<number | null>(null)
  const [error, setError] = useState<string>('')
  
  // 滑动条配置
  const sliderMin = 15
  const sliderMax = 480 // 8小时
  const sliderStep = 15
  
  // 实时解析自定义输入
  useEffect(() => {
    if (mode === 'custom' && customInput) {
      const parsed = parseTimeEstimate(customInput)
      setParsedMinutes(parsed)
      
      if (parsed) {
        const validation = validateTimeEstimate(parsed)
        setError(validation.valid ? '' : validation.message || '')
      } else {
        setError('无法识别的格式，试试"2小时"或"120分钟"')
      }
    } else {
      setError('')
    }
  }, [customInput, mode])
  
  const handleSubmit = () => {
    let minutes: number | null = null
    
    if (mode === 'slider') {
      minutes = sliderValue
    } else if (mode === 'custom') {
      minutes = parsedMinutes
    }
    
    if (minutes) {
      const validation = validateTimeEstimate(minutes)
      if (validation.valid) {
        onSubmit(minutes)
      } else {
        setError(validation.message || '')
      }
    }
  }
  
  const canSubmit = 
    (mode === 'slider' && sliderValue > 0) ||
    (mode === 'custom' && parsedMinutes !== null && !error)
  
  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border-2 border-gray-200">
      {/* 模式切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('slider')}
          className={`flex-1 px-3 py-2 rounded-lg font-medium transition text-sm ${
            mode === 'slider'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🎚️ 滑动条
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 px-3 py-2 rounded-lg font-medium transition text-sm ${
            mode === 'custom'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✏️ 自定义
        </button>
      </div>
      
      {/* 滑动条模式 */}
      {mode === 'slider' && (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {formatMinutes(sliderValue)}
            </div>
            <p className="text-xs text-gray-500 mt-1">拖动滑块调整时间</p>
          </div>
          
          <div className="space-y-2">
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100}%, #E5E7EB ${((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100}%, #E5E7EB 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatMinutes(sliderMin)}</span>
              <span>{formatMinutes(sliderMax)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 自定义输入模式 */}
      {mode === 'custom' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="如：2小时、135分钟、2.5h"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              autoFocus
            />
            
            {parsedMinutes && !error && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600">✓</span>
                <span className="text-gray-700">
                  将记录为：<span className="font-semibold text-green-600">{formatMinutes(parsedMinutes)}</span>
                </span>
              </div>
            )}
            
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-1">💡 支持的格式：</p>
            <div className="text-xs text-blue-600 space-y-0.5">
              <div>• 纯数字：120（分钟）</div>
              <div>• 小时：2小时、2h</div>
              <div>• 分钟：90分钟、90min</div>
              <div>• 小数：2.5小时、1.5h</div>
              <div>• 组合：2小时30分钟</div>
            </div>
          </div>
        </div>
      )}
      
      {/* 提交按钮 */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
        >
          确定
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          取消
        </button>
      </div>
      
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider-thumb::-webkit-slider-thumb:hover {
          background: #2563EB;
          transform: scale(1.1);
        }
        
        .slider-thumb::-moz-range-thumb:hover {
          background: #2563EB;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  )
}

