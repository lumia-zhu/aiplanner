'use client'

import React, { useState } from 'react'

interface DecompositionContextInputProps {
  taskTitle: string
  questions: string[]
  onSubmit: (userInput: string) => void | Promise<void>
  onSkip: () => void | Promise<void>
  isActive: boolean
}

/**
 * 任务拆解上下文输入卡片组件
 * 
 * 显示反思性问题，并提供：
 * - 输入框让用户回答
 * - "提交并生成"按钮
 * - "跳过问题"按钮
 */
export default function DecompositionContextInput({ 
  taskTitle,
  questions,
  onSubmit,
  onSkip,
  isActive 
}: DecompositionContextInputProps) {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async () => {
    if (!input.trim()) {
      alert('请输入内容或点击"跳过问题"按钮')
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
  
  const handleSkip = async () => {
    if (!window.confirm('确定跳过问题直接生成拆解建议吗？')) {
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSkip()
    } catch (error) {
      console.error('跳过失败:', error)
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
    <div className="my-2 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="flex-shrink-0 mt-1">
          <span className="text-2xl">✂️</span>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-blue-800 mb-1">
              正在拆解任务：{taskTitle}
            </h4>
            <p className="text-xs text-blue-600">
              💡 回答以下问题可以帮助我更好地拆解任务，或者你也可以跳过问题直接生成
            </p>
          </div>
          
          {/* 反思性问题 */}
          <div className="mb-3 p-3 bg-white rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-gray-700 mb-2">背景信息：</p>
            <ol className="text-sm text-gray-700 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="leading-relaxed">
                  {i + 1}. {q}
                </li>
              ))}
            </ol>
          </div>
          
          {/* 输入区域或已提交状态 */}
          {isActive ? (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请回答上述问题，也可以提供其他任何你知道的信息（可以自由描述）..."
                className="w-full p-3 border border-blue-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                rows={4}
                disabled={isSubmitting}
              />
              
              <div className="mt-3 flex items-center gap-2">
                {/* 提交按钮 */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !input.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      生成中...
                    </span>
                  ) : (
                    '✅ 提交并生成拆解'
                  )}
                </button>
                
                {/* 跳过按钮 */}
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ⏭️ 跳过问题
                </button>
              </div>
              
              <p className="mt-2 text-xs text-gray-500">
                💡 提示：Ctrl/Cmd + Enter 快速提交
              </p>
            </>
          ) : (
            <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600 border border-gray-300">
              ✅ 已提交，正在生成拆解建议...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


