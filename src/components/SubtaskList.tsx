'use client'

import React from 'react'
import type { Task } from '@/types'
import TaskItem from './TaskItem'

interface SubtaskListProps {
  parentTask: Task
  subtasks: Task[]
  isExpanded: boolean
  onToggleExpansion: (taskId: string, isExpanded: boolean) => void
  onToggleComplete: (taskId: string, completed: boolean) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onDecompose: (task: Task) => void
  onPromoteSubtasks?: (parentId: string) => void  // 新增：提升子任务为独立任务
}

export default function SubtaskList({
  parentTask,
  subtasks,
  isExpanded,
  onToggleExpansion,
  onToggleComplete,
  onEdit,
  onDelete,
  onDecompose,
  onPromoteSubtasks
}: SubtaskListProps) {
  if (!subtasks || subtasks.length === 0) {
    return null
  }

  // 处理提升子任务的点击事件
  const handlePromoteClick = () => {
    if (!onPromoteSubtasks) return
    
    // 简单的确认提示，避免误操作
    const confirmed = window.confirm(
      `确定要将所有 ${subtasks.length} 个子任务提升为独立任务吗？\n\n` +
      `提升后，这些子任务将变成当天的普通任务，不再与"${parentTask.title}"关联。`
    )
    
    if (confirmed) {
      onPromoteSubtasks(parentTask.id)
    }
  }

  return (
    <div className="mt-2">
      {/* 展开/收起按钮 */}
      <button
        onClick={() => onToggleExpansion(parentTask.id, !isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-2 transition-colors"
      >
        <span className={`transform transition-transform duration-200 ease-in-out ${
          isExpanded ? 'rotate-90' : 'rotate-0'
        }`}>
          ▶️
        </span>
        <span>
          {subtasks.length} 个子任务 {isExpanded ? '(点击收起)' : '(点击展开)'}
        </span>
      </button>

      {/* 子任务列表 - 使用动画过渡 */}
      <div className={`
        ml-6 border-l-2 border-gray-200 pl-4
        transition-all duration-200 ease-in-out overflow-hidden
        ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="space-y-2">
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
                    onChange={(e) => {
                      const newCompleted = e.target.checked;
                      onToggleComplete(subtask.id, newCompleted);
                    }}
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

          {/* 子任务统计和提升按钮 */}
          <div className="text-xs text-gray-500 mt-3 flex items-center justify-between gap-4">
            {/* 左侧：统计信息 */}
            <div className="flex items-center gap-4">
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

            {/* 右侧：提升按钮 */}
            {onPromoteSubtasks && (
              <button
                onClick={handlePromoteClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-300 hover:border-blue-400 text-blue-700 hover:text-blue-900 rounded-lg transition-all text-xs font-medium shadow-sm hover:shadow whitespace-nowrap"
                title="将所有子任务转换为独立的普通任务"
              >
                <span>⬆️</span>
                <span>全部提升为独立任务</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
