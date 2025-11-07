'use client'

import React from 'react'
import type { AgentThoughtData } from '@/lib/doubaoService'

interface AgentThoughtCardProps {
  data: AgentThoughtData
}

/**
 * Agent 思考卡片组件
 * 
 * 用于展示 Agent 的推理过程（Thought）
 * - 紫色主题，表示"思考"
 * - 显示思考内容、迭代次数、时间戳
 * - 灯泡图标表示"思考"
 */
export default function AgentThoughtCard({ data }: AgentThoughtCardProps) {
  return (
    <div className="my-2 p-3 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg animate-fade-in">
      <div className="flex items-start gap-2">
        {/* 图标 */}
        <div className="flex-shrink-0 mt-0.5">
          <svg 
            className="w-5 h-5 text-purple-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
            />
          </svg>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-purple-700">💭 思考</span>
            <span className="text-xs text-purple-500">#{data.iteration}</span>
          </div>
          
          {/* 思考内容 */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
            {data.thought}
          </p>
          
          {/* 时间戳 */}
          <div className="text-xs text-purple-400 mt-2" suppressHydrationWarning>
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

