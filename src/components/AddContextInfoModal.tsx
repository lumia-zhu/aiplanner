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
  questionAnswer?: QuestionAnswerPair  // 单个问答（可选）
  questionAnswers?: QuestionAnswerPair[]  // 多个问答（可选，批量添加时使用）
  defaultTaskId: string  // 现在是任务标题
  availableTasks: Task[]  // 现在 id 就是任务标题
  source: string  // 'clarity-reflection', 'time-reflection' 等
  onSuccess?: (addedContent: string, taskTitle: string, contextId: string) => void  // 🔧 返回添加的内容、任务标题和上下文ID
}

export default function AddContextInfoModal({
  isOpen,
  onClose,
  questionAnswer,
  questionAnswers,  // 🆕 多个问答
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
  
  // 🆕 判断是单个还是批量
  const isBatchMode = !!questionAnswers && questionAnswers.length > 0

  // 当弹窗打开时，自动调用 LLM 提取
  useEffect(() => {
    if (isOpen) {
      if (isBatchMode) {
        extractMultipleQA()
      } else if (questionAnswer) {
        extractContent()
      }
    }
  }, [isOpen, questionAnswer, questionAnswers])

  // 更新选中的任务ID
  useEffect(() => {
    console.log('🔄 更新 selectedTaskId:', defaultTaskId)
    console.log('  - availableTasks:', availableTasks)
    setSelectedTaskId(defaultTaskId)
  }, [defaultTaskId, availableTasks])

  const extractContent = async () => {
    setExtracting(true)
    setError('')

    try {
      const result = await extractContextFromQA(
        questionAnswer!.question,
        questionAnswer!.answer
      )
      setExtractedContent(result.content)
      setEditableContent(result.content)
    } catch (err: any) {
      console.error('提取失败:', err)
      setError('提取失败，使用原始答案')
      setExtractedContent(questionAnswer!.answer)
      setEditableContent(questionAnswer!.answer)
    } finally {
      setExtracting(false)
    }
  }
  
  // 🆕 批量提取并整合多个问答
  const extractMultipleQA = async () => {
    setExtracting(true)
    setError('')

    try {
      console.log('📦 开始整合提取:', questionAnswers)
      
      // 调用整合提取API（下一步实现）
      const { extractContextFromMultipleQA } = await import('@/lib/contextExtractionService')
      const result = await extractContextFromMultipleQA(questionAnswers!)
      
      setExtractedContent(result.content)
      setEditableContent(result.content)
      console.log('✅ 整合提取成功:', result.content)
    } catch (err: any) {
      console.error('整合提取失败:', err)
      setError('提取失败，使用原始答案拼接')
      
      // 兜底：简单拼接所有答案
      const fallback = questionAnswers!
        .map((qa, i) => `${i + 1}) ${qa.answer}`)
        .join(' ')
      setExtractedContent(fallback)
      setEditableContent(fallback)
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
      console.log('🔍 调试信息:')
      console.log('  - selectedTaskId:', selectedTaskId)
      console.log('  - availableTasks:', availableTasks)
      console.log('  - defaultTaskId:', defaultTaskId)
      
      // 🔧 根据任务标题查找真实的任务ID
      const taskTitle = selectedTaskId  // selectedTaskId 现在就是任务标题
      console.log('  - 准备查询的任务标题:', taskTitle)
      
      const supabase = (await import('@/lib/supabase-client')).createClient()
      
      const { data: dailyTasks, error: queryError } = await supabase
        .from('daily_tasks')
        .select('id, title')
        .eq('title', taskTitle)
        .limit(1)
      
      console.log('  - 查询结果:', { dailyTasks, queryError })
      
      if (queryError) {
        throw new Error(`查询任务失败: ${queryError.message}`)
      }
      
      if (!dailyTasks || dailyTasks.length === 0) {
        throw new Error(`找不到任务"${taskTitle}"，请确保任务已保存到数据库`)
      }
      
      const realTaskId = dailyTasks[0].id
      console.log('  - 找到真实任务ID:', realTaskId)

      const createdContext = await createContextInfo({
        task_id: realTaskId,
        content: editableContent.trim(),
        source: source,
        // 🔧 如果是批量模式，保存所有问答的JSON；否则保存单个问答
        source_question: isBatchMode
          ? JSON.stringify(questionAnswers!.map(qa => qa.question))
          : questionAnswer?.question,
        source_answer: isBatchMode
          ? JSON.stringify(questionAnswers!.map(qa => qa.answer))
          : questionAnswer?.answer
      })

      console.log('✅ 上下文信息创建成功, ID:', createdContext.id)

      // 成功后关闭弹窗并通知父组件
      onClose()
      if (onSuccess) {
        onSuccess(editableContent.trim(), taskTitle, createdContext.id)  // 🔧 传递添加的内容、任务标题和上下文ID
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
          {/* 原始问答 - 区分单个和批量模式 */}
          {isBatchMode ? (
            /* 批量模式：折叠显示多个问答 */
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                📌 原始问答 ({questionAnswers!.length}条)
              </h3>
              <details className="bg-gray-50 border border-gray-200 rounded-md">
                <summary className="cursor-pointer text-xs text-gray-600 p-3 hover:bg-gray-100 transition-colors">
                  点击展开查看详细问答 ▼
                </summary>
                <div className="p-3 pt-2 space-y-3 border-t border-gray-200">
                  {questionAnswers!.map((qa, i) => (
                    <div key={i} className="pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                      <div className="mb-1.5">
                        <p className="text-xs text-gray-500">问题 {i + 1}：</p>
                        <p className="text-sm text-gray-700">{qa.question}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">回答 {i + 1}：</p>
                        <p className="text-sm text-gray-700">{qa.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : (
            /* 单个模式：原有显示方式 */
            questionAnswer && (
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
            )
          )}

          {/* 提取的信息 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {isBatchMode ? '✨ 整合的上下文信息（可编辑）' : '✨ 提取的关键信息（可编辑）'}
            </h3>
            {extracting ? (
              <div className="bg-blue-50 p-4 rounded-md text-center">
                <p className="text-blue-600">
                  {isBatchMode ? '🤖 正在整合提取关键信息...' : '🤖 正在调用 LLM 提取关键信息...'}
                </p>
              </div>
            ) : (
              <div>
                <textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  rows={isBatchMode ? 6 : 3}
                  placeholder={isBatchMode ? '整合后的上下文信息...' : '编辑提取的信息...'}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900"
            >
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id} className="text-gray-900">
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

