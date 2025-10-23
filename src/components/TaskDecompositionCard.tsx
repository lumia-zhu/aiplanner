'use client'

import React, { useState } from 'react'
import type { Task, SubtaskSuggestion } from '@/types'

interface TaskDecompositionCardProps {
  parentTask: Task
  suggestions: SubtaskSuggestion[]
  isActive?: boolean
  onConfirm: (subtasks: SubtaskSuggestion[]) => void
  onCancel: () => void
}

/**
 * 任务拆解交互式卡片
 * 在聊天流中展示任务拆解建议，用户可以编辑、删除、添加子任务
 */
export default function TaskDecompositionCard({
  parentTask,
  suggestions,
  isActive = true,
  onConfirm,
  onCancel,
}: TaskDecompositionCardProps) {
  const [subtasks, setSubtasks] = useState<SubtaskSuggestion[]>(suggestions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // 开始编辑
  const handleStartEdit = (subtask: SubtaskSuggestion) => {
    setEditingId(subtask.id)
    setEditingTitle(subtask.title)
  }

  // 保存编辑
  const handleSaveEdit = (id: string) => {
    if (editingTitle.trim()) {
      setSubtasks(prev =>
        prev.map(st => (st.id === id ? { ...st, title: editingTitle.trim() } : st))
      )
    }
    setEditingId(null)
    setEditingTitle('')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  // 删除子任务
  const handleDelete = (id: string) => {
    setSubtasks(prev => prev.filter(st => st.id !== id))
  }

  // 上移
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newSubtasks = [...subtasks]
    ;[newSubtasks[index - 1], newSubtasks[index]] = [newSubtasks[index], newSubtasks[index - 1]]
    // 更新 order
    newSubtasks.forEach((st, i) => {
      st.order = i + 1
    })
    setSubtasks(newSubtasks)
  }

  // 下移
  const handleMoveDown = (index: number) => {
    if (index === subtasks.length - 1) return
    const newSubtasks = [...subtasks]
    ;[newSubtasks[index], newSubtasks[index + 1]] = [newSubtasks[index + 1], newSubtasks[index]]
    // 更新 order
    newSubtasks.forEach((st, i) => {
      st.order = i + 1
    })
    setSubtasks(newSubtasks)
  }

  // 添加新子任务
  const handleAddNew = () => {
    if (newTaskTitle.trim()) {
      const newSubtask: SubtaskSuggestion = {
        id: `new-${Date.now()}`,
        title: newTaskTitle.trim(),
        order: subtasks.length + 1,
      }
      setSubtasks(prev => [...prev, newSubtask])
      setNewTaskTitle('')
      setIsAddingNew(false)
    }
  }

  // 确认添加
  const handleConfirm = () => {
    if (subtasks.length > 0) {
      onConfirm(subtasks)
    }
  }

  return (
    <div
      className={`border-2 rounded-lg p-4 my-2 transition-all ${
        isActive
          ? 'border-blue-300 bg-blue-50 shadow-md'
          : 'border-gray-300 bg-gray-100 opacity-60'
      }`}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📋</span>
        <h4 className="font-semibold text-gray-800">Task Decomposition Suggestions</h4>
      </div>

      {/* 父任务信息 */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
        <p className="text-sm text-gray-600 mb-1">Parent Task:</p>
        <p className="font-medium text-gray-900">{parentTask.title}</p>
      </div>

      {/* 子任务列表 */}
      <div className="space-y-2 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Subtask List ({subtasks.length}):
        </p>
        
        {subtasks.map((subtask, index) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            {/* 序号 */}
            <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>

            {/* 标题（编辑模式或显示模式） */}
            {editingId === subtask.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(subtask.id)
                  if (e.key === 'Escape') handleCancelEdit()
                }}
                className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
                disabled={!isActive}
              />
            ) : (
              <p className="flex-1 text-sm text-gray-800">{subtask.title}</p>
            )}

            {/* 操作按钮 */}
            {isActive && (
              <div className="flex items-center gap-1">
                {editingId === subtask.id ? (
                  <>
                    {/* 保存 */}
                    <button
                      onClick={() => handleSaveEdit(subtask.id)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="保存"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    {/* 取消 */}
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    {/* 上移 */}
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="上移"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    {/* 下移 */}
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === subtasks.length - 1}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="下移"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* 编辑 */}
                    <button
                      onClick={() => handleStartEdit(subtask)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="编辑"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* 删除 */}
                    <button
                      onClick={() => handleDelete(subtask.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="删除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 添加新子任务 */}
      {isActive && (
        <div className="mb-4">
          {isAddingNew ? (
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border-2 border-green-300">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNew()
                  if (e.key === 'Escape') {
                    setIsAddingNew(false)
                    setNewTaskTitle('')
                  }
                }}
                placeholder="输入新子任务标题..."
                className="flex-1 px-2 py-1 border-none focus:outline-none text-sm"
                autoFocus
              />
              <button
                onClick={handleAddNew}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setIsAddingNew(false)
                  setNewTaskTitle('')
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
            >
              + Add New Subtask
            </button>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      {isActive ? (
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={subtasks.length === 0}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Confirm Add ({subtasks.length})
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-2">
          ✅ Confirmed
        </div>
      )}
    </div>
  )
}










