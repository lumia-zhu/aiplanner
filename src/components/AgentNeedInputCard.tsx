'use client'

import React, { useState } from 'react'
import type { AgentNeedInputData } from '@/lib/doubaoService'

interface AgentNeedInputCardProps {
  data: AgentNeedInputData
  onSubmit: (userInput: string) => void | Promise<void>
  isActive: boolean
}

/**
 * Agent 需要输入卡片组件
 * 
 * 用于交互式工具（如 clarify_task、decompose_task）
 * - 黄色主题，醒目，表示"需要操作"
 * - 显示工具请求的提示信息
 * - 提供多行文本输入框
 * - 提交后禁用，避免重复提交
 * - 显示加载状态
 */
export default function AgentNeedInputCard({ 
  data, 
  onSubmit, 
  isActive 
}: AgentNeedInputCardProps) {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async () => {
    if (!input.trim()) {
      alert('请输入内容')
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSubmit(input)
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  return (
    <div className="my-2 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg animate-fade-in">
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="flex-shrink-0 mt-1">
          <svg 
            className="w-6 h-6 text-yellow-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
            />
          </svg>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-yellow-800">
              ⏸️ Agent 需要您的输入
            </span>
            <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">
              {data.toolName}
            </span>
          </div>
          
          {/* 提示信息 */}
          <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap leading-relaxed">
            {data.prompt}
          </p>
          
          {/* 输入区域或已提交状态 */}
          {isActive ? (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={data.placeholder || '请输入您的回答...'}
                className="w-full p-3 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none transition-all"
                rows={4}
                disabled={isSubmitting}
              />
              
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  💡 提示：Ctrl/Cmd + Enter 快速提交
                </span>
                
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !input.trim()}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      提交中...
                    </span>
                  ) : (
                    '✅ 提交并继续'
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600 border border-gray-300">
              ✅ 已提交
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


