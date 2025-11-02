/**
 * 矩阵类型定义
 * 支持多种任务分类维度
 */

// 矩阵维度类型
export type TaskMatrixDimension = 
  | 'urgent-important'   // 重要-紧急矩阵
  | 'impact-effort'      // 影响-努力矩阵
  | 'fun-stimulating'    // 有趣-刺激矩阵

// 矩阵状态
export type MatrixStatus = 'available' | 'coming-soon'

// 矩阵配置接口
export interface TaskMatrixDimensionConfig {
  id: TaskMatrixDimension
  name: string
  description: string
  status: MatrixStatus
  icon: string
  axes: {
    horizontal: {
      left: string      // 横轴左侧标签
      right: string     // 横轴右侧标签
    }
    vertical: {
      bottom: string    // 纵轴底部标签
      top: string       // 纵轴顶部标签
    }
  }
}

// 矩阵配置映射
export const MATRIX_DIMENSION_CONFIGS: Record<TaskMatrixDimension, TaskMatrixDimensionConfig> = {
  'urgent-important': {
    id: 'urgent-important',
    name: '重要-紧急',
    description: '基于任务的重要程度和紧急程度分类',
    status: 'available',
    icon: '📊',
    axes: {
      horizontal: { left: '不紧急', right: '紧急' },
      vertical: { bottom: '不重要', top: '重要' }
    }
  },
  'impact-effort': {
    id: 'impact-effort',
    name: '影响-努力',
    description: '基于任务的影响力和所需努力程度分类',
    status: 'coming-soon',
    icon: '🎯',
    axes: {
      horizontal: { left: '低努力', right: '高努力' },
      vertical: { bottom: '低影响', top: '高影响' }
    }
  },
  'fun-stimulating': {
    id: 'fun-stimulating',
    name: '有趣-刺激',
    description: '基于任务的趣味性和刺激程度分类',
    status: 'coming-soon',
    icon: '🎮',
    axes: {
      horizontal: { left: '不刺激', right: '刺激' },
      vertical: { bottom: '无趣', top: '有趣' }
    }
  }
}

