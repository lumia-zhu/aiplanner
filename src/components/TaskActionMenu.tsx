'use client'

/**
 * TaskActionMenu - 任务操作菜单
 * 点击任务拖拽手柄时显示的操作菜单
 */

import { useState, useEffect, useRef } from 'react'

interface MenuItem {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  badge?: string  // 徽章文字（如"开发中"）
}

interface TaskActionMenuProps {
  position: { x: number; y: number }  // 菜单位置
  onOpenTagPicker: () => void         // 打开标签选择器
  onOpenDateTimePicker: () => void    // 打开时间选择器
  onClose: () => void                 // 关闭菜单
}

export default function TaskActionMenu({
  position,
  onOpenTagPicker,
  onOpenDateTimePicker,
  onClose
}: TaskActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  
  // 边界检测，防止超出屏幕
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      let newX = position.x
      let newY = position.y
      
      // 右边界检测
      if (rect.right > viewportWidth) {
        newX = viewportWidth - rect.width - 20
      }
      
      // 左边界检测
      if (newX < 20) {
        newX = 20
      }
      
      // 底部边界检测
      if (rect.bottom > viewportHeight) {
        newY = viewportHeight - rect.height - 20
      }
      
      // 顶部边界检测
      if (newY < 20) {
        newY = 20
      }
      
      if (newX !== position.x || newY !== position.y) {
        setAdjustedPosition({ x: newX, y: newY })
      }
    }
  }, [position])
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])
  
  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])
  
  // 菜单项配置
  const menuItems: MenuItem[] = [
    {
      icon: '🏷️',
      label: '添加标签',
      onClick: () => {
        onOpenTagPicker()
        onClose()
      }
    },
    {
      icon: '⏰',
      label: '设置时间',
      onClick: () => {
        onOpenDateTimePicker()
        onClose()
      }
    },
    {
      icon: '🔔',
      label: '添加提醒',
      badge: '开发中',
      onClick: () => {
        alert('🔔 提醒功能正在开发中，敬请期待！')
        onClose()
      }
    }
  ]
  
  // 禁用的菜单项（用分隔线隔开）
  const disabledMenuItems: MenuItem[] = [
    {
      icon: '✏️',
      label: '编辑任务',
      disabled: true,
      onClick: () => {}
    },
    {
      icon: '🗑️',
      label: '删除任务',
      disabled: true,
      onClick: () => {}
    }
  ]
  
  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
      }}
    >
      {/* 主菜单项 */}
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          disabled={item.disabled}
          className={`w-full px-3 py-2.5 flex items-center gap-3 text-sm transition-colors text-left ${
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
              {item.badge}
            </span>
          )}
        </button>
      ))}
      
      {/* 分隔线 */}
      <div className="my-1 border-t border-gray-200"></div>
      
      {/* 禁用的菜单项 */}
      {disabledMenuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          disabled={item.disabled}
          className={`w-full px-3 py-2.5 flex items-center gap-3 text-sm transition-colors text-left ${
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
        </button>
      ))}
    </div>
  )
}





