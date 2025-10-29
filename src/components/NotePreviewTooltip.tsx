'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { extractPreviewLines, extractTaskStats, countChars, PreviewLine } from '@/utils/notePreviewUtils'

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
  position: { x: number; y: number }
  isLoading?: boolean
}

/**
 * 笔记预览悬浮卡片组件
 * 用于在日历视图中悬停显示笔记内容
 */
export default function NotePreviewTooltip({
  date,
  note,
  position,
  isLoading = false
}: NotePreviewTooltipProps) {
  // 格式化日期显示
  const formattedDate = format(date, 'yyyy年M月d日 EEEE', { locale: zhCN })

  // 解析笔记内容
  const previewLines = note ? extractPreviewLines(note.content, 10) : []
  const taskStats = note ? extractTaskStats(note.content) : { total: 0, completed: 0, pending: 0 }
  const charCount = note ? countChars(note.plain_text || '') : 0

  return (
    <div
      className="fixed z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)' // 居中对齐
      }}
    >
      {/* 顶部：日期标题 */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="text-sm font-medium text-gray-900">
          📅 {formattedDate}
        </div>
      </div>

      {/* 中间：内容区域 */}
      <div className="px-4 py-3 max-h-80 overflow-y-auto">
        {/* 加载状态 */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && !note && (
          <div className="text-center py-6 text-gray-400 text-sm">
            <div className="text-2xl mb-2">📝</div>
            <div>暂无笔记</div>
          </div>
        )}

        {/* 有内容时显示 - 使用解析后的结构化数据 */}
        {!isLoading && note && previewLines.length > 0 && (
          <PreviewContent lines={previewLines} />
        )}

        {/* 笔记为空 */}
        {!isLoading && note && previewLines.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-sm">
            (空笔记)
          </div>
        )}
      </div>

      {/* 底部：统计信息 */}
      {!isLoading && note && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-500 flex items-center gap-3">
            {taskStats.total > 0 && (
              <span>
                ✓ {taskStats.completed}/{taskStats.total}个任务
              </span>
            )}
            <span>📊 {charCount}字</span>
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

