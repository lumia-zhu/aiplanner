/**
 * 矩阵维度选择器组件
 * 支持切换不同的矩阵维度（重要-紧急、影响-努力、有趣-刺激）
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
  onToggleView: () => void                    // 切换视图（编辑器/矩阵）的回调
  isMatrixMode: boolean                       // 是否在矩阵模式下
}

// ============================================
// 主组件
// ============================================

export default function MatrixSelector({
  currentDimension,
  onDimensionChange,
  onToggleView,
  isMatrixMode
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
    // 切换维度
    onDimensionChange(dimension)
    
    // ✅ 如果当前不在矩阵模式，切换到矩阵模式
    // ✅ 如果已经在矩阵模式，只切换维度，不切换视图
    if (!isMatrixMode && onToggleView) {
      onToggleView()
    }
    
    setIsOpen(false)
  }

  const currentConfig = MATRIX_DIMENSION_CONFIGS[currentDimension]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 主按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
        style={{ backgroundColor: isMatrixMode ? '#10B981' : '#4A90E2' }}
        title={isMatrixMode ? '切换矩阵维度' : '选择矩阵维度'}
      >
        {isMatrixMode ? (
          /* 矩阵模式：显示当前维度 + 下拉箭头 */
          <>
            <span className="text-base">{currentConfig.icon}</span>
            <span className="text-sm">{currentConfig.name}</span>
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
          </>
        ) : (
          /* 编辑器模式：显示"矩阵模式"按钮 + 下拉箭头 */
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            矩阵模式
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
          </>
        )}
      </button>

      {/* 下拉菜单 - 在两种模式下都显示 */}
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
          {Object.values(MATRIX_DIMENSION_CONFIGS).map((config) => {
            const isSelected = config.id === currentDimension
            return (
              <button
                key={config.id}
                onClick={() => handleDimensionSelect(config.id)}
                className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 ${
                  isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                {/* 图标 */}
                <span className="text-2xl flex-shrink-0 mt-0.5">{config.icon}</span>
                
                {/* 文字信息 */}
                <div className="flex-1 min-w-0">
                  {/* 标题 */}
                  <div className={`font-medium mb-1 flex items-center gap-2 ${
                    isSelected ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {config.name}
                    {isSelected && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  
                  {/* 描述 */}
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {config.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

