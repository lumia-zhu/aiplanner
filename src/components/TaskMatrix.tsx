/**
 * 任务矩阵主组件
 * 四象限 + 待分类区域
 * 支持拖拽任务进行分类
 */

'use client'

import { useState } from 'react'
import UnclassifiedZone from './UnclassifiedZone'
import Quadrant from './Quadrant'
import CoordinateAxis from './CoordinateAxis'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { QUADRANT_CONFIGS } from '@/types/task-matrix'
import { MATRIX_DIMENSION_CONFIGS, MATRIX_QUADRANTS_CONFIGS } from '@/types'
import type { Task, TaskMatrixDimension } from '@/types'
import type { QuadrantType, TasksByQuadrant } from '@/types/task-matrix'

// ============================================
// 类型定义
// ============================================

interface TaskMatrixProps {
  tasks: TasksByQuadrant<Task>               // 按象限分组的任务
  selectedDate: Date                         // 当前选中的日期
  selectedDimension: TaskMatrixDimension     // 当前选中的矩阵维度
  onClose: () => void                        // 关闭回调
  onTaskComplete: (id: string) => void       // 任务完成回调
  onTaskDrop: (taskId: string, targetQuadrant: QuadrantType) => void  // 任务拖拽放置回调
  isEmbedded?: boolean                       // 是否为嵌入模式（默认 false，即弹窗模式）
}

// ============================================
// 主组件
// ============================================

export default function TaskMatrix({
  tasks,
  selectedDate,
  selectedDimension,
  onClose,
  onTaskComplete,
  onTaskDrop,
  isEmbedded = false,
}: TaskMatrixProps) {
  
  // 获取当前矩阵维度的配置
  const dimensionConfig = MATRIX_DIMENSION_CONFIGS[selectedDimension]
  const quadrantsConfig = MATRIX_QUADRANTS_CONFIGS[selectedDimension]
  
  // 拖拽状态
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖拽8px后才激活，避免误触
      },
    })
  )
  
  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const taskId = active.id as string
    
    // 查找被拖拽的任务
    for (const quadrantTasks of Object.values(tasks)) {
      const task = quadrantTasks.find((t: Task) => t.id === taskId)
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
    
    const taskId = active.id as string
    const overId = over.id as string
    
    // ⭐ 判断 over.id 是象限 ID 还是任务 ID
    const validQuadrants = ['unclassified', 'urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important']
    let targetQuadrant: QuadrantType
    
    if (validQuadrants.includes(overId)) {
      // over.id 是象限 ID
      targetQuadrant = overId as QuadrantType
    } else {
      // over.id 是任务 ID，需要找到该任务所在的象限
      let foundQuadrant: QuadrantType | null = null
      
      for (const [quadrant, taskList] of Object.entries(tasks)) {
        if (taskList.some((task: Task) => task.id === overId)) {
          foundQuadrant = quadrant as QuadrantType
          break
        }
      }
      
      if (!foundQuadrant) {
        console.warn('⚠️ 无法确定目标象限，取消拖拽')
        return
      }
      
      targetQuadrant = foundQuadrant
    }
    
    // ⭐ 验证：不允许拖拽到 'unclassified'
    if (targetQuadrant === 'unclassified') {
      console.warn('⚠️ 不允许拖拽到待分类区域')
      return
    }
    
    console.log('🎯 拖拽任务:', { taskId, targetQuadrant })
    
    // 调用父组件的回调
    onTaskDrop(taskId, targetQuadrant)
  }
  
  // 格式化日期显示
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  
  // 矩阵主内容
  const matrixContent = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col">
        {/* 标题栏 - 仅在弹窗模式显示 */}
        {!isEmbedded && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {/* 图标 - 动态显示当前维度的图标 */}
              <span className="text-3xl">{dimensionConfig.icon}</span>
              
              {/* 标题和日期 */}
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {dimensionConfig.name}矩阵
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatDate(selectedDate)} · {dimensionConfig.description}
                </p>
              </div>
            </div>
            
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
              title="关闭矩阵视图"
            >
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
        )}
        
        {/* 主内容区 */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* 左侧：待分类区域 */}
          <UnclassifiedZone
            tasks={tasks.unclassified || []}
            onTaskComplete={onTaskComplete}
          />
          
          {/* 右侧：四象限矩阵 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 四象限网格（带坐标轴） */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0 relative">
              {/* 左上象限 */}
              <Quadrant
                quadrantId="not-urgent-important"
                config={{
                  type: 'not-urgent-important',
                  ...quadrantsConfig['top-left']
                }}
                tasks={tasks['not-urgent-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 右上象限 */}
              <Quadrant
                quadrantId="urgent-important"
                config={{
                  type: 'urgent-important',
                  ...quadrantsConfig['top-right']
                }}
                tasks={tasks['urgent-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 左下象限 */}
              <Quadrant
                quadrantId="not-urgent-not-important"
                config={{
                  type: 'not-urgent-not-important',
                  ...quadrantsConfig['bottom-left']
                }}
                tasks={tasks['not-urgent-not-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 右下象限 */}
              <Quadrant
                quadrantId="urgent-not-important"
                config={{
                  type: 'urgent-not-important',
                  ...quadrantsConfig['bottom-right']
                }}
                tasks={tasks['urgent-not-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 坐标轴覆盖层 */}
              <CoordinateAxis axes={dimensionConfig.axes} />
            </div>
          </div>
        </div>
        
        {/* 底部提示栏 */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>💡 提示：从左侧拖动任务到对应象限</span>
            </div>
            <div className="flex items-center gap-2">
              <span>共 {Object.values(tasks).flat().length} 个任务</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 拖拽预览 */}
      <DragOverlay>
        {activeTask && (
          <div className="opacity-90 scale-105">
            <div className="bg-white rounded-lg px-3 py-2.5 shadow-xl border-2 border-blue-500">
              <div className="text-sm font-medium text-gray-800">
                {activeTask.title}
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
  
  // 根据模式返回不同的包装
  if (isEmbedded) {
    // 嵌入模式：直接填充父容器，无遮罩
    return (
      <div className="w-full h-full">
        {matrixContent}
      </div>
    )
  } else {
    // 弹窗模式：带遮罩层和居中
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        {matrixContent}
      </div>
    )
  }
}


