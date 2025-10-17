/**
 * 任务澄清确认/修正选项组件
 * 在AI生成理解总结后显示，让用户选择确认或重新描述
 */

'use client'

import React from 'react'

interface ClarificationConfirmOptionsProps {
  onConfirm: () => void
  onReject: () => void
  disabled?: boolean
}

export default function ClarificationConfirmOptions({ 
  onConfirm, 
  onReject,
  disabled = false 
}: ClarificationConfirmOptionsProps) {
  return (
    <div className="flex gap-2 mt-3">
      {/* 确认按钮 */}
      <button
        type="button"
        onClick={() => !disabled && onConfirm()}
        disabled={disabled}
        className={`
          flex-1 px-4 py-2.5 rounded-lg border-2 transition-all
          flex items-center justify-center gap-2
          ${disabled 
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-400 hover:shadow-md'
          }
        `}
      >
        <span className="text-lg">✅</span>
        <span className="text-sm font-semibold text-green-900">
          确认，就是这样
        </span>
      </button>

      {/* 重新描述按钮 */}
      <button
        type="button"
        onClick={() => !disabled && onReject()}
        disabled={disabled}
        className={`
          flex-1 px-4 py-2.5 rounded-lg border-2 transition-all
          flex items-center justify-center gap-2
          ${disabled 
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
            : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400 hover:shadow-md'
          }
        `}
      >
        <span className="text-lg">✏️</span>
        <span className="text-sm font-semibold text-gray-900">
          重新描述
        </span>
      </button>
    </div>
  )
}


