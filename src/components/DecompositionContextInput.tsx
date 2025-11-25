'use client'

import React, { useState } from 'react'

interface DecompositionContextInputProps {
  taskTitle: string
  questions: string[]
  isActive?: boolean
  onSubmit: (userInput: string) => void
  onSkip: () => void
}

/**
 * 任务拆解上下文输入组件
 * 显示拆解问题，让用户提供上下文信息
 */
export default function DecompositionContextInput({
  taskTitle,
  questions,
  isActive = true,
  onSubmit,
  onSkip
}: DecompositionContextInputProps) {
  const [userInput, setUserInput] = useState('')

  const handleSubmit = () => {
    if (userInput.trim()) {
      onSubmit(userInput.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!isActive) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">✂️</span>
          <h4 className="font-medium text-gray-600">拆解「{taskTitle}」</h4>
        </div>
        <p className="text-sm text-gray-500">✅ 已完成</p>
      </div>
    )
  }

  return (
    <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✂️</span>
        <h4 className="font-medium text-purple-800">拆解「{taskTitle}」</h4>
      </div>
      
      {questions && questions.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">为了更好地拆解，请回答以下问题：</p>
          <ul className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-purple-500">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <textarea
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你的回答，或者直接跳过让 AI 自动拆解..."
        className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
        rows={3}
      />
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSubmit}
          disabled={!userInput.trim()}
          className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          提交并拆解
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors text-sm"
        >
          跳过，直接拆解
        </button>
      </div>
    </div>
  )
}

