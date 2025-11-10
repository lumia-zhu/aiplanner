/**
 * 矩阵维度选择器组件
 * 仅负责选择矩阵维度，模式切换由 ViewModeToggle 组件负责
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import type { TaskMatrixDimension } from '@/types'
import { MATRIX_DIMENSION_CONFIGS } from '@/types'

// ============================================
// 类型定义
// ============================================

interface MatrixSelectorProps {
  currentDimension: TaskMatrixDimension       // 当前选中的矩阵维度
  onDimensionChange: (dimension: TaskMatrixDimension) => void  // 切换矩阵维度的回调
  onToggleView?: () => void                    // 兼容旧代码，但不再使用
  isMatrixMode?: boolean                       // 兼容旧代码，但不再使用
}

// ============================================
// 主组件
// ============================================

export default function MatrixSelector({
  currentDimension,
  onDimensionChange,
}: MatrixSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 处理矩阵维度选择
  const handleDimensionSelect = (dimension: TaskMatrixDimension) => {
    onDimensionChange(dimension)
    setIsOpen(false)
  }

  const currentConfig = MATRIX_DIMENSION_CONFIGS[currentDimension]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 维度选择按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95 bg-indigo-600"
        title="选择矩阵维度"
      >
        {/* 当前维度图标 */}
        <span className="text-lg">{currentConfig.icon}</span>
        
        {/* 当前维度名称 */}
        <span>{currentConfig.name}</span>
        
        {/* 下拉箭头 */}
        <svg 
          className="w-3 h-3 transition-transform duration-200" 
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div 
          className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[9999] animate-fadeIn"
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* 标题 */}
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-xs text-gray-500 font-medium">选择矩阵维度</p>
          </div>
          
          {/* 矩阵选项列表 */}
          {Object.values(MATRIX_DIMENSION_CONFIGS).map((config) => (
            <button
              key={config.id}
              onClick={() => handleDimensionSelect(config.id)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3"
            >
              {/* 图标 */}
              <span className="text-2xl flex-shrink-0 mt-0.5">{config.icon}</span>
              
              {/* 文字信息 */}
              <div className="flex-1 min-w-0">
                {/* 标题 */}
                <div className="font-medium text-gray-900 mb-1">
                  {config.name}
                </div>
                
                {/* 描述 */}
                <p className="text-xs text-gray-500 leading-relaxed">
                  {config.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

