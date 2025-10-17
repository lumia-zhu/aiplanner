'use client'

import React from 'react'
import { formatMinutes, calculateBuffer } from '@/utils/timeEstimation'

interface EstimationConfirmOptionsProps {
  estimateMinutes: number
  onConfirmWithBuffer: () => void
  onConfirmWithoutBuffer: () => void
  onCancel: () => void
  disabled?: boolean
}

export default function EstimationConfirmOptions({
  estimateMinutes,
  onConfirmWithBuffer,
  onConfirmWithoutBuffer,
  onCancel,
  disabled = false
}: EstimationConfirmOptionsProps) {
  const bufferMinutes = calculateBuffer(estimateMinutes)
  const totalWithBuffer = estimateMinutes + bufferMinutes
  
  return (
    <div className="space-y-3">
      {/* 时间显示 */}
      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="text-sm text-gray-600 mb-1">你的初始估计</div>
        <div className="text-2xl font-bold text-blue-600">{formatMinutes(estimateMinutes)}</div>
      </div>
      
      {/* Buffer说明 */}
      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-sm text-yellow-800">
          💡 <span className="font-semibold">建议加上20%缓冲时间</span>（约{formatMinutes(bufferMinutes)}），
          这样更从容，不会因为意外情况而焦虑。
        </p>
      </div>
      
      {/* 选项按钮 */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => !disabled && onConfirmWithBuffer()}
          disabled={disabled}
          className={`
            w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-3
            ${disabled
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:border-green-500 hover:shadow-md'
            }
          `}
        >
          <div className="flex-shrink-0 text-2xl">✅</div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1 text-green-900">
              好的，加上缓冲时间
            </h3>
            <p className="text-sm text-gray-700">
              记录为：<span className="font-semibold text-green-700">{totalWithBuffer}分钟（含20%缓冲）</span>
            </p>
          </div>
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onConfirmWithoutBuffer()}
          disabled={disabled}
          className={`
            w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-3
            ${disabled
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-blue-50 to-sky-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
            }
          `}
        >
          <div className="flex-shrink-0 text-2xl">⏱️</div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1 text-blue-900">
              不用了，就这个时间
            </h3>
            <p className="text-sm text-gray-700">
              记录为：<span className="font-semibold text-blue-700">{estimateMinutes}分钟</span>
            </p>
          </div>
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <button
          type="button"
          onClick={() => !disabled && onCancel()}
          disabled={disabled}
          className={`
            w-full px-4 py-2 rounded-lg border transition-all text-sm
            ${disabled
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
            }
          `}
        >
          ← 重新估算
        </button>
      </div>
    </div>
  )
}

