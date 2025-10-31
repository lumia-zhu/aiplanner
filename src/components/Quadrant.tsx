/**
 * 象限组件
 * 显示四象限矩阵中的单个象限
 * 包含标题、描述、任务列表
 */

'use client'

import TaskCard from './TaskCard'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '@/types'
import type { TaskMatrixQuadrantConfig } from '@/types'

// ============================================
// 类型定义
// ============================================

interface QuadrantProps {
  config: TaskMatrixQuadrantConfig        // 象限配置（标题、颜色等）
  tasks: Task[]                           // 象限内的任务列表
  onTaskComplete: (id: string) => void    // 任务完成回调
  quadrantId: string                      // 象限ID（用于拖拽放置）
}

// ============================================
// 主组件
// ============================================

export default function Quadrant({ 
  config, 
  tasks, 
  onTaskComplete,
  quadrantId,
}: QuadrantProps) {
  
  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: quadrantId,
  })
  
  // 任务ID列表（用于 SortableContext）
  const taskIds = tasks.map(t => t.id)
  
  return (
    <div 
      ref={setNodeRef}
      className={`
        rounded-xl border-2 p-4 flex flex-col overflow-hidden transition-all duration-200
        ${isOver ? 'ring-4 ring-blue-400 ring-opacity-50 scale-[1.02]' : ''}
      `}
      style={{
        backgroundColor: config.bgColor,
        borderColor: isOver ? '#3b82f6' : config.borderColor,
      }}
    >
      {/* 象限标题 */}
      <div className="flex items-start gap-2.5 mb-3 pb-3 border-b-2" style={{ borderColor: config.borderColor }}>
        {/* 图标 */}
        <span className="text-2xl">{config.icon}</span>
        
        {/* 标题和描述 */}
        <div className="flex-1 min-w-0">
          <h3 
            className="text-sm font-bold mb-0.5 leading-tight"
            style={{ color: config.color }}
          >
            {config.title}
          </h3>
          <p className="text-xs text-gray-600 leading-snug">
            {config.description}
          </p>
        </div>
        
        {/* 任务数量徽章 */}
        {tasks.length > 0 && (
          <div 
            className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full"
            style={{ 
              backgroundColor: config.color + '20',
              color: config.color,
            }}
          >
            {tasks.length}
          </div>
        )}
      </div>
      
      {/* 任务列表 */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={{
                  id: task.id,
                  title: task.title,
                  isCompleted: task.completed,
                }}
                onComplete={onTaskComplete}
              />
            ))
          ) : (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-3xl mb-2 opacity-30">{config.icon}</div>
            <p className="text-xs text-gray-400">
              暂无任务
            </p>
            <p className="text-xs text-gray-400 mt-1">
              拖动任务到此处
            </p>
          </div>
        )}
        </div>
      </SortableContext>
    </div>
  )
}


