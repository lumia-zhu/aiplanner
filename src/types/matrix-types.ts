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
// 象限详细配置
export interface QuadrantDetailConfig {
  name: string           // 象限名称
  description: string    // 象限描述
  icon: string          // 图标
  color: string         // 主色
  bgColor: string       // 背景色
  borderColor: string   // 边框色
  advice?: string       // 使用建议
}

// 矩阵四象限配置映射
export interface MatrixQuadrantsConfig {
  'top-left': QuadrantDetailConfig
  'top-right': QuadrantDetailConfig
  'bottom-left': QuadrantDetailConfig
  'bottom-right': QuadrantDetailConfig
}

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
    status: 'available',
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
    status: 'available',
    icon: '🎮',
    axes: {
      horizontal: { left: '无趣', right: '有趣' },
      vertical: { bottom: '不刺激', top: '刺激' }
    }
  }
}

// 每个矩阵的象限详细配置
export const MATRIX_QUADRANTS_CONFIGS: Record<TaskMatrixDimension, MatrixQuadrantsConfig> = {
  'urgent-important': {
    'top-left': {
      name: '重要不紧急',
      description: '战略规划区',
      icon: '📌',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      borderColor: '#FCD34D',
      advice: '最有价值的区域，投入时间做长期规划'
    },
    'top-right': {
      name: '重要且紧急',
      description: '危机处理区',
      icon: '🔥',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      borderColor: '#FCA5A5',
      advice: '立即处理，但要反思为什么会出现危机'
    },
    'bottom-left': {
      name: '不重要不紧急',
      description: '时间浪费区',
      icon: '💤',
      color: '#9CA3AF',
      bgColor: '#F3F4F6',
      borderColor: '#D1D5DB',
      advice: '尽量减少或避免，占用宝贵时间'
    },
    'bottom-right': {
      name: '紧急不重要',
      description: '琐碎事务区',
      icon: '⚡',
      color: '#3B82F6',
      bgColor: '#DBEAFE',
      borderColor: '#93C5FD',
      advice: '可以委托或快速处理，避免占用太多精力'
    }
  },
  'impact-effort': {
    'top-left': {
      name: '高影响-低努力',
      description: '快速收益区',
      icon: '🎯',
      color: '#10B981',
      bgColor: '#D1FAE5',
      borderColor: '#6EE7B7',
      advice: '最优先！容易完成且影响大，全天优先处理'
    },
    'top-right': {
      name: '高影响-高努力',
      description: '战略投资区',
      icon: '💪',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      borderColor: '#FCD34D',
      advice: '影响大但有挑战，需要时间和周密计划'
    },
    'bottom-left': {
      name: '低影响-低努力',
      description: '填充任务区',
      icon: '💡',
      color: '#60A5FA',
      bgColor: '#DBEAFE',
      borderColor: '#93C5FD',
      advice: '简单但贡献小，低能量时用来保持动力'
    },
    'bottom-right': {
      name: '低影响-高努力',
      description: '时间陷阱区',
      icon: '⚠️',
      color: '#9CA3AF',
      bgColor: '#F3F4F6',
      borderColor: '#D1D5DB',
      advice: '困难但收益小，尽量委派、简化或删除'
    }
  },
  'fun-stimulating': {
    'top-left': {
      name: '刺激但无趣',
      description: '压力焦虑区',
      icon: '🔥',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      borderColor: '#FCA5A5',
      advice: '紧张但不愉快，容易疲惫，寻求支持或调整方式'
    },
    'top-right': {
      name: '刺激且有趣',
      description: '最佳状态区',
      icon: '🚀',
      color: '#10B981',
      bgColor: '#D1FAE5',
      borderColor: '#6EE7B7',
      advice: '心流状态！充满挑战和乐趣，最理想的工作状态'
    },
    'bottom-left': {
      name: '无趣不刺激',
      description: '义务任务区',
      icon: '📋',
      color: '#9CA3AF',
      bgColor: '#F3F4F6',
      borderColor: '#D1D5DB',
      advice: '既无趣也不刺激，寻找方法让它更有吸引力'
    },
    'bottom-right': {
      name: '有趣不刺激',
      description: '轻松娱乐区',
      icon: '🎮',
      color: '#60A5FA',
      bgColor: '#DBEAFE',
      borderColor: '#93C5FD',
      advice: '愉快但缺乏挑战，适合休息恢复，但不要过度沉迷'
    }
  }
}

