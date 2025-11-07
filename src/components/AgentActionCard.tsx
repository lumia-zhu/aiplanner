'use client'

import React, { useState } from 'react'
import type { AgentActionData } from '@/lib/doubaoService'

interface AgentActionCardProps {
  data: AgentActionData
}

/**
 * Agent 行动卡片组件
 * 
 * 用于展示 Agent 调用的工具（Action）
 * - 蓝色主题，表示"行动"
 * - 显示工具名称、描述、参数
 * - 参数可折叠展开
 * - 为每个工具显示对应的 emoji 图标
 */
export default function AgentActionCard({ data }: AgentActionCardProps) {
  const [showParams, setShowParams] = useState(false)
  
  // 工具图标映射
  const getToolIcon = (toolName: string): string => {
    const icons: Record<string, string> = {
      'get_tasks': '📋',
      'analyze_tasks': '📊',
      'clarify_task': '❓',
      'decompose_task': '✂️',
      'estimate_time': '⏱️',
      'load_task_context': '🧠',
    }
    return icons[toolName] || '🔧'
  }
  
  return (
    <div className="my-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg animate-fade-in">
      <div className="flex items-start gap-2">
        {/* 工具图标 */}
        <div className="flex-shrink-0 mt-0.5 text-2xl">
          {getToolIcon(data.toolName)}
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-700">🔧 行动</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {data.toolName}
            </span>
          </div>
          
          {/* 工具描述 */}
          <p className="text-sm font-medium text-blue-900 mb-1">
            {data.toolDescription}
          </p>
          
          {/* 参数折叠展示 */}
          <button
            onClick={() => setShowParams(!showParams)}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            {showParams ? '隐藏参数 ▲' : '查看参数 ▼'}
          </button>
          
          {showParams && (
            <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-700 overflow-x-auto border border-blue-200">
              {JSON.stringify(data.parameters, null, 2)}
            </pre>
          )}
          
          {/* 时间戳 */}
          <div className="text-xs text-blue-400 mt-2" suppressHydrationWarning>
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

