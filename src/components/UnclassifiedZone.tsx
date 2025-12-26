/**
 * 待分类任务区域组件
 * 显示尚未分类到四象限的任务
 * 用户可以从这里拖动任务到对应象限
 * 支持父子任务层级显示
 */

'use client'

import TaskCard from './TaskCard'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '@/types'

// ============================================
// 类型定义
// ============================================

// 扩展 Task 类型，包含层级信息
interface HierarchicalTask extends Task {
  depth?: number
  parentTaskId?: string | null
}

interface UnclassifiedZoneProps {
  tasks: HierarchicalTask[]                        // 待分类的任务列表
  onTaskComplete: (id: string) => void             // 任务完成回调
  collapsedTasks?: Set<string>                     // 折叠的父任务ID集合
  onToggleCollapse?: (taskId: string) => void      // 切换折叠状态回调
}

// ============================================
// 主组件
// ============================================

export default function UnclassifiedZone({ 
  tasks, 
  onTaskComplete,
  collapsedTasks = new Set(),
  onToggleCollapse,
}: UnclassifiedZoneProps) {
  
  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: 'unclassified',
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
    <div className="w-56 flex-shrink-0 h-full min-h-0">
      <div 
        ref={setNodeRef}
        className={`
          bg-gray-50 rounded-xl border-2 border-dashed p-4 h-full flex flex-col transition-all duration-200 overflow-hidden
          ${isOver ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-400 ring-opacity-30' : 'border-gray-300'}
        `}
      >
        {/* 标题区域 */}
        <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-200">
          {/* 图标 */}
          <span className="text-3xl">📥</span>
          
          {/* 标题和描述 */}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              待分类任务
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              拖动任务到对应象限 →
            </p>
          </div>
          
          {/* 任务数量徽章 */}
          {tasks.length > 0 && (
            <div className="flex-shrink-0 bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
              {tasks.length}
            </div>
          )}
        </div>
        
        {/* 任务列表 */}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 min-h-0">
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
                    showCheckbox={false}  // ⭐ 矩阵模式不显示 checkbox
                    depth={depth}
                    hasChildren={hasChildren}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                  />
                )
              })
            ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm text-gray-400 leading-relaxed">
                太棒了！<br />
                所有任务都已分类
              </p>
            </div>
          )}
          </div>
        </SortableContext>
        
        {/* 底部提示 */}
        {tasks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              💡 提示：新创建的任务会出现在这里
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


