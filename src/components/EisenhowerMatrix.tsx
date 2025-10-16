'use client'

import PriorityMatrix from './PriorityMatrix'
import { EISENHOWER_MATRIX_CONFIG } from '@/types'
import type { Task } from '@/types'

interface Props {
  tasks: Task[]
  onClose: () => void
  onSave: (updatedTasks: { id: string; description: string }[]) => void
}

/**
 * 艾森豪威尔矩阵组件(兼容层)
 * 现在内部使用通用的 PriorityMatrix 组件
 * 保持原有的 API 接口不变,确保向后兼容
 */
export default function EisenhowerMatrix({ tasks, onClose, onSave }: Props) {
  return (
    <PriorityMatrix
      tasks={tasks}
      config={EISENHOWER_MATRIX_CONFIG}
      onClose={onClose}
      onSave={onSave}
    />
  )
}
