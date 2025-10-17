'use client'

import { useState } from 'react'
import type { Task, MatrixConfig } from '@/types'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 象限类型定义
type QuadrantId = 'unclassified' | 'q1' | 'q2' | 'q3' | 'q4'

// 可拖拽的任务卡片组件（待分类区）
function DraggableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white px-3 py-2 rounded-md shadow-sm border border-gray-300 hover:shadow-md transition-all cursor-move min-w-[180px] max-w-[220px] touch-none"
    >
      <div className="font-medium text-sm text-gray-900 line-clamp-2">{task.title}</div>
      {task.deadline_datetime && (
        <div className="text-xs text-gray-600 mt-1">
          📅 {new Date(task.deadline_datetime).toLocaleDateString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  )
}

// 可拖拽的象限任务卡片（有颜色边框，更紧凑）
function QuadrantTaskCard({ task, borderColor }: { task: Task; borderColor: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white px-3 py-2 rounded-md shadow-sm border ${borderColor} hover:shadow-md transition-all cursor-move touch-none`}
    >
      <div className="font-medium text-sm text-gray-900 line-clamp-2">{task.title}</div>
    </div>
  )
}

// 可放置区域组件（使用 useDroppable）
function DroppableZone({
  id,
  children,
  className,
  style,
}: {
  id: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

// 象限配置
const QUADRANTS = {
  q2: {
    id: 'q2',
    title: '重要但不紧急',
    subtitle: '长期规划',
    icon: '🟢',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    tag: '【优先级】重要但不紧急 🟢',
  },
  q1: {
    id: 'q1',
    title: '重要且紧急',
    subtitle: '立即处理',
    icon: '🔴',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    tag: '【优先级】重要且紧急 🔴',
  },
  q4: {
    id: 'q4',
    title: '不重要不紧急',
    subtitle: '减少/避免',
    icon: '⚪',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    tag: '【优先级】不重要不紧急 ⚪',
  },
  q3: {
    id: 'q3',
    title: '紧急但不重要',
    subtitle: '委托/快速处理',
    icon: '🟡',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    tag: '【优先级】紧急但不重要 🟡',
  },
}

interface Props {
  tasks: Task[] // 当天的所有任务
  config: MatrixConfig // ⭐ 新增: 矩阵配置
  onClose: () => void
  onSave: (updatedTasks: { id: string; description: string }[]) => void
}

// 辅助函数：移除旧的优先级标记
function removeOldPriorityTag(description: string | undefined): string {
  if (!description) return ''
  
  // 移除所有【优先级】开头的行
  return description
    .split('\n')
    .filter(line => !line.trim().startsWith('【优先级】'))
    .join('\n')
    .trim()
}

// 辅助函数：添加新的优先级标记
function addPriorityTag(
  description: string | undefined, 
  quadrant: QuadrantId,
  config: MatrixConfig
): string {
  // 未分类的任务不添加标记
  if (quadrant === 'unclassified') {
    return removeOldPriorityTag(description)
  }
  
  const cleanDescription = removeOldPriorityTag(description)
  
  // 从 config 动态获取象限配置
  const quadrantConfig = config.quadrants[quadrant as 'q1' | 'q2' | 'q3' | 'q4']
  
  // 象限图标映射
  const iconMap = {
    q1: '🔴',
    q2: '🟢', 
    q3: '🟡',
    q4: '⚪'
  }
  
  // 动态生成标签
  const icon = iconMap[quadrant as keyof typeof iconMap] || '📍'
  const tag = `【${config.title}】${quadrantConfig.label} ${icon}`
  
  if (cleanDescription) {
    return `${cleanDescription}\n\n${tag}`
  } else {
    return tag
  }
}

export default function PriorityMatrix({ tasks, config, onClose, onSave }: Props) {
  // 任务按象限分组的状态（初始都在未分类）
  const [tasksByQuadrant, setTasksByQuadrant] = useState<Record<QuadrantId, Task[]>>({
    unclassified: [...tasks],
    q1: [],
    q2: [],
    q3: [],
    q4: [],
  })

  // 当前拖拽的任务
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动8px才触发拖拽
      },
    })
  )

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    
    // 找到被拖拽的任务
    for (const tasks of Object.values(tasksByQuadrant)) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setActiveTask(task)
        break
      }
    }
  }

  // 拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveTask(null)
    
    if (!over) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    // 找到拖拽任务所在的象限
    let sourceQuadrant: QuadrantId | null = null
    for (const [quadrant, tasks] of Object.entries(tasksByQuadrant)) {
      if (tasks.some(t => t.id === activeId)) {
        sourceQuadrant = quadrant as QuadrantId
        break
      }
    }
    
    if (!sourceQuadrant) {
      console.log('找不到源象限')
      return
    }
    
    // 检查是否拖拽到象限区域
    const validQuadrants: QuadrantId[] = ['unclassified', 'q1', 'q2', 'q3', 'q4']
    if (validQuadrants.includes(overId as QuadrantId)) {
      // 拖拽到象限区域（跨象限移动）
      const targetQuadrant = overId as QuadrantId
      
      if (sourceQuadrant === targetQuadrant) {
        console.log('同一象限，不移动')
        return
      }
      
      console.log('跨象限移动:', { from: sourceQuadrant, to: targetQuadrant })
      
      setTasksByQuadrant(prev => {
        const task = prev[sourceQuadrant!].find(t => t.id === activeId)
        if (!task) return prev
        
        return {
          ...prev,
          [sourceQuadrant!]: prev[sourceQuadrant!].filter(t => t.id !== activeId),
          [targetQuadrant]: [...prev[targetQuadrant], task],
        }
      })
    } else {
      // 拖拽到另一个任务上（同象限内排序）
      let targetQuadrant: QuadrantId | null = null
      for (const [quadrant, tasks] of Object.entries(tasksByQuadrant)) {
        if (tasks.some(t => t.id === overId)) {
          targetQuadrant = quadrant as QuadrantId
          break
        }
      }
      
      if (!targetQuadrant || sourceQuadrant !== targetQuadrant) {
        return
      }
      
      // 同一象限内调整顺序
      console.log('同象限内排序:', { quadrant: sourceQuadrant, activeId, overId })
      
      setTasksByQuadrant(prev => {
        const tasks = [...prev[sourceQuadrant!]]
        const oldIndex = tasks.findIndex(t => t.id === activeId)
        const newIndex = tasks.findIndex(t => t.id === overId)
        
        if (oldIndex === -1 || newIndex === -1) return prev
        
        // 使用 arrayMove 调整顺序
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)
        
        return {
          ...prev,
          [sourceQuadrant!]: reorderedTasks,
        }
      })
    }
  }

  // 所有任务ID用于SortableContext
  const allTaskIds = [
    ...tasksByQuadrant.unclassified,
    ...tasksByQuadrant.q1,
    ...tasksByQuadrant.q2,
    ...tasksByQuadrant.q3,
    ...tasksByQuadrant.q4,
  ].map(t => t.id)

  // 保存按钮处理
  const handleSave = () => {
    console.log(`开始保存${config.title}分类`)
    
    const updatedTasks: { id: string; description: string }[] = []
    
    // 遍历所有象限（包括未分类）
    for (const [quadrant, tasks] of Object.entries(tasksByQuadrant)) {
      tasks.forEach(task => {
        const newDescription = addPriorityTag(task.description, quadrant as QuadrantId, config)
        
        // 只有 description 发生变化的任务才需要更新
        if (newDescription !== (task.description || '')) {
          updatedTasks.push({
            id: task.id,
            description: newDescription
          })
        }
      })
    }
    
    console.log(`需要更新 ${updatedTasks.length} 个任务的描述`)
    
    if (updatedTasks.length === 0) {
      alert('⚠️ 没有任务需要更新')
      return
    }
    
    // 调用父组件的保存函数
    onSave(updatedTasks)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* 模态框容器 */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                🎯 {config.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                拖动任务到相应象限进行分类整理
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
            {/* 待分类任务区域 */}
            <DroppableZone id="unclassified" className="bg-blue-50 border border-transparent rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>待分类任务</span>
                <span className="text-sm bg-blue-100 px-2 py-1 rounded">
                  {tasksByQuadrant.unclassified.length} 个
                </span>
              </h3>
              <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {tasksByQuadrant.unclassified.length === 0 ? (
                    <div className="text-blue-400 text-sm py-4 w-full text-center">
                      所有任务已分类 ✨
                    </div>
                  ) : (
                    tasksByQuadrant.unclassified.map((task) => (
                      <DraggableTaskCard key={task.id} task={task} />
                    ))
                  )}
                </div>
              </SortableContext>
            </DroppableZone>

            {/* 2x2 矩阵网格（带坐标轴） */}
            <div className="flex-1 min-h-0">
              {/* 矩阵网格 */}
              <div className="h-full grid grid-cols-2 gap-6">
              {/* 左上：Q2 */}
              <DroppableZone
                id="q2"
                style={{ 
                  backgroundColor: `${config.quadrants.q2.color}15`
                }}
                className="border border-transparent rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                      <span>{config.quadrants.q2.label}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{config.quadrants.q2.description}</p>
                  </div>
                  <span className="text-sm bg-white px-2 py-1 rounded text-gray-900 font-medium">
                    {tasksByQuadrant.q2.length} 个
                  </span>
                </div>
                <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {tasksByQuadrant.q2.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-sm">拖动任务到这里</div>
                      </div>
                    ) : (
                      tasksByQuadrant.q2.map((task) => (
                        <QuadrantTaskCard key={task.id} task={task} borderColor="border-green-200" />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DroppableZone>

              {/* 右上：Q1 */}
              <DroppableZone
                id="q1"
                style={{ 
                  backgroundColor: `${config.quadrants.q1.color}15`
                }}
                className="border border-transparent rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                      <span>{config.quadrants.q1.label}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{config.quadrants.q1.description}</p>
                  </div>
                  <span className="text-sm bg-white px-2 py-1 rounded text-gray-900 font-medium">
                    {tasksByQuadrant.q1.length} 个
                  </span>
                </div>
                <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {tasksByQuadrant.q1.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-sm">拖动任务到这里</div>
                      </div>
                    ) : (
                      tasksByQuadrant.q1.map((task) => (
                        <QuadrantTaskCard key={task.id} task={task} borderColor="border-red-200" />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DroppableZone>

              {/* 左下：Q4 */}
              <DroppableZone
                id="q4"
                style={{ 
                  backgroundColor: `${config.quadrants.q4.color}15`
                }}
                className="border border-transparent rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                      <span>{config.quadrants.q4.label}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{config.quadrants.q4.description}</p>
                  </div>
                  <span className="text-sm bg-white px-2 py-1 rounded text-gray-900 font-medium">
                    {tasksByQuadrant.q4.length} 个
                  </span>
                </div>
                <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {tasksByQuadrant.q4.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-sm">拖动任务到这里</div>
                      </div>
                    ) : (
                      tasksByQuadrant.q4.map((task) => (
                        <QuadrantTaskCard key={task.id} task={task} borderColor="border-gray-200" />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DroppableZone>

              {/* 右下：Q3 */}
              <DroppableZone
                id="q3"
                style={{ 
                  backgroundColor: `${config.quadrants.q3.color}15`
                }}
                className="border border-transparent rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                      <span>{config.quadrants.q3.label}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{config.quadrants.q3.description}</p>
                  </div>
                  <span className="text-sm bg-white px-2 py-1 rounded text-gray-900 font-medium">
                    {tasksByQuadrant.q3.length} 个
                  </span>
                </div>
                <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {tasksByQuadrant.q3.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-sm">拖动任务到这里</div>
                      </div>
                    ) : (
                      tasksByQuadrant.q3.map((task) => (
                        <QuadrantTaskCard key={task.id} task={task} borderColor="border-yellow-200" />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DroppableZone>
              </div>
            </div>
          </div>

          {/* 底部按钮区 */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              保存并应用
            </button>
          </div>
        </div>
      </div>

      {/* 拖拽覆盖层 */}
      <DragOverlay>
        {activeTask ? (
          <div className="bg-white p-3 rounded-lg shadow-lg border-2 border-blue-400 opacity-80 min-w-[200px] max-w-[250px]">
            <div className="font-medium text-sm line-clamp-2">{activeTask.title}</div>
            {activeTask.deadline_datetime && (
              <div className="text-xs text-gray-500 mt-1">
                📅 {new Date(activeTask.deadline_datetime).toLocaleDateString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

