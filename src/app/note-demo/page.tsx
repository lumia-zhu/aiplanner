'use client'

import { useState } from 'react'
import NoteEditorDemo from '@/components/NoteEditorDemo'

export default function NoteDemoPage() {
  const [content, setContent] = useState<any>(null)
  const [savedContent, setSavedContent] = useState<any>(null)

  const handleSave = () => {
    setSavedContent(content)
    alert('✅ 笔记已保存到状态！')
  }

  const handleLoad = () => {
    if (savedContent) {
      // 强制重新渲染编辑器
      window.location.reload()
    }
  }

  const sampleNote = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: '📝 今天的计划' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '这是一个示例笔记，展示 Notion-lite 的基本功能。' }]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '✅ 待办事项' }]
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '准备考试材料 ' }, { type: 'text', text: '#重要', marks: [{ type: 'bold' }] }]
              }
            ]
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '完成项目报告 ' }, { type: 'text', text: '📅 2024-10-25', marks: [{ type: 'italic' }] }]
              }
            ]
          },
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '已完成的任务' }]
              }
            ]
          }
        ]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '📌 笔记区域' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '这里可以自由记录想法...' }]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '第一条笔记' }]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '第二条笔记' }]
              }
            ]
          }
        ]
      }
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 页面头部 */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📝 Notion-lite Demo
          </h1>
          <p className="text-gray-600">
            轻量级笔记编辑器 - 可行性验证
          </p>
        </div>

        {/* 功能说明卡片 */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">✨ 当前功能</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ 富文本编辑（标题、段落、列表）</li>
            <li>✅ 待办复选框（可勾选完成）</li>
            <li>✅ 文本格式化（粗体、斜体）</li>
            <li>✅ 撤销/重做功能</li>
            <li>✅ JSON 格式存储</li>
          </ul>
        </div>

        {/* 操作按钮 */}
        <div className="mb-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!content}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            💾 保存笔记
          </button>

          <button
            onClick={() => window.location.href = '/note-demo?load=sample'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                       transition flex items-center gap-2"
          >
            📄 加载示例笔记
          </button>

          <button
            onClick={() => {
              if (confirm('确定要清空编辑器吗？')) {
                window.location.reload()
              }
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                       transition flex items-center gap-2"
          >
            🗑️ 清空
          </button>
        </div>

        {/* 编辑器 */}
        <div className="mb-6">
          <NoteEditorDemo
            initialContent={
              typeof window !== 'undefined' && 
              new URLSearchParams(window.location.search).get('load') === 'sample'
                ? sampleNote
                : undefined
            }
            onUpdate={(newContent) => {
              setContent(newContent)
              console.log('Content updated:', newContent)
            }}
          />
        </div>

        {/* JSON 预览 */}
        {content && (
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">📦 JSON 数据预览</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(content, null, 2))
                  alert('✅ 已复制到剪贴板')
                }}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                复制
              </button>
            </div>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(content, null, 2)}
            </pre>
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">🎯 下一步计划</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>🔜 自定义标签组件（#标签）</li>
            <li>🔜 日期选择器组件（📅 日期）</li>
            <li>🔜 斜杠命令菜单（/ 命令）</li>
            <li>🔜 数据库集成（Supabase）</li>
            <li>🔜 按日期管理笔记</li>
            <li>🔜 AI 助手集成</li>
          </ul>
        </div>
      </div>
    </div>
  )
}










