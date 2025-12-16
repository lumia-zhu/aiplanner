/**
 * 象限组件
 * 显示四象限矩阵中的单个象限
 * 包含标题、描述、任务列表
 * 支持父子任务层级显示
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

// 扩展 Task 类型，包含层级信息
interface HierarchicalTask extends Task {
  depth?: number
  parentTaskId?: string | null
}

interface QuadrantProps {
  config: TaskMatrixQuadrantConfig             // 象限配置（标题、颜色等）
  tasks: HierarchicalTask[]                    // 象限内的任务列表
  onTaskComplete: (id: string) => void         // 任务完成回调
  quadrantId: string                           // 象限ID（用于拖拽放置）
  collapsedTasks?: Set<string>                 // 折叠的父任务ID集合
  onToggleCollapse?: (taskId: string) => void  // 切换折叠状态回调
}

// ============================================
// 主组件
// ============================================

export default function Quadrant({ 
  config, 
  tasks, 
  onTaskComplete,
  quadrantId,
  collapsedTasks = new Set(),
  onToggleCollapse,
}: QuadrantProps) {
  
  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: quadrantId,
  })
  
  // 🆕 处理层级显示逻辑
  // 1. 找出所有父任务（depth=0 或无 parentTaskId）
  const parentTasks = tasks.filter(t => (t.depth ?? 0) === 0)
  
  // 2. 为每个父任务找到其子任务
  const childTasksMap = new Map<string, HierarchicalTask[]>()
  tasks.forEach(task => {
    if ((task.depth ?? 0) > 0 && task.parentTaskId) {
      const children = childTasksMap.get(task.parentTaskId) || []
      children.push(task)
      childTasksMap.set(task.parentTaskId, children)
    }
  })
  
  // 3. 生成扁平化的显示任务列表（考虑折叠状态）
  const displayTasks: HierarchicalTask[] = []
  parentTasks.forEach(parent => {
    displayTasks.push(parent)
    // 如果该父任务未折叠，则添加其子任务
    if (!collapsedTasks.has(parent.id)) {
      const children = childTasksMap.get(parent.id) || []
      displayTasks.push(...children)
    }
  })
  
  // 4. 找出没有父任务的孤立子任务（父任务可能在其他象限）
  const orphanTasks = tasks.filter(t => 
    (t.depth ?? 0) > 0 && 
    t.parentTaskId && 
    !parentTasks.some(p => p.id === t.parentTaskId)
  )
  displayTasks.push(...orphanTasks)
  
  // 任务ID列表（用于 SortableContext）
  const taskIds = displayTasks.map(t => t.id)
  
  return (
    <div 
      ref={setNodeRef}
      className={`
        rounded-xl border-2 p-4 flex flex-col overflow-hidden transition-all duration-200 relative z-0 h-full min-h-0
        ${isOver ? 'ring-4 ring-blue-400 ring-opacity-50 scale-[1.02]' : ''}
      `}
      style={{
        backgroundColor: config.bgColor,
        borderColor: isOver ? '#3b82f6' : config.borderColor,
      }}
    >
      {/* 任务列表 - 添加 max-h-full 确保滚动条生效 */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0 max-h-full pr-1">
          {displayTasks.length > 0 ? (
            displayTasks.map(task => {
              const hasChildren = childTasksMap.has(task.id)
              const isCollapsed = collapsedTasks.has(task.id)
              const depth = task.depth ?? 0
              
              return (
                <TaskCard
                  key={task.id}
                  task={{
                    id: task.id,
                    title: task.title,
                    isCompleted: task.completed,
                  }}
                  onComplete={onTaskComplete}
                  depth={depth}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={onToggleCollapse}
                />
              )
            })
          ) : (
          /* 空状态 - 保持空白 */
          <div className="flex-1"></div>
        )}
        </div>
      </SortableContext>
    </div>
  )
}


