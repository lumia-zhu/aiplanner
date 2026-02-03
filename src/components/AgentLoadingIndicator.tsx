'use client'

import React from 'react'

interface AgentLoadingIndicatorProps {
  iteration?: number
  maxIterations?: number
  message?: string
}

/**
 * Agent 加载指示器组件（简洁优雅版）
 * 
 * 用于展示 Agent 正在思考/执行中
 * - 简洁的卡片设计
 * - 优雅的旋转动画
 * - 简化的进度显示
 */
export default function AgentLoadingIndicator({ 
  iteration, 
  maxIterations = 5,
  message
}: AgentLoadingIndicatorProps) {
  return (
    <div className="my-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100 animate-fade-in">
      <div className="flex items-center gap-3">
        {/* 优雅的旋转动画 */}
        <div className="flex-shrink-0">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 border-t-blue-500"></div>
        </div>
        
        {/* 内容 */}
        <div className="flex items-center gap-2 flex-1">
          {/* 加载文本 */}
          <p className="text-sm text-blue-700">
            🤖 {message || 'Agent 正在思考'}
          </p>
          
          {/* 迭代进度（简化为小标签） */}
          {iteration !== undefined && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
              {iteration}/{maxIterations}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}







