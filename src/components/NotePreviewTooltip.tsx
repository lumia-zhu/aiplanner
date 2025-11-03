'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useState } from 'react'
import { extractPreviewLines, extractTaskStats, countChars, PreviewLine } from '@/utils/notePreviewUtils'
import type { DailyTask } from '@/types'

// 笔记数据类型（简化版）
interface Note {
  id: string
  content: any // JSONContent
  plain_text?: string
  note_date: string
}

interface NotePreviewTooltipProps {
  date: Date
  note: Note | null
  tasks?: DailyTask[]  // 📌 新增：任务列表
  position: { x: number; y: number }
  isLoading?: boolean
  onAddToToday?: (task: DailyTask) => Promise<void>  // 📌 新增：添加到今天的回调
  onMouseEnter?: () => void  // 📌 鼠标进入预览框
  onMouseLeave?: () => void  // 📌 鼠标离开预览框
}

/**
 * 笔记预览悬浮卡片组件
 * 用于在日历视图中悬停显示笔记内容
 */
export default function NotePreviewTooltip({
  date,
  note,
  tasks = [],
  position,
  isLoading = false,
  onAddToToday,
  onMouseEnter,
  onMouseLeave
}: NotePreviewTooltipProps) {
  // 状态：跟踪正在添加和已添加的任务
  const [addingTaskIds, setAddingTaskIds] = useState<Set<string>>(new Set())
  const [addedTaskIds, setAddedTaskIds] = useState<Set<string>>(new Set())

  // 格式化日期显示
  const formattedDate = format(date, 'yyyy年M月d日 EEEE', { locale: zhCN })

  // 解析笔记内容
  const previewLines = note ? extractPreviewLines(note.content, 10) : []
  const taskStats = note ? extractTaskStats(note.content) : { total: 0, completed: 0, pending: 0 }
  const charCount = note ? countChars(note.plain_text || '') : 0

  // 处理添加任务到今天
  const handleAddClick = async (task: DailyTask) => {
    if (!onAddToToday) return

    try {
      // 1. 设置加载状态
      setAddingTaskIds(prev => new Set(prev).add(task.id))
      
      // 2. 调用回调
      await onAddToToday(task)
      
      // 3. 设置成功状态
      setAddingTaskIds(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
      setAddedTaskIds(prev => new Set(prev).add(task.id))
      
      // 4. 1秒后恢复按钮状态
      setTimeout(() => {
        setAddedTaskIds(prev => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }, 1000)
      
    } catch (error) {
      // 5. 错误处理
      setAddingTaskIds(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
      console.error('添加任务失败:', error)
    }
  }

  return (
    <div
      className="fixed z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)' // 居中对齐
      }}
      onMouseEnter={onMouseEnter}  // 📌 绑定鼠标进入事件
      onMouseLeave={onMouseLeave}  // 📌 绑定鼠标离开事件
    >
      {/* 顶部：日期标题 */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="text-sm font-medium text-gray-900">
          📅 {formattedDate}
        </div>
      </div>

      {/* 中间：内容区域 - 只显示任务列表 */}
      <div className="px-4 py-3 max-h-96 overflow-y-auto">
        {/* 加载状态 */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && (!tasks || tasks.length === 0) && (
          <div className="text-center py-6 text-gray-400 text-sm">
            <div className="text-2xl mb-2">📋</div>
            <div>暂无任务</div>
          </div>
        )}

        {/* 📌 任务列表区域（完整显示） */}
        {!isLoading && tasks && tasks.length > 0 && onAddToToday && (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="group pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
                {/* 第一行：checkbox + 标题 + 添加按钮 */}
                <div className="flex items-start gap-2 mb-1.5">
                  {/* Checkbox */}
                  <span className="text-base text-gray-600 flex-shrink-0 mt-0.5">
                    {task.is_completed ? '☑' : '☐'}
                  </span>
                  
                  {/* 标题 */}
                  <span
                    className={`text-sm font-medium flex-1 leading-snug ${
                      task.is_completed
                        ? 'line-through text-gray-400'
                        : 'text-gray-800'
                    }`}
                  >
                    {task.title}
                  </span>

                  {/* 添加按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddClick(task)
                    }}
                    disabled={addingTaskIds.has(task.id)}
                    className={`
                      transition-all duration-200
                      text-xs px-2 py-1 rounded
                      flex items-center gap-1 flex-shrink-0
                      ${
                        addedTaskIds.has(task.id)
                          ? 'opacity-100 bg-green-50 text-green-600 cursor-default'
                          : addingTaskIds.has(task.id)
                          ? 'opacity-100 bg-gray-50 text-gray-400 cursor-wait'
                          : 'opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }
                    `}
                  >
                    {addedTaskIds.has(task.id) ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>已添加</span>
                      </>
                    ) : addingTaskIds.has(task.id) ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>添加</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 第二行：时间（如果有） */}
                {(task as any).timeInfo && (
                  <div className="flex items-center gap-1.5 ml-6 mb-1">
                    <span className="text-xs text-gray-500">
                      {(task as any).timeInfo}
                    </span>
                  </div>
                )}

                {/* 第三行：标签（如果有） */}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-6">
                    {task.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部：统计信息（基于任务数据） */}
      {!isLoading && tasks && tasks.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-500 flex items-center gap-3">
            <span>
              ✓ {tasks.filter(t => t.is_completed || t.completed).length}/{tasks.length}个任务
            </span>
            {note && charCount > 0 && (
              <span>📊 {charCount}字</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 预览内容渲染组件
 */
function PreviewContent({ lines }: { lines: PreviewLine[] }) {
  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        // 渲染标题
        if (line.type === 'heading') {
          const HeadingTag = `h${line.level || 1}` as keyof JSX.IntrinsicElements
          const sizeClass = line.level === 1 ? 'text-base' : 'text-sm'
          return (
            <HeadingTag
              key={idx}
              className={`font-semibold text-gray-900 ${sizeClass}`}
            >
              {line.text}
            </HeadingTag>
          )
        }

        // 渲染任务项（带 checkbox）
        if (line.type === 'taskItem') {
          return (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {/* Checkbox 图标 */}
              <span className="text-gray-600 mt-0.5 flex-shrink-0">
                {line.checked ? '☑' : '☐'}
              </span>
              {/* 任务文本 - 已完成的显示删除线和灰色 */}
              <span
                className={
                  line.checked
                    ? 'line-through text-gray-400'
                    : 'text-gray-700'
                }
              >
                {line.text}
              </span>
            </div>
          )
        }

        // 渲染普通段落
        return (
          <p key={idx} className="text-sm text-gray-700 leading-relaxed">
            {line.text}
          </p>
        )
      })}
    </div>
  )
}

