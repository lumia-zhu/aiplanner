/**
 * 便签下拉框组件
 * Hover 时显示隐藏的便签列表，支持恢复和删除操作
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import type { StickyNote } from '@/types'

interface StickyNotesDropdownProps {
  currentCount: number           // 当前可见便签数量
  maxCount: number               // 最大便签数量
  onCreateNew: () => void        // 创建新便签
  onLoadHidden: () => Promise<StickyNote[]>  // 加载隐藏便签
  onRestore: (noteId: string) => Promise<void>  // 恢复便签
  onDelete: (noteId: string) => Promise<void>   // 删除便签
}

export default function StickyNotesDropdown({
  currentCount,
  maxCount,
  onCreateNew,
  onLoadHidden,
  onRestore,
  onDelete,
}: StickyNotesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hiddenNotes, setHiddenNotes] = useState<StickyNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 加载隐藏的便签
  const loadHiddenNotes = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    try {
      const notes = await onLoadHidden()
      setHiddenNotes(notes)
      console.log(`📋 加载了 ${notes.length} 个隐藏便签`)
    } catch (error) {
      console.error('加载隐藏便签失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理恢复便签
  const handleRestore = async (noteId: string) => {
    try {
      await onRestore(noteId)
      // 从列表中移除
      setHiddenNotes(prev => prev.filter(note => note.id !== noteId))
    } catch (error) {
      console.error('恢复便签失败:', error)
    }
  }

  // 处理删除便签
  const handleDelete = async (noteId: string) => {
    if (!window.confirm('确定要永久删除这个便签吗？\n\n删除后将无法恢复！')) {
      return
    }
    
    try {
      await onDelete(noteId)
      // 从列表中移除
      setHiddenNotes(prev => prev.filter(note => note.id !== noteId))
    } catch (error) {
      console.error('删除便签失败:', error)
    }
  }

  // 打开下拉框时加载数据
  useEffect(() => {
    if (isOpen && !isLoading && hiddenNotes.length === 0) {
      loadHiddenNotes()
    }
  }, [isOpen])

  // 处理鼠标进入
  const handleMouseEnter = () => {
    // 取消任何待处理的关闭操作
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsOpen(true)
  }

  // 处理鼠标离开（延迟关闭）
  const handleMouseLeave = () => {
    // 延迟 200ms 关闭，给用户时间移动到下拉框
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // 获取便签内容预览（前20个字符）
  const getPreview = (content: string) => {
    if (!content || content.trim() === '') {
      return '(空便签)'
    }
    return content.length > 20 ? content.substring(0, 20) + '...' : content
  }

  const isDisabled = currentCount >= maxCount

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      {/* 便签按钮 */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={onCreateNew}
          className={`text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center gap-2 shadow-md h-10 ${
            isDisabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:opacity-90 hover:shadow-lg hover:scale-105 active:scale-95'
          }`}
          style={{ backgroundColor: '#F59E0B' }}
          title={
            isDisabled
              ? `便签数量已达上限 (${currentCount}/${maxCount})`
              : `创建便签 (${currentCount}/${maxCount})`
          }
          disabled={isDisabled}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          便签
        </button>
      </div>

      {/* 下拉框 */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] animate-fadeIn"
          style={{ maxHeight: '400px', overflowY: 'auto' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 标题 */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">📋 隐藏的便签</span>
              <span className="text-xs text-gray-500">
                {hiddenNotes.length} 个
              </span>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="py-2">
            {isLoading ? (
              // 加载中
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-700"></div>
                <p className="mt-2 text-sm">加载中...</p>
              </div>
            ) : hiddenNotes.length === 0 ? (
              // 空状态
              <div className="px-4 py-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm">暂无隐藏的便签</p>
              </div>
            ) : (
              // 便签列表
              <div className="max-h-[300px] overflow-y-auto">
                {hiddenNotes.map(note => (
                  <div
                    key={note.id}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    {/* 便签预览 */}
                    <div className="flex items-start gap-3">
                      {/* 便签颜色指示器 */}
                      <div
                        className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                          note.color === 'yellow' ? 'bg-yellow-400' :
                          note.color === 'blue' ? 'bg-blue-400' :
                          note.color === 'green' ? 'bg-green-400' :
                          'bg-pink-400'
                        }`}
                      />
                      
                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">
                          {getPreview(note.content)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(note.updatedAt), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleRestore(note.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors flex items-center justify-center gap-1"
                        disabled={currentCount >= maxCount}
                        title={currentCount >= maxCount ? '已达到便签数量上限' : '显示便签'}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        显示
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

