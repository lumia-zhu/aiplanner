'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Extension, InputRule } from '@tiptap/core'

const TaskListMarkdown = Extension.create({
  name: 'taskListMarkdown',
  addInputRules() {
    return [
      new InputRule({
        find: /^(\s*)\[\]\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleTaskList()
        }
      }),
      new InputRule({
        find: /^(\s*)([-+*])\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleBulletList()
        }
      }),
      new InputRule({
        find: /^(\s*)(\d+)\.\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleOrderedList()
        }
      }),
      new InputRule({
        find: /^(\s*)#\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 1 })
        }
      }),
      new InputRule({
        find: /^(\s*)##\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 2 })
        }
      }),
      new InputRule({
        find: /^(\s*)###\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 3 })
        }
      }),
    ]
  }
})

interface NoteEditorProps {
  initialContent?: JSONContent
  onSave?: (content: JSONContent) => void
  placeholder?: string
  editable?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
}

export default function NoteEditor({
  initialContent,
  onSave,
  placeholder = 'Start writing... Type [] for tasks, # for headings, - for lists',
  editable = true,
  autoSave = true,
  autoSaveDelay = 1000
}: NoteEditorProps) {
  
  const [showBubbleMenu, setShowBubbleMenu] = useState(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState({ top: 0, left: 0 })
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder
      }),
      TaskListMarkdown,
    ],
    content: initialContent || {
      type: 'doc',
      content: [
        { type: 'paragraph' }
      ]
    },
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3'
      },
      handleKeyDown: (view, event) => {
        // 处理 Tab 键缩进
        if (event.key === 'Tab') {
          event.preventDefault()
          
          if (event.shiftKey) {
            // Shift+Tab: 减少缩进
            return editor?.commands.liftListItem('taskItem') || 
                   editor?.commands.liftListItem('listItem') || 
                   false
          } else {
            // Tab: 增加缩进
            return editor?.commands.sinkListItem('taskItem') || 
                   editor?.commands.sinkListItem('listItem') || 
                   false
          }
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      if (autoSave && onSave) {
        // 使用防抖，避免频繁保存
        debouncedSave(editor.getJSON())
      }
    },
  })

  // 防抖保存函数
  const debouncedSave = useCallback(
    debounce((content: JSONContent) => {
      console.log('📝 NoteEditor: 触发自动保存', content)
      onSave?.(content)
    }, autoSaveDelay),
    [onSave, autoSaveDelay]
  )

  // 当 initialContent 改变时更新编辑器
  useEffect(() => {
    if (editor && initialContent) {
      const currentContent = editor.getJSON()
      if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent)
      }
    }
  }, [editor, initialContent])

  // 监听文本选择，显示浮动菜单
  useEffect(() => {
    if (!editor) return

    const updateBubbleMenu = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (hasSelection && editable) {
        // 获取选中文本的位置
        const { view } = editor
        const start = view.coordsAtPos(from)
        const end = view.coordsAtPos(to)
        
        // 计算菜单位置（选中文本上方居中）
        const left = (start.left + end.left) / 2
        const top = start.top - 50 // 菜单高度约 40px，留 10px 间距
        
        setBubbleMenuPosition({ top, left })
        setShowBubbleMenu(true)
      } else {
        setShowBubbleMenu(false)
      }
    }

    editor.on('selectionUpdate', updateBubbleMenu)
    editor.on('update', updateBubbleMenu)

    return () => {
      editor.off('selectionUpdate', updateBubbleMenu)
      editor.off('update', updateBubbleMenu)
    }
  }, [editor, editable])

  if (!editor) {
    return <div className="p-4 text-gray-500">加载编辑器...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 编辑器主体 */}
      <EditorContent editor={editor} />

      {/* 浮动工具栏 - 选中文本时显示 */}
      {showBubbleMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 text-gray-700 rounded-lg px-1.5 py-1.5 flex items-center gap-1 animate-bubble-menu"
          style={{
            top: `${bubbleMenuPosition.top}px`,
            left: `${bubbleMenuPosition.left}px`,
            transform: 'translateX(-50%)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* 待办列表 - 移到最左边 */}
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('taskList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="待办列表 ([] + 空格)"
          >
            ☐
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 粗体 */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 font-bold ${
              editor.isActive('bold') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="粗体 (⌘B)"
          >
            B
          </button>

          {/* 斜体 */}
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 italic ${
              editor.isActive('italic') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="斜体 (⌘I)"
          >
            I
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 标题 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 1 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="一级标题 (# + 空格)"
          >
            H1
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="二级标题 (## + 空格)"
          >
            H2
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 3 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="三级标题 (### + 空格)"
          >
            H3
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 列表 */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('bulletList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="无序列表 (- + 空格)"
          >
            •
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('orderedList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="有序列表 (1. + 空格)"
          >
            1.
          </button>
        </div>
      )}

      {/* 底部提示栏 */}
      {editable && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-500 leading-relaxed">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-medium text-gray-600">💡 Markdown 快捷键:</span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">[]</code> 待办
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">#</code> 标题
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">-</code> 列表
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">1.</code> 有序
            </span>
            <span className="text-gray-400">|</span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">Tab</code> 缩进
            </span>
            {autoSave && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-green-600 font-medium">✓ 自动保存</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 简单的防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}


