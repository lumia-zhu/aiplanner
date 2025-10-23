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
        <div className="text-sm text-gray-600 mb-1">Your Initial Estimate</div>
        <div className="text-2xl font-bold text-blue-600">{formatMinutes(estimateMinutes)}</div>
      </div>
      
      {/* Buffer说明 */}
      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-sm text-yellow-800">
          💡 <span className="font-semibold">Recommend adding 20% buffer time</span> (about {formatMinutes(bufferMinutes)}),
          this gives you more flexibility and reduces stress from unexpected situations.
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
              Yes, Add Buffer Time
            </h3>
            <p className="text-sm text-gray-700">
              Record as: <span className="font-semibold text-green-700">{formatMinutes(totalWithBuffer)} (with 20% buffer)</span>
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
              No Thanks, Use This Time
            </h3>
            <p className="text-sm text-gray-700">
              Record as: <span className="font-semibold text-blue-700">{formatMinutes(estimateMinutes)}</span>
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
          ← Re-estimate
        </button>
      </div>
    </div>
  )
}

