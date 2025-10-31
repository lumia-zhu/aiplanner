/**
 * 任务矩阵主组件
 * 四象限 + 待分类区域
 * 支持拖拽任务进行分类
 */

'use client'

import UnclassifiedZone from './UnclassifiedZone'
import Quadrant from './Quadrant'
import { QUADRANT_CONFIGS } from '@/types/task-matrix'
import type { Task } from '@/types'
import type { QuadrantType, TasksByQuadrant } from '@/types/task-matrix'

// ============================================
// 类型定义
// ============================================

interface TaskMatrixProps {
  tasks: TasksByQuadrant<Task>               // 按象限分组的任务
  selectedDate: Date                         // 当前选中的日期
  onClose: () => void                        // 关闭回调
  onTaskComplete: (id: string) => void       // 任务完成回调
}

// ============================================
// 主组件
// ============================================

export default function TaskMatrix({
  tasks,
  selectedDate,
  onClose,
  onTaskComplete,
}: TaskMatrixProps) {
  
  // 格式化日期显示
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* 图标 */}
            <span className="text-3xl">📊</span>
            
            {/* 标题和日期 */}
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                任务矩阵
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatDate(selectedDate)}
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
        
        {/* 主内容区 */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* 左侧：待分类区域 */}
          <UnclassifiedZone
            tasks={tasks.unclassified || []}
            onTaskComplete={onTaskComplete}
          />
          
          {/* 右侧：四象限矩阵 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 顶部标签：重要 ↑ */}
            <div className="text-center mb-4">
              <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-4 py-1.5 rounded-full inline-block">
                ↑ 重要
              </span>
            </div>
            
            {/* 四象限网格 */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0">
              {/* 左上：重要不紧急 */}
              <Quadrant
                config={QUADRANT_CONFIGS['not-urgent-important']}
                tasks={tasks['not-urgent-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 右上：重要且紧急 */}
              <Quadrant
                config={QUADRANT_CONFIGS['urgent-important']}
                tasks={tasks['urgent-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 左下：不重要不紧急 */}
              <Quadrant
                config={QUADRANT_CONFIGS['not-urgent-not-important']}
                tasks={tasks['not-urgent-not-important'] || []}
                onTaskComplete={onTaskComplete}
              />
              
              {/* 右下：紧急但不重要 */}
              <Quadrant
                config={QUADRANT_CONFIGS['urgent-not-important']}
                tasks={tasks['urgent-not-important'] || []}
                onTaskComplete={onTaskComplete}
              />
            </div>
            
            {/* 底部标签：不紧急 ← → 紧急 */}
            <div className="flex justify-between items-center mt-4 px-4">
              <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-4 py-1.5 rounded-full">
                不紧急
              </span>
              <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-4 py-1.5 rounded-full">
                紧急 →
              </span>
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
    </div>
  )
}

