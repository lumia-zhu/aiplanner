/**
 * 任务标签相关常量定义
 */

export interface PresetTag {
  label: string    // 标签名称
  emoji: string    // 标签图标
  color: string    // 标签颜色（十六进制）
}

/**
 * 预设标签列表
 * 使用莫兰迪色系的彩色胶囊设计
 */
export const PRESET_TAGS: PresetTag[] = [
  { label: '学习', emoji: '📚', color: '#7FA1C3' },  // 莫兰迪蓝
  { label: '工作', emoji: '💼', color: '#9B8BA6' },  // 莫兰迪紫
  { label: '娱乐', emoji: '🎮', color: '#D4A5A5' },  // 莫兰迪粉
  { label: '生活', emoji: '🏠', color: '#A8B8A5' },  // 莫兰迪绿
  { label: '健康', emoji: '💪', color: '#D4B896' },  // 莫兰迪橙
  { label: '重要', emoji: '🎯', color: '#C89B9C' },  // 莫兰迪红
]

/**
 * 每个任务最多可以添加的标签数量
 */
export const MAX_TAGS_PER_TASK = 3

