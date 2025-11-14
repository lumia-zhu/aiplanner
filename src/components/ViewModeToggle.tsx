/**
 * 视图模式切换组件
 * 用于在笔记模式和矩阵模式之间切换
 */

'use client'

import React from 'react'

export type ViewMode = 'editor' | 'matrix'

interface ViewModeToggleProps {
  currentMode: ViewMode
  onModeChange: (mode: ViewMode) => void
}

export default function ViewModeToggle({
  currentMode,
  onModeChange,
}: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden shadow-sm">
      {/* 笔记模式按钮 */}
      <button
        onClick={() => onModeChange('editor')}
        disabled={currentMode === 'editor'}
        className={`
          px-4 py-2 font-medium text-sm transition-all duration-200 flex items-center gap-2
          ${currentMode === 'editor' 
            ? 'bg-blue-600 text-white cursor-not-allowed' 
            : 'bg-white text-gray-700 hover:bg-gray-100 cursor-pointer'
          }
        `}
        title={currentMode === 'editor' ? '当前模式' : '切换到笔记模式'}
      >
        {/* 图标 */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
          />
        </svg>
        <span>笔记模式</span>
      </button>
      
      {/* 矩阵模式按钮 */}
      <button
        onClick={() => onModeChange('matrix')}
        disabled={currentMode === 'matrix'}
        className={`
          px-4 py-2 font-medium text-sm transition-all duration-200 flex items-center gap-2 border-l border-gray-300
          ${currentMode === 'matrix' 
            ? 'bg-blue-600 text-white cursor-not-allowed' 
            : 'bg-white text-gray-700 hover:bg-gray-100 cursor-pointer'
          }
        `}
        title={currentMode === 'matrix' ? '当前模式' : '切换到矩阵模式'}
      >
        {/* 图标 */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" 
          />
        </svg>
        <span>矩阵模式</span>
      </button>
    </div>
  )
}






