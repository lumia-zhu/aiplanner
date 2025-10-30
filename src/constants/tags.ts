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
 * 使用 Notion 风格的彩色胶囊设计
 */
export const PRESET_TAGS: PresetTag[] = [
  { label: '学习', emoji: '📚', color: '#3B82F6' },  // 蓝色
  { label: '工作', emoji: '💼', color: '#8B5CF6' },  // 紫色
  { label: '娱乐', emoji: '🎮', color: '#EC4899' },  // 粉色
  { label: '生活', emoji: '🏠', color: '#10B981' },  // 绿色
  { label: '健康', emoji: '💪', color: '#F59E0B' },  // 橙色
  { label: '重要', emoji: '🎯', color: '#EF4444' },  // 红色
]

/**
 * 每个任务最多可以添加的标签数量
 */
export const MAX_TAGS_PER_TASK = 3

