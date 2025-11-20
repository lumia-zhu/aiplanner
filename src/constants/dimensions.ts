/**
 * 任务矩阵维度定义
 * 支持6个独立维度，用户可自由组合X轴和Y轴
 */

// ============================================
// 类型定义
// ============================================

export type DimensionType =
  | 'important'    // 重要性
  | 'urgent'       // 紧急性
  | 'impact'       // 影响力
  | 'effort'       // 投入度
  | 'interesting'  // 趣味性
  | 'exciting'     // 刺激性

export interface DimensionConfig {
  id: DimensionType
  name: string
  icon: string
  description: string
  levels: {
    high: string
    low: string
  }
}

export interface MatrixAxesConfig {
  xAxis: DimensionType
  yAxis: DimensionType
}

// ============================================
// 维度配置常量
// ============================================

export const DIMENSIONS: Record<DimensionType, DimensionConfig> = {
  important: {
    id: 'important',
    name: '重要性',
    icon: '⭐',
    description: '任务对目标达成的重要程度',
    levels: { high: '重要', low: '不重要' }
  },
  urgent: {
    id: 'urgent',
    name: '紧急性',
    icon: '🔥',
    description: '任务的时间紧迫程度',
    levels: { high: '紧急', low: '不紧急' }
  },
  impact: {
    id: 'impact',
    name: '影响力',
    icon: '💥',
    description: '任务产生的影响范围和力度',
    levels: { high: '高影响', low: '低影响' }
  },
  effort: {
    id: 'effort',
    name: '投入度',
    icon: '💪',
    description: '完成任务所需的时间和精力',
    levels: { high: '高投入', low: '低投入' }
  },
  interesting: {
    id: 'interesting',
    name: '趣味性',
    icon: '🎨',
    description: '任务的趣味和吸引程度',
    levels: { high: '有趣', low: '无聊' }
  },
  exciting: {
    id: 'exciting',
    name: '刺激性',
    icon: '⚡',
    description: '任务的挑战性和刺激程度',
    levels: { high: '刺激', low: '平淡' }
  }
}

// ============================================
// 预设配置（快捷方式）
// ============================================

export const PRESET_MATRIX_CONFIGS: Record<string, MatrixAxesConfig> = {
  'urgent-important': { xAxis: 'urgent', yAxis: 'important' },
  'impact-effort': { xAxis: 'effort', yAxis: 'impact' },
  'fun-stimulating': { xAxis: 'exciting', yAxis: 'interesting' }
}

export const DEFAULT_MATRIX_AXES: MatrixAxesConfig = {
  xAxis: 'urgent',
  yAxis: 'important'
}

// ============================================
// 工具函数
// ============================================

export function getDimensionConfig(dimension: DimensionType): DimensionConfig {
  return DIMENSIONS[dimension]
}

export function getAllDimensions(): DimensionConfig[] {
  return Object.values(DIMENSIONS)
}

export function getAxisLabels(axes: MatrixAxesConfig) {
  const xDim = DIMENSIONS[axes.xAxis]
  const yDim = DIMENSIONS[axes.yAxis]

  return {
    horizontal: {
      left: xDim.levels.low,
      right: xDim.levels.high
    },
    vertical: {
      bottom: yDim.levels.low,
      top: yDim.levels.high
    }
  }
}

export function isDimensionConflict(dim1: DimensionType, dim2: DimensionType): boolean {
  return dim1 === dim2
}

export function getAvailableDimensions(excludeDimension?: DimensionType): DimensionConfig[] {
  return getAllDimensions().filter(dim => dim.id !== excludeDimension)
}
