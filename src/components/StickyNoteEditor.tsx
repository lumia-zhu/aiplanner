/**
 * 便签富文本编辑器
 * 轻量版 Tiptap 编辑器，专为便签设计
 */

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'

interface StickyNoteEditorProps {
  content: string                              // 便签内容（HTML格式）
  onUpdate: (content: string) => void          // 内容更新回调
  onBlur: () => void                           // 失焦回调
  backgroundColorClass: string                 // 背景色类名（Tailwind）
  isEditing: boolean                           // 是否处于编辑状态
}

export default function StickyNoteEditor({
  content,
  onUpdate,
  onBlur,
  backgroundColorClass,
  isEditing
}: StickyNoteEditorProps) {
  
  // 初始化编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 禁用不需要的功能
        heading: false,           // 不需要标题
        code: false,              // 不需要代码
        codeBlock: false,         // 不需要代码块
        blockquote: false,        // 不需要引用
        horizontalRule: false,    // 不需要分隔线
        
        // 保留需要的功能
        bold: true,               // 加粗
        italic: true,             // 斜体
        strike: true,             // 删除线
        bulletList: true,         // 无序列表
        orderedList: true,        // 有序列表
        listItem: true,           // 列表项
        paragraph: true,          // 段落
        hardBreak: true,          // 硬换行
        history: true,            // 撤销/重做
      }),
      Underline,                  // 下划线扩展
    ],
    content: content,
    editable: isEditing,
    immediatelyRender: false,     // 🔧 修复 SSR 问题：禁用立即渲染
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
    onBlur: () => {
      onBlur()
    },
    editorProps: {
      attributes: {
        class: 'outline-none text-sm text-gray-800 leading-relaxed sticky-note-editor',
      },
    },
  })

  // 同步编辑状态
  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  // 同步内容（当外部内容变化时）
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // ⚠️ 输入法(IME)拼字期间不要 setContent，否则可能造成重复/乱码
      if (!editor.view?.composing) {
        editor.commands.setContent(content)
      }
    }
  }, [editor, content])

  if (!editor) {
    return null
  }

  return (
    <div className="h-full flex flex-col">
      {/* 编辑器内容区域 */}
      <div 
        className={`flex-1 overflow-y-auto px-3 py-2 ${backgroundColorClass}`}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 格式化工具栏 - 固定在底部常驻 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-300 bg-white/80 flex-shrink-0">
        {/* 加粗 */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-300' : ''
          }`}
          title="加粗"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </button>

        {/* 斜体 */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-300' : ''
          }`}
          title="斜体"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </button>

        {/* 下划线 */}
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('underline') ? 'bg-gray-300' : ''
          }`}
          title="下划线"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </button>

        {/* 删除线 */}
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('strike') ? 'bg-gray-300' : ''
          }`}
          title="删除线"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M3 12h18M7 6h10M7 18h10"/>
          </svg>
        </button>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-gray-400 mx-1"></div>

        {/* 无序列表 */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-300' : ''
          }`}
          title="无序列表"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </button>

        {/* 有序列表 */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-300' : ''
          }`}
          title="有序列表"
        >
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

