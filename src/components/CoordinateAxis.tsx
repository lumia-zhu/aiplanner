/**
 * 任务矩阵坐标轴组件
 * 显示十字坐标轴和四个方向的标签
 * 支持动态配置不同的坐标轴标签
 * 支持交互式维度选择
 */

'use client'

import { useCallback, useState } from 'react'
import AxisDimensionSelector from './AxisDimensionSelector'
import { getAxisLabels, type DimensionType } from '@/constants/dimensions'

// ============================================
// 类型定义
// ============================================

interface CoordinateAxisProps {
  // 新版本：使用维度类型
  xAxis?: DimensionType                          // X轴维度
  yAxis?: DimensionType                          // Y轴维度
  onXAxisChange?: (dimension: DimensionType) => void  // X轴切换回调（可选）
  onYAxisChange?: (dimension: DimensionType) => void  // Y轴切换回调（可选）
  interactive?: boolean                         // 是否启用交互式选择（默认 true）
  
  // 旧版本：兼容原有调用方式
  axes?: {
    horizontal: { left: string; right: string }
    vertical: { bottom: string; top: string }
  }
}

// ============================================
// 主组件
// ============================================

export default function CoordinateAxis({
  xAxis,
  yAxis,
  onXAxisChange,
  onYAxisChange,
  interactive = true,
  axes: legacyAxes
}: CoordinateAxisProps) {
  // 状态：控制各方向选择器的显示
  const [showTopSelector, setShowTopSelector] = useState(false)
  const [showBottomSelector, setShowBottomSelector] = useState(false)
  const [showLeftSelector, setShowLeftSelector] = useState(false)
  const [showRightSelector, setShowRightSelector] = useState(false)

  // 根据当前维度生成标签（支持新旧两种方式）
  const axes = legacyAxes || (xAxis && yAxis ? getAxisLabels({ xAxis, yAxis }) : {
    horizontal: { left: '不紧急', right: '紧急' },
    vertical: { bottom: '不重要', top: '重要' }
  })

  // 判断是否可交互（只有新版本调用才支持交互）
  const canInteract = interactive && xAxis && yAxis && (onXAxisChange || onYAxisChange)

  // 统一控制下拉框，只允许一个处于打开状态
  const openSelector = useCallback((position: 'top' | 'bottom' | 'left' | 'right') => {
    setShowTopSelector(position === 'top')
    setShowBottomSelector(position === 'bottom')
    setShowLeftSelector(position === 'left')
    setShowRightSelector(position === 'right')
  }, [])

  const closeSelector = useCallback((position: 'top' | 'bottom' | 'left' | 'right') => {
    switch (position) {
      case 'top':
        setShowTopSelector(false)
        break
      case 'bottom':
        setShowBottomSelector(false)
        break
      case 'left':
        setShowLeftSelector(false)
        break
      case 'right':
        setShowRightSelector(false)
        break
    }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {/* 纵轴（垂直线） */}
      <div 
        className="absolute top-0 bottom-0 w-[1px] bg-gray-300"
        style={{
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* 横轴（水平线） */}
      <div 
        className="absolute left-0 right-0 h-[1px] bg-gray-300"
        style={{
          top: '50%',
          transform: 'translateY(-50%)'
        }}
      />
      
      {/* 上方标签：纵轴顶部 ↑ (Y轴高端) */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-[200]"
        style={{ top: '-8px' }}
        onMouseEnter={() => canInteract && onYAxisChange && openSelector('top')}
      >
        <button
          className={`text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all duration-150 ${
            canInteract && onYAxisChange ? 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer hover:shadow-md' : ''
          }`}
          onClick={() => {
            if (!canInteract || !onYAxisChange) return
            if (showTopSelector) {
              closeSelector('top')
            } else {
              openSelector('top')
            }
          }}
          disabled={!canInteract || !onYAxisChange}
        >
          <span>{axes.vertical.top}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>

        {/* Y轴维度选择器 */}
        {canInteract && onYAxisChange && xAxis && yAxis && (
          <AxisDimensionSelector
            currentDimension={yAxis}
            excludeDimension={xAxis}
            onSelect={onYAxisChange}
            position="bottom"
            isOpen={showTopSelector}
            onClose={() => closeSelector('top')}
          />
        )}
      </div>
      
      {/* 下方标签：纵轴底部 ↓ (Y轴低端) */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-[200]"
        style={{ bottom: '-8px' }}
        onMouseEnter={() => canInteract && onYAxisChange && openSelector('bottom')}
      >
        <button
          className={`text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all duration-150 ${
            canInteract && onYAxisChange ? 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer hover:shadow-md' : ''
          }`}
          onClick={() => {
            if (!canInteract || !onYAxisChange) return
            if (showBottomSelector) {
              closeSelector('bottom')
            } else {
              openSelector('bottom')
            }
          }}
          disabled={!canInteract || !onYAxisChange}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>{axes.vertical.bottom}</span>
        </button>

        {/* Y轴维度选择器 */}
        {canInteract && onYAxisChange && xAxis && yAxis && (
          <AxisDimensionSelector
            currentDimension={yAxis}
            excludeDimension={xAxis}
            onSelect={onYAxisChange}
            position="top"
            isOpen={showBottomSelector}
            onClose={() => closeSelector('bottom')}
          />
        )}
      </div>
      
      {/* 左侧标签：横轴左侧 ← (X轴低端) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 flex items-center pointer-events-auto z-[200]"
        style={{ left: '-8px' }}
        onMouseEnter={() => canInteract && onXAxisChange && openSelector('left')}
      >
        <button
          className={`text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all duration-150 ${
            canInteract && onXAxisChange ? 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer hover:shadow-md' : ''
          }`}
          onClick={() => {
            if (!canInteract || !onXAxisChange) return
            if (showLeftSelector) {
              closeSelector('left')
            } else {
              openSelector('left')
            }
          }}
          disabled={!canInteract || !onXAxisChange}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>{axes.horizontal.left}</span>
        </button>

        {/* X轴维度选择器 */}
        {canInteract && onXAxisChange && xAxis && yAxis && (
          <AxisDimensionSelector
            currentDimension={xAxis}
            excludeDimension={yAxis}
            onSelect={onXAxisChange}
            position="right"
            isOpen={showLeftSelector}
            onClose={() => closeSelector('left')}
          />
        )}
      </div>
      
      {/* 右侧标签：横轴右侧 → (X轴高端) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 flex items-center pointer-events-auto z-[200]"
        style={{ right: '-8px' }}
        onMouseEnter={() => canInteract && onXAxisChange && openSelector('right')}
      >
        <button
          className={`text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all duration-150 ${
            canInteract && onXAxisChange ? 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer hover:shadow-md' : ''
          }`}
          onClick={() => {
            if (!canInteract || !onXAxisChange) return
            if (showRightSelector) {
              closeSelector('right')
            } else {
              openSelector('right')
            }
          }}
          disabled={!canInteract || !onXAxisChange}
        >
          <span>{axes.horizontal.right}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        {/* X轴维度选择器 */}
        {canInteract && onXAxisChange && xAxis && yAxis && (
          <AxisDimensionSelector
            currentDimension={xAxis}
            excludeDimension={yAxis}
            onSelect={onXAxisChange}
            position="left"
            isOpen={showRightSelector}
            onClose={() => closeSelector('right')}
          />
        )}
      </div>
    </div>
  )
}



