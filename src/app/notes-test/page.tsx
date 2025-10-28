'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NoteEditor from '@/components/NoteEditor'
import { getNoteByDate, saveNote, extractMetadata } from '@/lib/notes'
import { createClient } from '@/lib/supabase-client'
import type { JSONContent } from '@tiptap/core'
import type { User } from '@/types'

export default function NotesTestPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [noteContent, setNoteContent] = useState<JSONContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // 检查登录状态
  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    // 从 localStorage 获取登录用户（自定义认证系统）
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    
    if (!userStr) {
      router.push('/auth/login')
      return
    }

    try {
      const userData = JSON.parse(userStr)
      setUser(userData)
      loadNote(userData.id, selectedDate)
    } catch (error) {
      console.error('解析用户数据失败:', error)
      router.push('/auth/login')
      return
    }
    
    setLoading(false)
  }

  // 加载指定日期的笔记
  async function loadNote(userId: string, date: Date) {
    try {
      const note = await getNoteByDate(userId, date)
      if (note) {
        setNoteContent(note.content)
      } else {
        // 没有笔记，使用空白内容
        setNoteContent({
          type: 'doc',
          content: [{ type: 'paragraph' }]
        })
      }
    } catch (error) {
      console.error('加载笔记失败:', error)
      alert('加载笔记失败')
    }
  }

  // 保存笔记
  async function handleSave(content: JSONContent) {
    if (!user) return
    
    setSaving(true)
    try {
      await saveNote(user.id, selectedDate, content)
      setLastSaved(new Date())
      console.log('✅ 笔记已保存')
    } catch (error) {
      console.error('保存笔记失败:', error)
      alert('保存笔记失败')
    } finally {
      setSaving(false)
    }
  }

  // 切换日期
  function changeDate(offset: number) {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + offset)
    setSelectedDate(newDate)
    if (user) {
      loadNote(user.id, newDate)
    }
  }

  // 格式化日期显示
  function formatDate(date: Date): string {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return '今天'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨天'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return '明天'
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // 获取元数据
  const metadata = noteContent ? extractMetadata(noteContent) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 页面头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              📝 Notes
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                欢迎，{user.username}
              </span>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                返回 Dashboard
              </button>
            </div>
          </div>

          {/* 日期选择器 */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg hover:bg-gray-200 transition"
              title="前一天"
            >
              ←
            </button>
            
            <div className="flex-1 text-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {formatDate(selectedDate)}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })}
              </p>
            </div>

            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-lg hover:bg-gray-200 transition"
              title="后一天"
            >
              →
            </button>

            <button
              onClick={() => {
                setSelectedDate(new Date())
                if (user) loadNote(user.id, new Date())
              }}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              回到今天
            </button>
          </div>

          {/* 保存状态 */}
          <div className="flex items-center gap-4 text-sm">
            {saving && <span className="text-blue-600">💾 保存中...</span>}
            {!saving && lastSaved && (
              <span className="text-green-600">
                ✓ 已保存 · {lastSaved.toLocaleTimeString('zh-CN')}
              </span>
            )}
            
            {/* 元数据统计 */}
            {metadata && (
              <div className="flex gap-4 text-gray-600">
                {metadata.pending_tasks_count > 0 && (
                  <span>☐ {metadata.pending_tasks_count} 待办</span>
                )}
                {metadata.completed_tasks_count > 0 && (
                  <span>✓ {metadata.completed_tasks_count} 完成</span>
                )}
                {metadata.tags.length > 0 && (
                  <span>🏷️ {metadata.tags.length} 标签</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 编辑器 */}
        {noteContent && (
          <NoteEditor
            key={selectedDate.toISOString()}  // 强制重新渲染
            initialContent={noteContent}
            onSave={handleSave}
            autoSave={true}
            autoSaveDelay={1000}
          />
        )}

        {/* 调试信息 */}
        {metadata && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">📊 笔记统计</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• 纯文本长度: {metadata.plain_text.length} 字符</p>
              <p>• 待办任务: {metadata.pending_tasks_count} 个</p>
              <p>• 已完成: {metadata.completed_tasks_count} 个</p>
              {metadata.tags.length > 0 && (
                <p>• 标签: {metadata.tags.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

