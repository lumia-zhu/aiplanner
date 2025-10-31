/**
 * 便签组件
 * 可拖动、可编辑的便签卡片
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import type { StickyNote as StickyNoteType, StickyNoteColor } from '@/types'
import StickyNoteEditor from './StickyNoteEditor'

interface StickyNoteProps {
  note: StickyNoteType           // 便签数据
  onUpdate: (id: string, updates: Partial<StickyNoteType>) => void  // 更新回调
  onDelete: (id: string) => void  // 删除回调
  onClick?: (id: string) => void  // 点击回调（用于置顶）
}

// 便签颜色配置
const COLOR_STYLES: Record<StickyNoteColor, {
  bg: string
  border: string
  shadow: string
  headerBg: string
}> = {
  yellow: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    shadow: 'shadow-yellow-200/50',
    headerBg: 'bg-yellow-200',
  },
  blue: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    shadow: 'shadow-blue-200/50',
    headerBg: 'bg-blue-200',
  },
  green: {
    bg: 'bg-green-100',
    border: 'border-green-300',
    shadow: 'shadow-green-200/50',
    headerBg: 'bg-green-200',
  },
  pink: {
    bg: 'bg-pink-100',
    border: 'border-pink-300',
    shadow: 'shadow-pink-200/50',
    headerBg: 'bg-pink-200',
  },
}

export default function StickyNote({ note, onUpdate, onDelete, onClick }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(note.content)
  const [showColorPicker, setShowColorPicker] = useState(false)
  
  // 拖动相关状态
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: note.positionX, y: note.positionY })
  const dragOffset = useRef({ x: 0, y: 0 })
  const noteRef = useRef<HTMLDivElement>(null)
  
  // 调整大小相关状态
  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState({
    width: note.width || 280,
    height: note.height || 320
  })
  const resizeStartPoint = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })

  const colorStyle = COLOR_STYLES[note.color]

  // 处理内容点击（进入编辑模式）
  const handleContentClick = () => {
    setIsEditing(true)
  }

  // 处理内容更新（实时更新）
  const handleContentUpdate = (newContent: string) => {
    setContent(newContent)
  }

  // 处理内容失焦（保存并退出编辑模式）
  const handleContentBlur = () => {
    setIsEditing(false)
    if (content !== note.content) {
      onUpdate(note.id, { content })
    }
  }

  // 处理删除
  const handleDelete = () => {
    if (window.confirm('确定要删除这个便签吗？')) {
      onDelete(note.id)
    }
  }

  // 处理颜色切换
  const handleColorChange = (newColor: StickyNoteColor) => {
    onUpdate(note.id, { color: newColor })
    setShowColorPicker(false)
  }

  // 处理便签点击（置顶）
  const handleNoteClick = () => {
    if (onClick && !isDragging) {
      onClick(note.id)
    }
  }

  // 处理拖动开始
  const handleMouseDown = (e: React.MouseEvent) => {
    // 只在标题栏拖动
    const target = e.target as HTMLElement
    if (!target.closest('.drag-handle')) {
      return
    }
    
    e.preventDefault()
    setIsDragging(true)
    
    // 计算鼠标相对于便签的偏移量
    const rect = noteRef.current?.getBoundingClientRect()
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  // 处理拖动中
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    // 获取父容器的边界
    const parent = noteRef.current?.parentElement
    if (!parent) return
    
    const parentRect = parent.getBoundingClientRect()
    
    // 计算新位置（相对于父容器）
    let newX = e.clientX - parentRect.left - dragOffset.current.x
    let newY = e.clientY - parentRect.top - dragOffset.current.y
    
    // 边界限制（防止拖出容器）- 使用当前便签的实际尺寸
    newX = Math.max(0, Math.min(newX, parentRect.width - size.width))
    newY = Math.max(0, Math.min(newY, parentRect.height - size.height))
    
    setPosition({ x: newX, y: newY })
  }

  // 处理拖动结束
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      
      // 保存新位置到数据库
      if (position.x !== note.positionX || position.y !== note.positionY) {
        onUpdate(note.id, {
          positionX: Math.round(position.x),
          positionY: Math.round(position.y),
        })
      }
    }
  }

  // 处理调整大小开始
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // 阻止触发拖动
    setIsResizing(true)
    resizeStartPoint.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = { width: size.width, height: size.height }
  }

  // 处理调整大小中
  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return

    const parent = noteRef.current?.parentElement
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()
    const deltaX = e.clientX - resizeStartPoint.current.x
    const deltaY = e.clientY - resizeStartPoint.current.y

    let newWidth = resizeStartSize.current.width + deltaX
    let newHeight = resizeStartSize.current.height + deltaY

    // 限制最小和最大尺寸
    newWidth = Math.max(150, Math.min(400, newWidth))
    newHeight = Math.max(150, Math.min(600, newHeight))

    // 检查是否超出父容器右边界
    if (position.x + newWidth > parentRect.width) {
      newWidth = parentRect.width - position.x
    }

    // 检查是否超出父容器底部边界
    if (position.y + newHeight > parentRect.height) {
      newHeight = parentRect.height - position.y
    }

    setSize({ width: newWidth, height: newHeight })
  }

  // 处理调整大小结束
  const handleResizeEnd = () => {
    if (isResizing) {
      setIsResizing(false)
      
      // 保存新尺寸到数据库
      if (size.width !== note.width || size.height !== note.height) {
        onUpdate(note.id, {
          width: Math.round(size.width),
          height: Math.round(size.height),
        })
      }
    }
  }

  // 监听全局鼠标事件（拖动）
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, position, size])

  // 监听全局鼠标事件（调整大小）
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing, size, position])

  return (
    <div
      ref={noteRef}
      className={`absolute select-none transition-shadow duration-200 ${colorStyle.shadow} ${
        isDragging ? 'cursor-grabbing scale-105' : 'cursor-default'
      } ${isResizing ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: note.zIndex,
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
      }}
      onClick={handleNoteClick}
      onMouseDown={handleMouseDown}
    >
      {/* 便签卡片 */}
      <div
        className={`${colorStyle.bg} ${colorStyle.border} border rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow h-full flex flex-col`}
      >
        {/* 标题栏（拖动手柄） */}
        <div
          className={`drag-handle ${colorStyle.headerBg} px-3 py-2 flex items-center justify-between border-b ${colorStyle.border} ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* 拖动图标 */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="3" cy="3" r="1.5" />
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="13" cy="3" r="1.5" />
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
              <circle cx="3" cy="13" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
              <circle cx="13" cy="13" r="1.5" />
            </svg>
            <span className="text-xs text-gray-600 font-medium">便签</span>
          </div>

          {/* 工具按钮 */}
          <div className="flex items-center gap-1">
            {/* 颜色切换按钮 */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowColorPicker(!showColorPicker)
                }}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                title="切换颜色"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>

              {/* 颜色选择器 */}
              {showColorPicker && (
                <div 
                  className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-2 z-[100]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 黄色 */}
                  <button
                    onClick={() => handleColorChange('yellow')}
                    className={`w-7 h-7 rounded-full border-2 ${
                      note.color === 'yellow' ? 'border-gray-800 scale-110' : 'border-gray-300'
                    } transition-all hover:scale-110 bg-yellow-100`}
                    title="黄色"
                  />
                  {/* 蓝色 */}
                  <button
                    onClick={() => handleColorChange('blue')}
                    className={`w-7 h-7 rounded-full border-2 ${
                      note.color === 'blue' ? 'border-gray-800 scale-110' : 'border-gray-300'
                    } transition-all hover:scale-110 bg-blue-100`}
                    title="蓝色"
                  />
                  {/* 绿色 */}
                  <button
                    onClick={() => handleColorChange('green')}
                    className={`w-7 h-7 rounded-full border-2 ${
                      note.color === 'green' ? 'border-gray-800 scale-110' : 'border-gray-300'
                    } transition-all hover:scale-110 bg-green-100`}
                    title="绿色"
                  />
                  {/* 粉色 */}
                  <button
                    onClick={() => handleColorChange('pink')}
                    className={`w-7 h-7 rounded-full border-2 ${
                      note.color === 'pink' ? 'border-gray-800 scale-110' : 'border-gray-300'
                    } transition-all hover:scale-110 bg-pink-100`}
                    title="粉色"
                  />
                </div>
              )}
            </div>

            {/* 删除按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="删除便签"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div 
          className="flex-1 cursor-text overflow-hidden"
          onClick={(e) => {
            e.stopPropagation()
            if (!isEditing) {
              handleContentClick()
            }
          }}
        >
          <StickyNoteEditor
            content={content}
            onUpdate={handleContentUpdate}
            onBlur={handleContentBlur}
            backgroundColorClass={colorStyle.bg}
            isEditing={isEditing}
          />
        </div>

        {/* 调整大小手柄（右下角） */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize hover:bg-gray-300/30 transition-colors flex items-end justify-end p-1"
          onMouseDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 16 16">
            <path d="M16 16L10 10M16 16L6 6M16 16L2 2" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

