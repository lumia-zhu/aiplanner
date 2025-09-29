'use client'

import React, { useState, useEffect } from 'react'
import type { Task, SubtaskSuggestion } from '@/types'
import { doubaoService } from '@/lib/doubaoService'
import { parseDecompositionResponse, validateSubtaskSuggestions } from '@/utils/taskDecomposition'

interface TaskDecompositionModalProps {
  isOpen: boolean
  onClose: () => void
  parentTask: Task
  onConfirm: (selectedSubtasks: SubtaskSuggestion[]) => void
}

export default function TaskDecompositionModal({
  isOpen,
  onClose,
  parentTask,
  onConfirm
}: TaskDecompositionModalProps) {
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<SubtaskSuggestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingMessage, setStreamingMessage] = useState('')

  // 生成子任务建议
  const generateSubtasks = async () => {
    if (!doubaoService.hasApiKey()) {
      setError('请先配置AI API密钥')
      return
    }

    setIsGenerating(true)
    setError(null)
    setStreamingMessage('')

    try {
      const response = await doubaoService.decomposeTask(
        parentTask.title,
        parentTask.description,
        (chunk: string) => {
          setStreamingMessage(prev => prev + chunk)
        }
      )

      if (response.success && response.message) {
        const suggestions = parseDecompositionResponse(response.message)
        const validation = validateSubtaskSuggestions(suggestions)
        
        if (validation.isValid) {
          setSubtaskSuggestions(validation.validSuggestions)
          setIsEditing(true)
        } else {
          console.warn('子任务验证警告:', validation.errors)
          setSubtaskSuggestions(validation.validSuggestions)
          setIsEditing(true)
          if (validation.errors.length > 0) {
            setError(`生成的子任务存在问题：${validation.errors.join(', ')}`)
          }
        }
      } else {
        setError(response.error || '生成子任务失败')
      }
    } catch (error) {
      console.error('任务拆解失败:', error)
      setError('任务拆解过程中出现错误')
    } finally {
      setIsGenerating(false)
      setStreamingMessage('')
    }
  }

  // 重置状态
  const resetState = () => {
    setSubtaskSuggestions([])
    setIsGenerating(false)
    setIsEditing(false)
    setError(null)
    setStreamingMessage('')
  }

  // 组件打开时自动生成子任务
  useEffect(() => {
    if (isOpen && subtaskSuggestions.length === 0) {
      generateSubtasks()
    }
  }, [isOpen])

  // 关闭模态框
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 更新子任务
  const updateSubtask = (index: number, updates: Partial<SubtaskSuggestion>) => {
    setSubtaskSuggestions(prev => 
      prev.map((task, i) => i === index ? { ...task, ...updates } : task)
    )
  }

  // 删除子任务
  const removeSubtask = (index: number) => {
    setSubtaskSuggestions(prev => prev.filter((_, i) => i !== index))
  }

  // 添加新子任务
  const addSubtask = () => {
    const newSubtask: SubtaskSuggestion = {
      id: `new_${Date.now()}`,
      title: '',
      description: '', // 保持字段但不显示
      priority: 'medium',
      estimated_duration: '',
      is_selected: true,
      order: subtaskSuggestions.length + 1
    }
    setSubtaskSuggestions(prev => [...prev, newSubtask])
  }

  // 确认选择的子任务
  const handleConfirm = () => {
    const selectedSubtasks = subtaskSuggestions.filter(task => task.is_selected)
    if (selectedSubtasks.length === 0) {
      setError('请至少选择一个子任务')
      return
    }

    // 重新排序选中的子任务
    const orderedSubtasks = selectedSubtasks
      .sort((a, b) => a.order - b.order)
      .map((task, index) => ({ ...task, order: index + 1 }))

    onConfirm(orderedSubtasks)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 模态框头部 */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">🔧 任务拆解</h2>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 父任务信息 */}
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-medium text-gray-900 mb-1">原任务</h3>
          <p className="text-gray-700 font-medium">{parentTask.title}</p>
          {parentTask.description && (
            <p className="text-gray-600 text-sm mt-1">{parentTask.description}</p>
          )}
        </div>

        {/* 主要内容区域 */}
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* 生成中状态 */}
          {isGenerating && (
            <div className="text-center py-8">
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600">AI正在智能拆解任务...</span>
              </div>
              {streamingMessage && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left max-w-2xl mx-auto">
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{streamingMessage}</div>
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <span className="text-red-600 mr-2">⚠️</span>
                <span className="text-red-700">{error}</span>
              </div>
              <button
                onClick={generateSubtasks}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                重新生成
              </button>
            </div>
          )}

          {/* 子任务列表 */}
          {isEditing && subtaskSuggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  子任务建议 ({subtaskSuggestions.filter(t => t.is_selected).length} 个已选择)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={addSubtask}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    + 添加子任务
                  </button>
                  <button
                    onClick={generateSubtasks}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    🔄 重新生成
                  </button>
                </div>
              </div>

              {subtaskSuggestions.map((subtask, index) => (
                <div
                  key={subtask.id}
                  className={`border rounded-lg p-4 transition-all ${
                    subtask.is_selected 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 选择框 */}
                    <input
                      type="checkbox"
                      checked={subtask.is_selected}
                      onChange={(e) => updateSubtask(index, { is_selected: e.target.checked })}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />

                    <div className="flex-1 space-y-3">
                      {/* 标题输入 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          任务标题 *
                        </label>
                        <input
                          type="text"
                          value={subtask.title}
                          onChange={(e) => updateSubtask(index, { title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                          placeholder="输入子任务标题..."
                        />
                      </div>

                      {/* 描述输入已移除，界面更简洁 */}

                      {/* 预估时长 */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            预估时长
                          </label>
                          <input
                            type="text"
                            value={subtask.estimated_duration || ''}
                            onChange={(e) => updateSubtask(index, { estimated_duration: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                            placeholder="如：2小时、30分钟"
                          />
                        </div>

                        <div className="flex-shrink-0 flex items-end">
                          <button
                            onClick={() => removeSubtask(index)}
                            className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            title="删除此子任务"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* 排序 */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>执行顺序：</span>
                        <input
                          type="number"
                          min="1"
                          value={subtask.order}
                          onChange={(e) => updateSubtask(index, { order: parseInt(e.target.value) || 1 })}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        {isEditing && (
          <div className="border-t bg-gray-50 px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              已选择 {subtaskSuggestions.filter(t => t.is_selected).length} 个子任务
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={subtaskSuggestions.filter(t => t.is_selected).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                确认创建子任务
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
