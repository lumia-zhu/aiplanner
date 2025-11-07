'use client'

import React, { useState } from 'react'
import type { AgentObservationData } from '@/lib/doubaoService'

interface AgentObservationCardProps {
  data: AgentObservationData
}

/**
 * Agent 观察卡片组件
 * 
 * 用于展示工具执行的结果（Observation）
 * - 成功：绿色主题 + 勾选图标
 * - 失败：红色主题 + 警告图标
 * - 结果可折叠展开
 * - 显示工具名称、执行状态、结果/错误信息
 */
export default function AgentObservationCard({ data }: AgentObservationCardProps) {
  const [showResult, setShowResult] = useState(false)
  
  return (
    <div className={`my-2 p-3 border-l-4 rounded-r-lg animate-fade-in ${
      data.success 
        ? 'bg-green-50 border-green-500' 
        : 'bg-red-50 border-red-500'
    }`}>
      <div className="flex items-start gap-2">
        {/* 状态图标 */}
        <div className="flex-shrink-0 mt-0.5">
          {data.success ? (
            <svg 
              className="w-5 h-5 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          ) : (
            <svg 
              className="w-5 h-5 text-red-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          )}
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold ${
              data.success ? 'text-green-700' : 'text-red-700'
            }`}>
              👁️ 观察
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              data.success 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {data.toolName}
            </span>
          </div>
          
          {/* 成功状态 */}
          {data.success ? (
            <>
              <p className="text-sm text-gray-700 mb-2">
                ✅ 工具执行成功
              </p>
              
              <button
                onClick={() => setShowResult(!showResult)}
                className="text-xs text-green-600 hover:text-green-800 underline transition-colors"
              >
                {showResult ? '隐藏结果 ▲' : '查看结果 ▼'}
              </button>
              
              {showResult && (
                <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-700 overflow-x-auto max-h-60 overflow-y-auto border border-green-200">
                  {JSON.stringify(data.result, null, 2)}
                </pre>
              )}
            </>
          ) : (
            /* 失败状态 */
            <p className="text-sm text-red-700">
              ❌ {data.error || '工具执行失败'}
            </p>
          )}
          
          {/* 时间戳 */}
          <div 
            className={`text-xs mt-2 ${
              data.success ? 'text-green-400' : 'text-red-400'
            }`}
            suppressHydrationWarning
          >
            {new Date(data.timestamp).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

