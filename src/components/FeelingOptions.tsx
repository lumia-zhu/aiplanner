/**
 * 感觉选项组件
 * 用于优先级排序时询问用户的感觉状态
 */

'use client'

import React from 'react'
import type { FeelingOption, PrioritySortFeeling } from '@/types'

interface FeelingOptionsProps {
  onSelect: (feeling: PrioritySortFeeling) => void
  disabled?: boolean
}

// 感觉选项配置
const FEELING_OPTIONS: FeelingOption[] = [
  {
    id: 'urgent',
    emoji: '🔥',
    label: '截止日期临近',
    description: '先分清"马上做"和"等会儿做"'
  },
  {
    id: 'overwhelmed',
    emoji: '🤔',
    label: '任务太多太乱',
    description: '先找到"高回报"和"轻松赢"的事'
  },
  {
    id: 'blank',
    emoji: '😫',
    label: '大脑一片空白',
    description: '先找"最不费力"或"有点想做"的事'
  },
  {
    id: 'back',
    emoji: '↩️',
    label: '返回上一级',
    description: '回到选择模式'
  }
]

/**
 * 感觉选项按钮组件
 */
export default function FeelingOptions({ onSelect, disabled = false }: FeelingOptionsProps) {
  return (
    <div className="space-y-2">
      {FEELING_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => !disabled && onSelect(option.id)}
          disabled={disabled}
          className={`
            w-full text-left p-4 rounded-lg border-2 transition-all
            ${disabled 
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
              : option.id === 'urgent'
                ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 hover:border-red-400 hover:shadow-md'
                : option.id === 'overwhelmed'
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 hover:border-yellow-400 hover:shadow-md'
                  : option.id === 'blank'
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400 hover:shadow-md'
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
                ${option.id === 'urgent' 
                  ? 'text-red-900' 
                  : option.id === 'overwhelmed' 
                    ? 'text-yellow-900' 
                    : option.id === 'blank'
                      ? 'text-purple-900'
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

