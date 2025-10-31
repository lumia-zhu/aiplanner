/**
 * 便签数据类型定义
 */

// 便签颜色类型
export type StickyNoteColor = 'yellow' | 'blue' | 'green' | 'pink'

// 便签完整数据结构
export interface StickyNote {
  id: string                    // 便签唯一ID
  userId: string                // 用户ID
  noteDate: string              // 关联的笔记日期（YYYY-MM-DD格式）
  content: string               // 便签文字内容
  positionX: number             // X坐标位置
  positionY: number             // Y坐标位置
  width: number                 // 便签宽度
  height: number                // 便签高度
  color: StickyNoteColor        // 便签颜色
  zIndex: number                // 层级（叠放顺序）
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
}

// 创建便签时的输入数据（部分字段可选）
export interface CreateStickyNoteInput {
  noteDate: string              // 必填：关联的笔记日期
  content?: string              // 可选：初始内容，默认空字符串
  positionX?: number            // 可选：X坐标，默认100
  positionY?: number            // 可选：Y坐标，默认100
  width?: number                // 可选：宽度，默认200
  height?: number               // 可选：高度，默认200
  color?: StickyNoteColor       // 可选：颜色，默认yellow
  zIndex?: number               // 可选：层级，默认1
}

// 更新便签时的输入数据（所有字段可选）
export interface UpdateStickyNoteInput {
  content?: string              // 文字内容
  positionX?: number            // X坐标
  positionY?: number            // Y坐标
  width?: number                // 宽度
  height?: number               // 高度
  color?: StickyNoteColor       // 颜色
  zIndex?: number               // 层级
}

