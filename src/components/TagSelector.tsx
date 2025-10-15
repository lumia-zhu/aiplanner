'use client'

import { useState } from 'react'

interface TagSelectorProps {
  label: string                    // 标签类型名称 (如"我的挑战"、"工作场所")
  predefinedTags: readonly string[] // 预定义标签列表
  selectedTags: string[]           // 已选中的标签
  onTagsChange: (tags: string[]) => void // 标签变化回调
  maxTags?: number                 // 最多可选标签数量
  placeholder?: string             // 自定义输入框占位符
}

export default function TagSelector({
  label,
  predefinedTags,
  selectedTags,
  onTagsChange,
  maxTags = 10,
  placeholder = '输入自定义标签',
}: TagSelectorProps) {
  const [customInput, setCustomInput] = useState('')

  // 切换标签选中状态
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // 取消选中
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      // 选中 (检查是否超过最大数量)
      if (selectedTags.length >= maxTags) {
        alert(`最多只能选择 ${maxTags} 个标签`)
        return
      }
      onTagsChange([...selectedTags, tag])
    }
  }

  // 添加自定义标签
  const addCustomTag = () => {
    const trimmedInput = customInput.trim()
    
    // 验证输入
    if (!trimmedInput) {
      return
    }
    
    if (trimmedInput.length > 20) {
      alert('标签长度不能超过 20 个字符')
      return
    }
    
    if (selectedTags.includes(trimmedInput)) {
      alert('该标签已存在')
      return
    }
    
    if (selectedTags.length >= maxTags) {
      alert(`最多只能选择 ${maxTags} 个标签`)
      return
    }

    // 添加标签
    onTagsChange([...selectedTags, trimmedInput])
    setCustomInput('')
  }

  // 处理 Enter 键添加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomTag()
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      {/* 预定义标签 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from(predefinedTags).map((tag) => {
          const isSelected = selectedTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }
              `}
            >
              {tag}
              {isSelected && (
                <span className="ml-1.5">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 已选中的自定义标签 (不在预定义列表中的) */}
      {selectedTags.filter(tag => !predefinedTags.includes(tag)).length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2">自定义标签:</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags
              .filter(tag => !predefinedTags.includes(tag))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-purple-600 text-white shadow-md hover:bg-purple-700 transition-all"
                >
                  {tag}
                  <span className="ml-1.5">✓</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 自定义标签输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={20}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={addCustomTag}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          + 添加
        </button>
      </div>

      {/* 提示信息 */}
      <p className="mt-2 text-xs text-gray-500">
        已选择 {selectedTags.length} 个标签
        {selectedTags.length > 0 && ' · 点击标签可取消选择'}
      </p>
    </div>
  )
}

