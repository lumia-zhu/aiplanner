'use client'

import React from 'react'

interface AgentLoadingIndicatorProps {
  iteration?: number
  maxIterations?: number
  message?: string
}

/**
 * Agent 加载指示器组件
 * 
 * 用于展示 Agent 正在思考/执行中
 * - 渐变背景（紫色→蓝色）
 * - 旋转动画
 * - 进度条（显示迭代进度）
 * - 可自定义加载提示文本
 */
export default function AgentLoadingIndicator({ 
  iteration, 
  maxIterations = 5,
  message
}: AgentLoadingIndicatorProps) {
  // 计算进度百分比
  const progress = iteration !== undefined 
    ? Math.min((iteration / maxIterations) * 100, 100) 
    : 0
  
  return (
    <div className="my-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-500 rounded-r-lg animate-fade-in">
      <div className="flex items-center gap-3">
        {/* 旋转动画 */}
        <div className="flex-shrink-0">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 加载文本 */}
          <p className="text-sm font-medium text-gray-700">
            🤖 {message || 'Agent 正在思考...'}
          </p>
          
          {/* 进度条（仅在有迭代信息时显示） */}
          {iteration !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {iteration}/{maxIterations}
              </span>
            </div>
          )}
          
          {/* 脉动点动画 */}
          <div className="mt-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}







