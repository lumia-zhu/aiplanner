/**
 * 任务矩阵类型定义
 * 用于四象限任务优先级管理
 * 基于艾森豪威尔矩阵（重要-紧急矩阵）
 */

// ============================================
// 象限类型定义
// ============================================

/**
 * 象限类型
 * - unclassified: 待分类（新任务默认状态）
 * - urgent-important: 右上象限 - 紧急且重要
 * - not-urgent-important: 左上象限 - 不紧急但重要
 * - urgent-not-important: 右下象限 - 紧急但不重要
 * - not-urgent-not-important: 左下象限 - 不紧急不重要
 */
export type QuadrantType = 
  | 'unclassified'                   // 📥 待分类
  | 'urgent-important'               // 🔥 紧急且重要
  | 'not-urgent-important'           // 📌 不紧急但重要
  | 'urgent-not-important'           // ⚡ 紧急但不重要
  | 'not-urgent-not-important'       // 💤 不紧急不重要

// ============================================
// 象限配置
// ============================================

/**
 * 象限配置信息
 * 定义每个象限的显示样式和描述
 */
export interface QuadrantConfig {
  type: QuadrantType           // 象限类型
  title: string                // 标题
  description: string          // 描述
  icon: string                 // 图标
  color: string                // 主色调
  bgColor: string              // 背景色
  borderColor: string          // 边框色
}

/**
 * 象限配置映射表
 * 包含所有象限的样式和文案配置
 */
export const QUADRANT_CONFIGS: Record<QuadrantType, QuadrantConfig> = {
  // 待分类区域
  'unclassified': {
    type: 'unclassified',
    title: '待分类任务',
    description: '拖动任务到对应象限',
    icon: '📥',
    color: '#6B7280',           // gray-500
    bgColor: '#F9FAFB',         // gray-50
    borderColor: '#E5E7EB',     // gray-200
  },
  
  // 右上：紧急且重要（第一象限）
  'urgent-important': {
    type: 'urgent-important',
    title: '重要且紧急',
    description: '危机处理区',
    icon: '🔥',
    color: '#EF4444',           // red-500
    bgColor: '#FEE2E2',         // red-100
    borderColor: '#FCA5A5',     // red-300
  },
  
  // 左上：不紧急但重要（第二象限）
  'not-urgent-important': {
    type: 'not-urgent-important',
    title: '重要不紧急',
    description: '战略规划区',
    icon: '📌',
    color: '#F59E0B',           // amber-500
    bgColor: '#FEF3C7',         // amber-100
    borderColor: '#FCD34D',     // amber-300
  },
  
  // 右下：紧急但不重要（第三象限）
  'urgent-not-important': {
    type: 'urgent-not-important',
    title: '紧急但不重要',
    description: '琐碎事务区',
    icon: '⚡',
    color: '#3B82F6',           // blue-500
    bgColor: '#DBEAFE',         // blue-100
    borderColor: '#93C5FD',     // blue-300
  },
  
  // 左下：不紧急不重要（第四象限）
  'not-urgent-not-important': {
    type: 'not-urgent-not-important',
    title: '不重要不紧急',
    description: '时间浪费区',
    icon: '💤',
    color: '#9CA3AF',           // gray-400
    bgColor: '#F3F4F6',         // gray-100
    borderColor: '#D1D5DB',     // gray-300
  },
}

// ============================================
// 任务矩阵数据接口
// ============================================

/**
 * 任务矩阵信息
 * 存储任务在矩阵中的位置
 */
export interface TaskMatrix {
  id: string                   // 矩阵记录ID
  taskId: string               // 关联的任务ID
  userId: string               // 用户ID
  quadrant: QuadrantType       // 所在象限
  position: number             // 在象限内的排序位置
  createdAt: string            // 创建时间
  updatedAt: string            // 更新时间
}

/**
 * 创建任务矩阵输入
 * 用于初始化新任务的矩阵信息
 */
export interface CreateTaskMatrixInput {
  taskId: string               // 任务ID（必填）
  quadrant?: QuadrantType      // 象限（可选，默认为 'unclassified'）
  position?: number            // 排序位置（可选，默认为 0）
}

/**
 * 更新任务矩阵输入
 * 用于修改任务的象限或排序
 */
export interface UpdateTaskMatrixInput {
  quadrant?: QuadrantType      // 更新象限
  position?: number            // 更新排序位置
}

// ============================================
// 辅助类型
// ============================================

/**
 * 按象限分组的任务
 * 用于矩阵视图展示
 */
export type TasksByQuadrant<T = any> = Record<QuadrantType, T[]>

/**
 * 象限统计信息
 */
export interface QuadrantStats {
  quadrant: QuadrantType       // 象限类型
  taskCount: number            // 任务数量
  completedCount: number       // 已完成数量
  completionRate: number       // 完成率 (0-100)
}

/**
 * 矩阵统计总览
 */
export interface MatrixStats {
  total: number                // 总任务数
  byQuadrant: QuadrantStats[]  // 各象限统计
  unclassified: number         // 待分类任务数
}

