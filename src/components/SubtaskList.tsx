'use client'

import React from 'react'
import type { Task } from '@/types'
import TaskItem from './TaskItem'

interface SubtaskListProps {
  parentTask: Task
  subtasks: Task[]
  isExpanded: boolean
  onToggleExpansion: (taskId: string, isExpanded: boolean) => void
  onToggleComplete: (taskId: string) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onDecompose: (task: Task) => void
}

export default function SubtaskList({
  parentTask,
  subtasks,
  isExpanded,
  onToggleExpansion,
  onToggleComplete,
  onEdit,
  onDelete,
  onDecompose
}: SubtaskListProps) {
  if (!subtasks || subtasks.length === 0) {
    return null
  }

  return (
    <div className="mt-2">
      {/* 展开/收起按钮 */}
      <button
        onClick={() => onToggleExpansion(parentTask.id, !isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-2 transition-colors"
      >
        <span className="transform transition-transform duration-200 ease-in-out">
          {isExpanded ? '🔽' : '▶️'}
        </span>
        <span>
          {subtasks.length} 个子任务 {isExpanded ? '(点击收起)' : '(点击展开)'}
        </span>
      </button>

      {/* 子任务列表 */}
      {isExpanded && (
        <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
          {subtasks.map((subtask, index) => (
            <div key={subtask.id} className="relative">
              {/* 连接线 */}
              <div className="absolute -left-4 top-4 w-3 h-px bg-gray-300"></div>
              
              {/* 子任务项 */}
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                <div className="flex items-center gap-3">
                  {/* 子任务序号 */}
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {subtask.subtask_order || index + 1}
                  </div>

                  {/* 完成状态 */}
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => onToggleComplete(subtask.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />

                  {/* 任务内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-medium ${
                        subtask.completed ? 'line-through text-gray-500' : 'text-gray-900'
                      }`}>
                        {subtask.title}
                      </h4>
                      
                      {/* 优先级标识已移除 */}

                      {/* 预估时长 */}
                      {subtask.estimated_duration && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          ⏱️ {subtask.estimated_duration}
                        </span>
                      )}
                    </div>

                    {/* 子任务描述已移除，界面更简洁 */}

                    {/* 截止时间 */}
                    {subtask.deadline_datetime && (
                      <div className="text-xs text-gray-500 mt-1">
                        📅 {new Date(subtask.deadline_datetime).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => onEdit(subtask)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="编辑子任务"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(subtask.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除子任务"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 子任务统计 */}
          <div className="text-xs text-gray-500 mt-3 flex items-center gap-4">
            <span>
              ✅ 已完成: {subtasks.filter(t => t.completed).length}
            </span>
            <span>
              📋 总计: {subtasks.length}
            </span>
            <span>
              📊 进度: {subtasks.length > 0 
                ? Math.round((subtasks.filter(t => t.completed).length / subtasks.length) * 100)
                : 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
