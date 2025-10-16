/**
 * 单个任务操作选项组件
 * 显示四个可选择的操作按钮
 */

'use client'

import React from 'react'
import type { SingleTaskAction, SingleTaskActionOption } from '@/types'

interface SingleTaskActionOptionsProps {
  onSelect: (action: SingleTaskAction) => void
  disabled?: boolean
}

// 操作选项配置
const ACTION_OPTIONS: SingleTaskActionOption[] = [
  {
    id: 'clarify',
    emoji: '📝',
    label: '任务澄清',
    description: '明确任务的具体要求和目标'
  },
  {
    id: 'decompose',
    emoji: '🔨',
    label: '任务拆解',
    description: '将复杂任务分解成小步骤'
  },
  {
    id: 'estimate',
    emoji: '⏱️',
    label: '任务时间估计',
    description: '估算任务需要的时间'
  },
  {
    id: 'back',
    emoji: '↩️',
    label: '返回上一级',
    description: '回到选择模式'
  }
]

export default function SingleTaskActionOptions({ 
  onSelect, 
  disabled = false 
}: SingleTaskActionOptionsProps) {
  return (
    <div className="space-y-2">
      {ACTION_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => !disabled && onSelect(option.id)}
          disabled={disabled}
          className={`
            w-full text-left p-4 rounded-lg border-2 transition-all
            ${disabled 
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
              : option.id === 'clarify'
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
                : option.id === 'decompose'
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-400 hover:shadow-md'
                  : option.id === 'estimate'
                    ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 hover:border-orange-400 hover:shadow-md'
                    : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400 hover:shadow-md'
            }
          `}
        >
          <div className="flex items-start gap-3">
            {/* Emoji图标 */}
            <div className="flex-shrink-0 text-2xl mt-0.5">
              {option.emoji}
            </div>
            
            {/* 文本内容 */}
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-sm font-semibold mb-1
                ${option.id === 'clarify' 
                  ? 'text-blue-900' 
                  : option.id === 'decompose' 
                    ? 'text-green-900' 
                    : option.id === 'estimate'
                      ? 'text-orange-900'
                      : 'text-gray-900'
                }
              `}>
                {option.label}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {option.description}
              </p>
            </div>

            {/* 箭头指示 */}
            {!disabled && (
              <div className="flex-shrink-0 text-gray-400 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

