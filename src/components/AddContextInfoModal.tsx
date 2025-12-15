'use client'

import { useState, useEffect } from 'react'
import { extractContextFromQA } from '@/lib/contextExtractionService'
import { createContextInfo } from '@/lib/taskContextService'
import type { QuestionAnswerPair } from '@/types/task-context'

interface Task {
  id: string
  title: string
}

interface AddContextInfoModalProps {
  isOpen: boolean
  onClose: () => void
  questionAnswer: QuestionAnswerPair
  defaultTaskId: string
  availableTasks: Task[]
  source: string  // 'clarity-reflection', 'time-reflection' 等
  onSuccess?: (addedContent: string, taskId: string) => void  // 🔧 返回添加的内容和任务ID
}

export default function AddContextInfoModal({
  isOpen,
  onClose,
  questionAnswer,
  defaultTaskId,
  availableTasks,
  source,
  onSuccess
}: AddContextInfoModalProps) {
  const [extractedContent, setExtractedContent] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState(defaultTaskId)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')

  // 当弹窗打开时，自动调用 LLM 提取
  useEffect(() => {
    if (isOpen && questionAnswer) {
      extractContent()
    }
  }, [isOpen, questionAnswer])

  // 更新选中的任务ID
  useEffect(() => {
    setSelectedTaskId(defaultTaskId)
  }, [defaultTaskId])

  const extractContent = async () => {
    setExtracting(true)
    setError('')

    try {
      const result = await extractContextFromQA(
        questionAnswer.question,
        questionAnswer.answer
      )
      setExtractedContent(result.content)
      setEditableContent(result.content)
    } catch (err: any) {
      console.error('提取失败:', err)
      setError('提取失败，使用原始答案')
      setExtractedContent(questionAnswer.answer)
      setEditableContent(questionAnswer.answer)
    } finally {
      setExtracting(false)
    }
  }

  const handleConfirm = async () => {
    if (!editableContent.trim()) {
      setError('内容不能为空')
      return
    }

    if (!selectedTaskId) {
      setError('请选择任务')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 🔧 验证 taskId 是否为有效的 UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(selectedTaskId)) {
        throw new Error(`无效的任务ID格式: ${selectedTaskId}。请从下拉列表中选择一个有效的任务。`)
      }

      await createContextInfo({
        task_id: selectedTaskId,
        content: editableContent.trim(),
        source: source,
        source_question: questionAnswer.question,
        source_answer: questionAnswer.answer
      })

      // 成功后关闭弹窗并通知父组件
      onClose()
      if (onSuccess) {
        onSuccess(editableContent.trim(), selectedTaskId)  // 🔧 传递添加的内容和任务ID
      }
    } catch (err: any) {
      console.error('添加失败:', err)
      setError(err.message || '添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      // 清空状态
      setExtractedContent('')
      setEditableContent('')
      setError('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            📝 添加上下文信息到任务
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 原始问答 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">📌 原始问答</h3>
            <div className="bg-gray-50 p-4 rounded-md space-y-2">
              <div>
                <p className="text-xs text-gray-500">问题：</p>
                <p className="text-sm text-gray-700">{questionAnswer.question}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">回答：</p>
                <p className="text-sm text-gray-700">{questionAnswer.answer}</p>
              </div>
            </div>
          </div>

          {/* 提取的信息 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              ✨ 提取的关键信息（可编辑）
            </h3>
            {extracting ? (
              <div className="bg-blue-50 p-4 rounded-md text-center">
                <p className="text-blue-600">🤖 正在调用 LLM 提取关键信息...</p>
              </div>
            ) : (
              <div>
                <textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  rows={3}
                  placeholder="编辑提取的信息..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editableContent.length} 字
                  {extractedContent !== editableContent && (
                    <span className="text-orange-600 ml-2">（已修改）</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* 选择任务 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">🎯 添加到任务</h3>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={loading || extracting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
              ❌ {error}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || extracting || !editableContent.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ 添加中...' : '✅ 确认添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

