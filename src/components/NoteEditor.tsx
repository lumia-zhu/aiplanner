'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import type { JSONContent } from '@tiptap/core'

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
  placeholder = '开始记录你的想法...',
  editable = true,
  autoSave = true,
  autoSaveDelay = 1000
}: NoteEditorProps) {
  
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
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        }
      }),
      Placeholder.configure({
        placeholder
      }),
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

  if (!editor) {
    return <div className="p-4 text-gray-500">加载编辑器...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 工具栏 */}
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive('taskList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
          title="任务列表 (Ctrl+Shift+9)"
        >
          ☐ 待办
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H1
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H3
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 ${
            editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          • 列表
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition disabled:opacity-50 ${
            editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          1. 有序
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition font-bold disabled:opacity-50 ${
            editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
        >
          B
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editable}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition italic disabled:opacity-50 ${
            editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
        >
          I
        </button>

        <div className="flex-1" />

        <button
          onClick={() => editor.commands.undo()}
          disabled={!editor.can().undo() || !editable}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200 transition text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>

        <button
          onClick={() => editor.commands.redo()}
          disabled={!editor.can().redo() || !editable}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200 transition text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {/* 编辑器主体 */}
      <EditorContent editor={editor} />

      {/* 底部提示栏 */}
      {editable && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          💡 提示: 输入 <code className="px-1 py-0.5 bg-gray-200 rounded">[ ]</code> + 空格创建待办项
          {autoSave && <span className="ml-4">✓ 自动保存</span>}
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

