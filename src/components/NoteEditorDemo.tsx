'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface NoteEditorDemoProps {
  initialContent?: any
  onUpdate?: (content: any) => void
  placeholder?: string
}

export default function NoteEditorDemo({
  initialContent,
  onUpdate,
  placeholder = '输入 [] 创建待办，或直接开始输入...'
}: NoteEditorDemoProps) {
  
  const editor = useEditor({
    immediatelyRender: false,  // 🔧 修复 SSR 水合错误
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
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3'
      }
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      onUpdate?.(json)
    },
  })

  // 调试：打印编辑器内容
  useEffect(() => {
    if (editor) {
      console.log('Editor initialized:', editor.getJSON())
    }
  }, [editor])

  if (!editor) {
    return <div className="p-4 text-gray-500">加载编辑器...</div>
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
      {/* 工具栏 */}
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('taskList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
          title="任务列表 (Ctrl+Shift+9)"
        >
          ☐ 待办
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H1
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          H3
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          • 列表
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition ${
            editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
        >
          1. 有序
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition font-bold ${
            editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
        >
          B
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition italic ${
            editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
        >
          I
        </button>

        <div className="flex-1" />

        <button
          onClick={() => editor.commands.undo()}
          disabled={!editor.can().undo()}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200 transition text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>

        <button
          onClick={() => editor.commands.redo()}
          disabled={!editor.can().redo()}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200 transition text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {/* 编辑器主体 */}
      <EditorContent editor={editor} />

      {/* 底部提示栏 */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          💡 提示: 输入 <code className="px-1 py-0.5 bg-gray-200 rounded">[ ]</code> + 空格创建待办项
        </span>
        <span className="text-gray-400">
          {editor.storage.characterCount?.characters() || 0} 字符
        </span>
      </div>
    </div>
  )
}

