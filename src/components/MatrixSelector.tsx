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
    
    // 如果当前不在矩阵模式，切换到矩阵模式
    if (!isMatrixMode) {
      onToggleView()
    }
    
    setIsOpen(false)
  }

  const currentConfig = MATRIX_DIMENSION_CONFIGS[currentDimension]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 主按钮 */}
      <button
        onMouseEnter={() => !isMatrixMode && setIsOpen(true)}
        onClick={onToggleView}
        className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
        style={{ backgroundColor: isMatrixMode ? '#10B981' : '#4A90E2' }}
        title={isMatrixMode ? '切换到笔记模式' : '选择矩阵维度'}
      >
        {isMatrixMode ? (
          /* 矩阵模式：显示"笔记模式"按钮 */
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            笔记模式
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

      {/* 下拉菜单 - 只在编辑器模式下显示 */}
      {isOpen && !isMatrixMode && (
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

