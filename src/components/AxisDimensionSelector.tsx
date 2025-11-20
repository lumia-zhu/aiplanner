/**
 * 坐标轴维度选择器组件
 * 用于在矩阵视图中选择X轴或Y轴的维度
 * 支持6个维度的自由选择，自动置灰已被占用的维度
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  DIMENSIONS, 
  getAllDimensions, 
  type DimensionType 
} from '@/constants/dimensions'

// ============================================
// 类型定义
// ============================================

interface AxisDimensionSelectorProps {
  currentDimension: DimensionType           // 当前选中的维度
  excludeDimension?: DimensionType          // 需要排除（置灰）的维度（另一个轴占用的维度）
  onSelect: (dimension: DimensionType) => void  // 选择回调
  position?: 'top' | 'bottom' | 'left' | 'right'  // 下拉框弹出位置
  isOpen: boolean                           // 是否显示
  onClose: () => void                       // 关闭回调
}

// ============================================
// 主组件
// ============================================

export default function AxisDimensionSelector({
  currentDimension,
  excludeDimension,
  onSelect,
  position = 'bottom',
  isOpen,
  onClose
}: AxisDimensionSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const allDimensions = getAllDimensions()

  // 点击外部关闭下拉框
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // 处理维度选择
  const handleDimensionClick = (dimensionId: DimensionType) => {
    // 如果是被排除的维度，不允许选择
    if (dimensionId === excludeDimension) {
      return
    }
    
    onSelect(dimensionId)
    onClose()
  }

  // 不显示时返回 null
  if (!isOpen) return null

  // 根据位置计算下拉框样式
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      case 'bottom':
        return 'top-full mt-2 left-1/2 -translate-x-1/2'
      case 'left':
        return 'right-full mr-2 top-1/2 -translate-y-1/2'
      case 'right':
        return 'left-full ml-2 top-1/2 -translate-y-1/2'
      default:
        return 'top-full mt-2 left-1/2 -translate-x-1/2'
    }
  }

  return (
    <div
      ref={dropdownRef}
      className={`absolute ${getPositionStyles()} w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 animate-fadeIn`}
      style={{
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        zIndex: 10000
      }}
    >
      {/* 标题 */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">📊 选择维度</span>
          <span className="text-xs text-gray-500">
            {allDimensions.length} 个可选
          </span>
        </div>
      </div>

      {/* 维度列表 */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {allDimensions.map((dimension) => {
          const isSelected = dimension.id === currentDimension
          const isExcluded = dimension.id === excludeDimension
          const isClickable = !isExcluded

          return (
            <button
              key={dimension.id}
              onClick={() => handleDimensionClick(dimension.id)}
              disabled={!isClickable}
              className={`
                w-full px-4 py-3 text-left transition-all duration-150 flex items-start gap-3
                ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
                ${isExcluded ? 'bg-gray-50 opacity-40' : ''}
                ${isSelected && !isExcluded ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                ${!isExcluded && !isSelected ? 'hover:bg-gray-50' : ''}
              `}
              title={isExcluded ? '此维度已被另一轴占用' : dimension.description}
            >
              {/* 图标 */}
              <span className="text-2xl flex-shrink-0 mt-0.5">
                {dimension.icon}
              </span>

              {/* 文字信息 */}
              <div className="flex-1 min-w-0">
                {/* 标题 */}
                <div className={`font-medium mb-1 flex items-center gap-2 ${
                  isSelected ? 'text-blue-600' : isExcluded ? 'text-gray-400' : 'text-gray-900'
                }`}>
                  {dimension.name}
                  
                  {/* 当前选中标记 */}
                  {isSelected && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  
                  {/* 被占用标记 */}
                  {isExcluded && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                      已占用
                    </span>
                  )}
                </div>

                {/* 维度级别 */}
                <div className="flex items-center gap-2 text-xs">
                  <span className={isExcluded ? 'text-gray-400' : 'text-gray-600'}>
                    {dimension.levels.low}
                  </span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className={isExcluded ? 'text-gray-400' : 'text-gray-600'}>
                    {dimension.levels.high}
                  </span>
                </div>

                {/* 描述 */}
                <p className={`text-xs leading-relaxed mt-1 ${
                  isExcluded ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {dimension.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* 提示信息 */}
      {excludeDimension && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {DIMENSIONS[excludeDimension].icon} {DIMENSIONS[excludeDimension].name} 已被另一轴占用
            </span>
          </p>
        </div>
      )}
    </div>
  )
}





