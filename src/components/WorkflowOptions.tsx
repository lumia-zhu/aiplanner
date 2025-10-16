/**
 * 工作流选项按钮组件
 * 显示三个可选择的工作流操作按钮
 */

'use client'

import React from 'react'
import type { WorkflowOption } from '@/types'

interface WorkflowOptionsProps {
  onSelect: (optionId: 'A' | 'B' | 'C') => void
  disabled?: boolean
}

// 选项配置
const OPTIONS: WorkflowOption[] = [
  {
    id: 'A',
    label: '完善单个任务',
    description: '逐个澄清、拆解、估计时间',
    icon: '🔍'
  },
  {
    id: 'B',
    label: '对所有任务排序',
    description: '使用矩阵工具安排优先级',
    icon: '📊'
  },
  {
    id: 'C',
    label: '结束AI辅助',
    description: '我已经了解了',
    icon: '✅'
  }
]

/**
 * 工作流选项按钮组件
 */
export default function WorkflowOptions({ onSelect, disabled = false }: WorkflowOptionsProps) {
  return (
    <div className="space-y-2">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => !disabled && onSelect(option.id)}
          disabled={disabled}
          className={`
            w-full text-left p-4 rounded-lg border-2 transition-all
            ${disabled 
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
              : option.id === 'A'
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
                : option.id === 'B'
                  ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400 hover:shadow-md'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-400 hover:shadow-md'
            }
          `}
        >
          <div className="flex items-start gap-3">
            {/* 图标 */}
            <div className="flex-shrink-0 text-2xl mt-0.5">
              {option.icon}
            </div>
            
            {/* 文本内容 */}
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-sm font-semibold mb-1
                ${option.id === 'A' 
                  ? 'text-blue-900' 
                  : option.id === 'B' 
                    ? 'text-purple-900' 
                    : 'text-green-900'
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

