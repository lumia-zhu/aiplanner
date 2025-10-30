'use client'

/**
 * TagDropdown - 标签选择下拉菜单
 * 用于为任务添加/移除标签
 */

import { useState, useEffect, useRef } from 'react'
import { PRESET_TAGS, MAX_TAGS_PER_TASK, type PresetTag } from '@/constants/tags'

interface TagDropdownProps {
  position: { x: number; y: number }  // 下拉菜单位置
  selectedTags: PresetTag[]           // 当前已选中的标签
  onSelectTag: (tag: PresetTag) => void    // 选择标签回调
  onRemoveTag: (tag: PresetTag) => void    // 移除标签回调
  onClose: () => void                      // 关闭菜单回调
}

export default function TagDropdown({
  position,
  selectedTags,
  onSelectTag,
  onRemoveTag,
  onClose
}: TagDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [customTagInput, setCustomTagInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  // 检查标签是否已选中
  const isTagSelected = (tag: PresetTag) => {
    return selectedTags.some(t => t.label === tag.label)
  }

  // 处理标签点击
  const handleTagClick = (tag: PresetTag) => {
    if (isTagSelected(tag)) {
      // 已选中，则移除
      onRemoveTag(tag)
    } else {
      // 未选中，检查是否超过限制
      if (selectedTags.length >= MAX_TAGS_PER_TASK) {
        alert(`每个任务最多只能添加 ${MAX_TAGS_PER_TASK} 个标签`)
        return
      }
      onSelectTag(tag)
    }
  }

  // 处理自定义标签提交
  const handleCustomTagSubmit = () => {
    const trimmedInput = customTagInput.trim()
    
    if (!trimmedInput) {
      return
    }
    
    // 检查是否超过限制
    if (selectedTags.length >= MAX_TAGS_PER_TASK) {
      alert(`每个任务最多只能添加 ${MAX_TAGS_PER_TASK} 个标签`)
      return
    }

    // 创建自定义标签（灰色）
    const customTag: PresetTag = {
      label: trimmedInput,
      emoji: '🏷️',
      color: '#6B7280' // 灰色
    }
    
    onSelectTag(customTag)
    setCustomTagInput('')
    setShowCustomInput(false)
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">🏷️ 选择标签</span>
          <span className="text-xs text-gray-500">
            {selectedTags.length}/{MAX_TAGS_PER_TASK}
          </span>
        </div>
      </div>

      {/* 预设标签列表 */}
      <div className="py-1">
        {PRESET_TAGS.map((tag) => {
          const selected = isTagSelected(tag)
          return (
            <button
              key={tag.label}
              onClick={() => handleTagClick(tag)}
              className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left ${
                selected ? 'bg-blue-50' : ''
              }`}
            >
              {/* 选中标记 */}
              <span className="w-4 text-sm font-bold text-blue-600">
                {selected ? '✓' : ''}
              </span>
              
              {/* 标签预览（# 前缀简洁风格） */}
              <span
                className="text-sm font-medium flex items-center gap-1.5"
                style={{ color: tag.color }}
              >
                <span>{tag.emoji}</span>
                <span>#{tag.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* 自定义标签区域 */}
      <div className="border-t border-gray-100 pt-1">
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedTags.length >= MAX_TAGS_PER_TASK}
          >
            <span className="text-lg">➕</span>
            <span>自定义标签</span>
          </button>
        ) : (
          <div className="px-3 py-2">
            <input
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomTagSubmit()
                } else if (e.key === 'Escape') {
                  setShowCustomInput(false)
                  setCustomTagInput('')
                }
              }}
              placeholder="输入标签名称..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              maxLength={10}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCustomTagSubmit}
                className="flex-1 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomTagInput('')
                }}
                className="flex-1 px-2 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {selectedTags.length >= MAX_TAGS_PER_TASK && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <span>⚠️</span>
            <span>已达到标签上限</span>
          </p>
        </div>
      )}
    </div>
  )
}

