'use client'

import { useState } from 'react'
import {
  PRESET_TASK_TAGS,
  TASK_TAG_CONFIG,
  validateTagName,
  getTagColor,
  getTagLabel,
} from '@/types'

interface TaskTagSelectorProps {
  selectedTags: string[]                     // 已选中的标签
  customTags: string[]                       // 用户的自定义标签池
  onTagsChange: (tags: string[]) => void     // 标签变化回调
  onAddCustomTag?: (tag: string) => void     // 添加新标签到用户标签池(可选)
}

/**
 * 任务标签选择器组件
 * 用于在任务表单中选择和管理标签
 */
export default function TaskTagSelector({
  selectedTags,
  customTags,
  onTagsChange,
  onAddCustomTag,
}: TaskTagSelectorProps) {
  const [customInput, setCustomInput] = useState('')
  const [error, setError] = useState('')

  // 切换标签选中状态
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // 取消选中
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      // 选中 (检查是否超过最大数量)
      if (selectedTags.length >= TASK_TAG_CONFIG.MAX_TAGS_PER_TASK) {
        setError(`最多只能选择 ${TASK_TAG_CONFIG.MAX_TAGS_PER_TASK} 个标签`)
        setTimeout(() => setError(''), 3000)
        return
      }
      onTagsChange([...selectedTags, tag])
    }
  }

  // 添加自定义标签
  const addCustomTag = () => {
    const trimmedInput = customInput.trim()
    
    // 验证标签名称
    const validationError = validateTagName(trimmedInput)
    if (validationError) {
      setError(validationError)
      setTimeout(() => setError(''), 3000)
      return
    }
    
    // 检查是否已在当前任务中选中
    if (selectedTags.includes(trimmedInput)) {
      setError('该标签已添加到此任务')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    // 检查数量限制
    if (selectedTags.length >= TASK_TAG_CONFIG.MAX_TAGS_PER_TASK) {
      setError(`最多只能选择 ${TASK_TAG_CONFIG.MAX_TAGS_PER_TASK} 个标签`)
      setTimeout(() => setError(''), 3000)
      return
    }

    // 添加到当前任务的标签
    onTagsChange([...selectedTags, trimmedInput])
    
    // 如果标签不在用户的标签池中,添加到标签池
    if (!customTags.includes(trimmedInput) && !Array.from(PRESET_TASK_TAGS).includes(trimmedInput)) {
      onAddCustomTag?.(trimmedInput)
    }
    
    setCustomInput('')
    setError('')
  }

  // 处理 Enter 键添加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomTag()
    }
  }

  // 渲染标签按钮
  const renderTagButton = (tag: string) => {
    const isSelected = selectedTags.includes(tag)
    const colorConfig = getTagColor(tag)
    const label = getTagLabel(tag)
    
    return (
      <button
        key={tag}
        type="button"
        onClick={() => toggleTag(tag)}
        className={`
          inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
          transition-all border
          ${
            isSelected
              ? `${colorConfig.bg} ${colorConfig.text} ${colorConfig.border} shadow-sm`
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <span>{label}</span>
        {isSelected && <span className="ml-0.5">✓</span>}
      </button>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        标签
      </label>

      {/* 预设标签 */}
      <div className="mb-3">
        <p className="text-xs text-gray-600 mb-2">预设标签:</p>
        <div className="flex flex-wrap gap-2">
          {Array.from(PRESET_TASK_TAGS).map((tag) => renderTagButton(tag))}
        </div>
      </div>

      {/* 用户的自定义标签 */}
      {customTags.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2">我的标签:</p>
          <div className="flex flex-wrap gap-2">
            {customTags.map((tag) => renderTagButton(tag))}
          </div>
        </div>
      )}

      {/* 自定义标签输入 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入自定义标签"
            maxLength={TASK_TAG_CONFIG.MAX_TAG_LENGTH}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customInput.trim()}
            className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
          >
            + 添加
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        {/* 已选标签提示 */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            已选择 {selectedTags.length} 个标签
            {selectedTags.length > 0 && ' · 点击标签可取消选择'}
          </span>
        </div>
      </div>

      {/* 已选标签展示 */}
      {selectedTags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">当前任务标签:</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => {
              const colorConfig = getTagColor(tag)
              const label = getTagLabel(tag)
              return (
                <span
                  key={tag}
                  className={`
                    inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                    border
                    ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}
                  `}
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="ml-0.5 hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

