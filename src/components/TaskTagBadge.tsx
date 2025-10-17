'use client'

import { getTagColor, getTagLabel } from '@/types'

interface TaskTagBadgeProps {
  tag: string                // 标签名称
  size?: 'sm' | 'md'        // 徽章尺寸
  showIcon?: boolean         // 是否显示图标
  onClick?: () => void       // 点击回调(可选)
  className?: string         // 额外的样式类名
}

/**
 * 任务标签徽章组件
 * 用于显示单个任务标签,支持预设标签和自定义标签的不同颜色
 */
export default function TaskTagBadge({
  tag,
  size = 'sm',
  showIcon = true,
  onClick,
  className = '',
}: TaskTagBadgeProps) {
  // 获取标签的颜色配置
  const colorConfig = getTagColor(tag)
  
  // 获取标签的显示名称
  const label = getTagLabel(tag)
  
  // 尺寸样式
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }
  
  // 基础样式
  const baseStyles = `
    inline-flex items-center gap-1
    rounded-full font-medium
    border transition-all
    ${sizeStyles[size]}
    ${colorConfig.bg}
    ${colorConfig.text}
    ${colorConfig.border}
  `
  
  // 可点击样式
  const clickableStyles = onClick
    ? 'cursor-pointer hover:opacity-80 active:scale-95'
    : ''
  
  return (
    <span
      className={`${baseStyles} ${clickableStyles} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {showIcon && (
        <span className="leading-none">{colorConfig.icon}</span>
      )}
      <span>{label}</span>
    </span>
  )
}





