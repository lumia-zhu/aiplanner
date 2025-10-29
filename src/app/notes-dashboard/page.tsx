'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getNoteByDate, saveNote } from '@/lib/notes'
import { JSONContent } from '@tiptap/react'
import NoteEditor from '@/components/NoteEditor'
import CalendarView from '@/components/CalendarView'
import DateScopeSelector from '@/components/DateScopeSelector'
import ChatSidebar from '@/components/ChatSidebar'
import UserProfileModal from '@/components/UserProfileModal'
import type { DateScope, UserProfile } from '@/types'
import { getDefaultDateScope } from '@/utils/dateUtils'
import { format } from 'date-fns'
import { getUserProfile, upsertUserProfile, type UserProfileInput } from '@/lib/userProfile'

export default function NotesDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // 日期相关状态
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dateScope, setDateScope] = useState<DateScope>(getDefaultDateScope())
  
  // 笔记相关状态
  const [currentNote, setCurrentNote] = useState<JSONContent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0 })
  
  // AI 对话框状态
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('chatSidebarOpen')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [chatMessage, setChatMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [isSending, setIsSending] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isImageProcessing, setIsImageProcessing] = useState(false)
  
  // 任务识别相关状态（笔记模式暂不使用，但 ChatSidebar 需要）
  const [isTaskRecognitionMode, setIsTaskRecognitionMode] = useState(false)
  const [recognizedTasks, setRecognizedTasks] = useState<any[]>([])
  const [showTaskPreview, setShowTaskPreview] = useState(false)
  
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
  }, [router, selectedDate])

  // 加载用户资料
  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const profile = await getUserProfile(userId)
      setUserProfile(profile)
    } catch (error) {
      console.error('加载用户资料失败:', error)
    }
  }, [])

  // 计算笔记中的任务统计
  const calculateTaskStats = useCallback((content: JSONContent | null) => {
    if (!content) {
      setTaskStats({ total: 0, completed: 0 })
      return
    }

    let total = 0
    let completed = 0

    const traverse = (node: any) => {
      if (node.type === 'taskItem') {
        total++
        if (node.attrs?.checked) {
          completed++
        }
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse)
      }
    }

    traverse(content)
    setTaskStats({ total, completed })
  }, [])

  // 加载指定日期的笔记
  const loadNote = useCallback(async (userId: string, date: Date) => {
    try {
      const note = await getNoteByDate(userId, date)
      if (note) {
        setCurrentNote(note.content)
        calculateTaskStats(note.content) // 计算任务统计
      } else {
        // 没有笔记，使用空白内容
        const emptyContent = {
          type: 'doc',
          content: [{ type: 'paragraph' }]
        }
        setCurrentNote(emptyContent)
        calculateTaskStats(emptyContent)
      }
    } catch (error) {
      console.error('加载笔记失败:', error)
      alert('加载笔记失败')
    }
  }, [calculateTaskStats])

  // 处理笔记内容更新（实时更新统计，不保存）
  const handleNoteUpdate = useCallback((content: JSONContent) => {
    calculateTaskStats(content) // 实时更新任务统计
  }, [calculateTaskStats])

  // 保存笔记
  const handleNoteSave = useCallback(async (content: JSONContent) => {
    if (!user) return

    setIsSaving(true)
    try {
      await saveNote(user.id, selectedDate, content)
      setLastSaved(new Date())
      console.log('✅ 笔记已保存')
    } catch (error) {
      console.error('保存笔记失败:', error)
      alert('保存笔记失败')
    } finally {
      setIsSaving(false)
    }
  }, [user, selectedDate])

  // 处理日期选择
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
  }, [])

  // 处理日期范围变化
  const handleDateScopeChange = useCallback((newScope: DateScope) => {
    setDateScope(newScope)
  }, [])

  // 登出
  const handleLogout = () => {
    clearUserFromStorage()
    router.push('/auth/login')
  }

  // 处理用户资料更新
  const handleUserProfileSave = useCallback(async (profileInput: UserProfileInput) => {
    if (!user) return
    try {
      const updatedProfile = await upsertUserProfile(user.id, profileInput)
      setUserProfile(updatedProfile)
      setShowProfileModal(false)
      alert('个人资料已更新！')
    } catch (error) {
      console.error('更新用户资料失败:', error)
      alert('更新用户资料失败')
    }
  }, [user])

  // 切换 AI 侧边栏
  const toggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen(prev => !prev)
  }, [])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">📝 Notes</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                欢迎, <span className="font-medium">{user.username}</span>
              </span>
              {/* 个人资料图标按钮 */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
                title="个人资料设置"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {/* 如果有个人资料，显示小绿点提示 */}
                {userProfile && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="py-6 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="max-w-7xl mx-auto">
          {/* flex布局容器：在主内容区域内部分左右 */}
          <div className="flex gap-6 h-[calc(100vh-8rem)]">
            {/* 左侧：笔记管理区域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out relative pb-24">
              
              {/* 日期范围选择器 - 暂时隐藏 */}
              {/* <DateScopeSelector 
                scope={dateScope}
                onScopeChange={handleDateScopeChange}
              /> */}

              {/* 日历视图 - 保留显示 */}
              <CalendarView 
                tasks={[]}  // 笔记模式暂时不显示任务标记
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                dateScope={dateScope}
              />

              {/* 任务进度条 */}
              <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">任务进度</span>
                  <span className="text-sm text-gray-600">
                    {taskStats.completed}/{taskStats.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: taskStats.total > 0 ? `${(taskStats.completed / taskStats.total) * 100}%` : '0%'
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% 完成
                  </span>
                  {taskStats.total > 0 && taskStats.completed === taskStats.total && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      全部完成！
                    </span>
                  )}
                </div>
              </div>

              {/* 日期标题和保存状态 */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {format(selectedDate, 'yyyy年MM月dd日')}
                  </h2>
                  <p className="text-gray-600">
                    {isSaving ? '保存中...' : lastSaved ? `最后保存: ${format(lastSaved, 'HH:mm:ss')}` : '未保存'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {/* 回到今天按钮 */}
                  {selectedDate.toDateString() !== new Date().toDateString() && (
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                      style={{ backgroundColor: '#3B82F6' }}
                      title="回到今天"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      回到今天
                    </button>
                  )}
                  <button
                    onClick={toggleChatSidebar}
                    className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                    style={{ backgroundColor: '#9B59B6' }}
                    title="打开AI助手"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    AI助手
                  </button>
                </div>
              </div>

              {/* 笔记编辑器 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <NoteEditor
                  initialContent={currentNote}
                  onUpdate={handleNoteUpdate}
                  onSave={handleNoteSave}
                  placeholder="开始记录你的想法..."
                />
              </div>

              {/* 浮动AI助手按钮 - 固定在屏幕右下角 */}
              {!isChatSidebarOpen && (
                <button
                  onClick={toggleChatSidebar}
                  className="fixed right-4 bottom-4 z-40 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
                  title="展开AI助手 (Ctrl+B)"
                >
                  {/* AI图标 */}
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  {/* 悬停提示 */}
                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                    AI助手
                  </span>
                </button>
              )}
            </div>

            {/* 右侧：AI聊天侧边栏 */}
            <ChatSidebar
              isOpen={isChatSidebarOpen}
              onToggle={toggleChatSidebar}
              chatMessage={chatMessage}
              setChatMessage={setChatMessage}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              isSending={isSending}
              streamingMessage={streamingMessage}
              isDragOver={isDragOver}
              isImageProcessing={isImageProcessing}
              isTaskRecognitionMode={isTaskRecognitionMode}
              setIsTaskRecognitionMode={setIsTaskRecognitionMode}
              recognizedTasks={recognizedTasks}
              showTaskPreview={showTaskPreview}
              setShowTaskPreview={setShowTaskPreview}
            />
          </div>
        </div>
      </main>

      {/* 用户个人资料弹窗 */}
      {user && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userId={user.id}
          initialProfile={userProfile}
          onSave={handleUserProfileSave}
        />
      )}
    </div>
  )
}
