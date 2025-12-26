'use client'

import React, { useState } from 'react'
import type { AgentReasoningData, AgentThoughtData, AgentActionData, AgentObservationData } from '@/lib/doubaoService'

interface AgentReasoningCardProps {
  data: AgentReasoningData
  defaultExpanded?: boolean  // 默认是否展开
}

/**
 * Agent 推理过程卡片组件
 * 
 * 将 Thought、Action、Observation 合并到一个可折叠的卡片中
 * - 默认收起，显示摘要信息
 * - 展开后显示完整的推理过程
 * - 紫色渐变主题，表示"推理"
 */
export default function AgentReasoningCard({ data, defaultExpanded = false }: AgentReasoningCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // 计算摘要信息
  const thoughtCount = data.thoughts.length
  const actionCount = data.actions.length
  const allSuccess = data.actions.every(a => a.observation.success)
  
  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  // 工具图标映射
  const getToolIcon = (toolName: string): string => {
    const icons: Record<string, string> = {
      'get_tasks': '📋',
      'analyze_tasks': '📊',
      'clarify_task': '❓',
      'decompose_task': '✂️',
      'estimate_time': '⏱️',
      'load_task_context': '🧠',
      'create_task': '➕',
      'update_task': '✏️',
      'delete_task': '🗑️',
      'complete_task': '✅',
      'reflect_on_tasks': '🪞',
      'global_scan': '🔍',
    }
    return icons[toolName] || '🔧'
  }

  return (
    <div className="my-2 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 overflow-hidden shadow-sm">
      {/* 折叠头部 - 点击展开/收起 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* 图标 */}
          <span className="text-lg">🧠</span>
          
          {/* 标题 */}
          <span className="text-sm font-medium text-purple-700">
            推理过程
          </span>
          
          {/* 摘要标签 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
              {thoughtCount}次思考
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              allSuccess 
                ? 'bg-green-100 text-green-600' 
                : 'bg-yellow-100 text-yellow-600'
            }`}>
              {actionCount}次工具调用
            </span>
          </div>
        </div>
        
        {/* 展开/收起图标 */}
        <span className={`text-purple-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
      
      {/* 展开内容 */}
      {isExpanded && (
        <div className="border-t border-purple-200 bg-white/50">
          {/* 思考步骤 */}
          {data.thoughts.map((thought, index) => (
            <ThoughtItem key={`thought-${index}`} data={thought} index={index} formatTime={formatTime} />
          ))}
          
          {/* 行动与观察 */}
          {data.actions.map((actionPair, index) => (
            <ActionObservationItem 
              key={`action-${index}`} 
              action={actionPair.action} 
              observation={actionPair.observation}
              getToolIcon={getToolIcon}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 思考项组件
 */
function ThoughtItem({ 
  data, 
  index, 
  formatTime 
}: { 
  data: AgentThoughtData
  index: number
  formatTime: (t: string) => string 
}) {
  return (
    <div className="px-3 py-2 border-b border-purple-100 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="text-purple-500 text-sm">💭</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-purple-600">思考 #{data.iteration || index + 1}</span>
            <span className="text-xs text-purple-400">{formatTime(data.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
            {data.thought}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * 行动与观察项组件
 */
function ActionObservationItem({ 
  action, 
  observation, 
  getToolIcon,
  formatTime 
}: { 
  action: AgentActionData
  observation: AgentObservationData
  getToolIcon: (name: string) => string
  formatTime: (t: string) => string 
}) {
  const [showParams, setShowParams] = useState(false)
  const [showResult, setShowResult] = useState(false)
  
  return (
    <div className="px-3 py-2 border-b border-purple-100 last:border-b-0 bg-blue-50/30">
      <div className="flex items-start gap-2">
        <span className="text-lg">{getToolIcon(action.toolName)}</span>
        <div className="flex-1 min-w-0">
          {/* 行动标题 */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-blue-600">🔧 {action.toolName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              observation.success 
                ? 'bg-green-100 text-green-600' 
                : 'bg-red-100 text-red-600'
            }`}>
              {observation.success ? '✅ 成功' : '❌ 失败'}
            </span>
            <span className="text-xs text-gray-400">{formatTime(action.timestamp)}</span>
          </div>
          
          {/* 工具描述 */}
          {action.toolDescription && (
            <p className="text-xs text-gray-600 mb-1">{action.toolDescription}</p>
          )}
          
          {/* 折叠按钮 */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowParams(!showParams) }}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              {showParams ? '隐藏参数 ▲' : '查看参数 ▼'}
            </button>
            
            {observation.success && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowResult(!showResult) }}
                className="text-xs text-green-500 hover:text-green-700 underline"
              >
                {showResult ? '隐藏结果 ▲' : '查看结果 ▼'}
              </button>
            )}
          </div>
          
          {/* 参数展示 */}
          {showParams && (
            <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-700 overflow-x-auto border border-blue-200 max-h-40 overflow-y-auto">
              {JSON.stringify(action.parameters, null, 2)}
            </pre>
          )}
          
          {/* 结果展示 */}
          {showResult && observation.success && (
            <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-700 overflow-x-auto border border-green-200 max-h-40 overflow-y-auto">
              {JSON.stringify(observation.result, null, 2)}
            </pre>
          )}
          
          {/* 错误信息 */}
          {!observation.success && observation.error && (
            <p className="mt-1 text-xs text-red-600">
              {observation.error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

