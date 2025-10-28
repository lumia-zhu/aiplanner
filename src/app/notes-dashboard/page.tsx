'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getNoteByDate, saveNote, extractMetadata } from '@/lib/notes'
import type { JSONContent } from '@tiptap/core'
import NoteEditor from '@/components/NoteEditor'
import CalendarView from '@/components/CalendarView'
import DateScopeSelector from '@/components/DateScopeSelector'
import ChatSidebar from '@/components/ChatSidebar'
import UserProfileModal from '@/components/UserProfileModal'
import { doubaoService, type ChatMessage } from '@/lib/doubaoService'
import { saveChatMessage, getChatMessages, clearChatMessages } from '@/lib/chatMessages'
import { getUserProfile } from '@/lib/userProfile'
import type { DateScope, UserProfile } from '@/types'
import { getDefaultDateScope, serializeDateScope, deserializeDateScope } from '@/utils/dateUtils'
import { format } from 'date-fns'

export default function NotesDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // 笔记相关状态
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [noteContent, setNoteContent] = useState<JSONContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  // 日期范围
  const [dateScope, setDateScope] = useState<DateScope>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dateScope')
      if (saved) {
        try {
          return deserializeDateScope(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to parse saved dateScope:', e)
        }
      }
    }
    return getDefaultDateScope()
  })
  
  // AI 对话框状态
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('chatSidebarOpen')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  
  // 用户资料弹窗
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // 初始化：检查登录状态
  useEffect(() => {
    const userData = getUserFromStorage()
    if (!userData) {
      router.push('/auth/login')
      return
    }
    setUser(userData)
    loadUserProfile(userData.id)
    loadNote(userData.id, selectedDate)
    setIsLoading(false)
  }, [])

  // 加载用户资料
  async function loadUserProfile(userId: string) {
    try {
      const profile = await getUserProfile(userId)
      setUserProfile(profile)
    } catch (error) {
      console.error('加载用户资料失败:', error)
    }
  }

  // 加载笔记
  async function loadNote(userId: string, date: Date) {
    try {
      const note = await getNoteByDate(userId, date)
      if (note) {
        setNoteContent(note.content)
      } else {
        // 空白笔记
        setNoteContent({
          type: 'doc',
          content: [{ type: 'paragraph' }]
        })
      }
    } catch (error) {
      console.error('加载笔记失败:', error)
    }
  }

  // 保存笔记
  async function handleSaveNote(content: JSONContent) {
    if (!user) return
    
    setSaving(true)
    try {
      await saveNote(user.id, selectedDate, content)
      setLastSaved(new Date())
      setNoteContent(content)
    } catch (error) {
      console.error('保存笔记失败:', error)
    } finally {
      setSaving(false)
    }
  }

  // 切换日期
  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    if (user) {
      loadNote(user.id, date)
    }
  }

  // 日期范围变化
  function handleDateScopeChange(newScope: DateScope) {
    setDateScope(newScope)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dateScope', JSON.stringify(serializeDateScope(newScope)))
    }
  }

  // 登出
  function handleLogout() {
    clearUserFromStorage()
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('dateScope')
      sessionStorage.removeItem('chatSidebarOpen')
    }
    router.push('/auth/login')
  }

  // 切换 AI 侧边栏
  function toggleChatSidebar() {
    const newState = !isChatSidebarOpen
    setIsChatSidebarOpen(newState)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('chatSidebarOpen', JSON.stringify(newState))
    }
  }

  // 获取笔记元数据
  const metadata = noteContent ? extractMetadata(noteContent) : null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 左侧：标题 */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900">📝 Notes</h1>
              
              {/* 保存状态 */}
              <div className="text-sm">
                {saving && <span className="text-blue-600">💾 Saving...</span>}
                {!saving && lastSaved && (
                  <span className="text-green-600">
                    ✓ Saved · {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {/* 右侧：用户信息 + AI 按钮 */}
            <div className="flex items-center gap-4">
              {/* 元数据统计 */}
              {metadata && (
                <div className="flex gap-3 text-sm text-gray-600">
                  {metadata.pending_tasks_count > 0 && (
                    <span>☐ {metadata.pending_tasks_count}</span>
                  )}
                  {metadata.completed_tasks_count > 0 && (
                    <span>✓ {metadata.completed_tasks_count}</span>
                  )}
                  {metadata.tags.length > 0 && (
                    <span>🏷️ {metadata.tags.length}</span>
                  )}
                </div>
              )}

              {/* AI 助手按钮 */}
              <button
                onClick={toggleChatSidebar}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg transition
                  ${isChatSidebarOpen 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
                title="Toggle AI Assistant (Ctrl+B)"
              >
                <span className="text-sm font-medium">
                  🤖 AI Assistant
                  {!doubaoService.hasApiKey() && ' (API Key required)'}
                </span>
              </button>

              {/* 用户菜单 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="text-gray-700 hover:text-gray-900"
                  title="Personal Profile"
                >
                  <span className="text-sm">Welcome, <span className="font-medium">{user.username}</span></span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 左侧：日期选择 + 日历 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 日期范围选择器 */}
            <DateScopeSelector
              dateScope={dateScope}
              onScopeChange={handleDateScopeChange}
            />

            {/* 日历视图 */}
            <CalendarView
              tasks={[]}  // 笔记模式不显示任务，可以后续改为显示笔记标记
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              dateScope={dateScope}
            />
          </div>

          {/* 右侧：笔记编辑器 */}
          <div className="lg:col-span-3">
            {/* 日期标题 */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {format(selectedDate, 'MMMM dd, yyyy')}
              </h2>
              <p className="text-sm text-gray-600">
                {format(selectedDate, 'EEEE')}
              </p>
            </div>

            {/* 编辑器 */}
            {noteContent && (
              <NoteEditor
                key={selectedDate.toISOString()}
                initialContent={noteContent}
                onSave={handleSaveNote}
                autoSave={true}
                autoSaveDelay={1000}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI 侧边栏 */}
      {isChatSidebarOpen && (
        <ChatSidebar
          isOpen={isChatSidebarOpen}
          onClose={() => setIsChatSidebarOpen(false)}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          user={user}
          userProfile={userProfile}
          tasks={[]}  // 笔记模式暂不传任务
          onTasksUpdate={() => {}}
          selectedDate={selectedDate}
          dateScope={dateScope}
        />
      )}

      {/* 用户资料弹窗 */}
      {showProfileModal && user && (
        <UserProfileModal
          userId={user.id}
          onClose={() => setShowProfileModal(false)}
          onSave={async () => {
            await loadUserProfile(user.id)
            setShowProfileModal(false)
          }}
        />
      )}
    </div>
  )
}

