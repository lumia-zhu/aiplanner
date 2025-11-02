'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getNoteByDate, saveNote, getNotesByDateRange, Note, formatNoteDate } from '@/lib/notes'
import { JSONContent } from '@tiptap/react'
import NoteEditor from '@/components/NoteEditor'
import CalendarView from '@/components/CalendarView'
import DateScopeSelector from '@/components/DateScopeSelector'
import ChatSidebar from '@/components/ChatSidebar'
import UserProfileModal from '@/components/UserProfileModal'
import NotePreviewTooltip from '@/components/NotePreviewTooltip'
import KeyboardShortcutsPanel from '@/components/KeyboardShortcutsPanel'
import StickyNote from '@/components/StickyNote'
import TaskMatrix from '@/components/TaskMatrix'
import MatrixSelector from '@/components/MatrixSelector'
import type { DateScope, UserProfile, ChatMessage, StickyNote as StickyNoteType, TasksByQuadrant, TaskMatrixDimension } from '@/types'
import { getDefaultDateScope } from '@/utils/dateUtils'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { getUserProfile, upsertUserProfile, type UserProfileInput } from '@/lib/userProfile'
import { doubaoService } from '@/lib/doubaoService'
import { saveChatMessage } from '@/lib/chatMessages'
import { getStickyNotesByDate, createStickyNote, updateStickyNote, deleteStickyNote, getMaxZIndex } from '@/lib/stickyNotes'
import { getTaskMatrixByDate, ensureTaskMatrix, updateTaskQuadrant } from '@/lib/taskMatrix'
import { getDailyTasksByDate, toggleDailyTaskComplete } from '@/lib/dailyTasks'
import { syncTasksFromNote, sanitizeTaskTitle } from '@/lib/taskSync'
import type { DailyTask, QuadrantType } from '@/types'

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
  
  // 笔记缓存（用于显示圆点和预览）
  const [notesCache, setNotesCache] = useState<Map<string, Note>>(new Map())
  const [lastLoadedRange, setLastLoadedRange] = useState<{ start: string, end: string } | null>(null)
  
  // 日历视图日期（追踪日历当前显示的月份）
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(selectedDate)
  
  // 悬停预览相关状态
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
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
  
  // 快捷键帮助面板
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false)
  
  // 便签相关状态
  const [stickyNotes, setStickyNotes] = useState<StickyNoteType[]>([])
  const [isLoadingStickyNotes, setIsLoadingStickyNotes] = useState(false)
  
  // 任务矩阵相关状态
  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor')  // 视图模式：编辑器 或 矩阵
  const [selectedMatrixDimension, setSelectedMatrixDimension] = useState<TaskMatrixDimension>('urgent-important')  // 当前选中的矩阵维度
  const [tasksByQuadrant, setTasksByQuadrant] = useState<TasksByQuadrant>({})

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

  // 加载指定日期的便签
  const loadStickyNotes = useCallback(async (userId: string, date: Date) => {
    setIsLoadingStickyNotes(true)
    try {
      const dateStr = formatNoteDate(date)
      console.log(`📋 加载便签: ${dateStr}`)
      const notes = await getStickyNotesByDate(userId, dateStr)
      setStickyNotes(notes)
      console.log(`✅ 加载了 ${notes.length} 个便签`)
    } catch (error) {
      console.error('加载便签失败:', error)
      setStickyNotes([])
    } finally {
      setIsLoadingStickyNotes(false)
    }
  }, [])

  // 加载任务矩阵数据
  const loadTaskMatrix = useCallback(async (userId: string, date: Date) => {
    try {
      const dateStr = formatNoteDate(date)
      console.log(`📊 加载任务矩阵: ${dateStr}`)
      
      // 1. 获取当天的所有笔记任务（从 daily_tasks 表）
      const dailyTasks = await getDailyTasksByDate(userId, dateStr)
      console.log(`📝 找到 ${dailyTasks.length} 个笔记任务`)
      
      // 2. 获取任务的矩阵信息
      const matrixData = await getTaskMatrixByDate(userId, dateStr)
      console.log(`📊 找到 ${matrixData.length} 条矩阵记录`)
      
      // 3. 按象限分组任务
      const grouped: TasksByQuadrant = {
        'unclassified': [],
        'urgent-important': [],
        'not-urgent-important': [],
        'urgent-not-important': [],
        'not-urgent-not-important': [],
      }
      
      // 4. 为每个任务匹配象限信息，并映射为显示格式
      for (const dailyTask of dailyTasks) {
        // 查找任务的矩阵信息
        const matrix = matrixData.find(m => m.taskId === dailyTask.id)
        
        // 映射 DailyTask 为显示格式（兼容 TaskCard 组件）
        const cleanedTitle = sanitizeTaskTitle(dailyTask.title)
        console.log('🧹 清理任务标题:', { original: dailyTask.title, cleaned: cleanedTitle })
        const displayTask: any = {
          id: dailyTask.id,
          user_id: dailyTask.userId,
          title: cleanedTitle,
          completed: dailyTask.completed,
          deadline: dailyTask.deadlineDatetime,
          timeRange: dailyTask.deadlineDatetime ? formatTimeRange(dailyTask.deadlineDatetime) : undefined,
          created_at: dailyTask.createdAt,
          updated_at: dailyTask.updatedAt,
        }
        
        // 如果没有矩阵信息，则初始化为待分类
        if (!matrix) {
          console.log(`⚠️ 任务 ${dailyTask.id} 没有矩阵信息，将自动初始化`)
          await ensureTaskMatrix(userId, dailyTask.id)
          grouped['unclassified'].push(displayTask)
        } else {
          // 按象限分组
          const quadrant = matrix.quadrant as QuadrantType
          if (!grouped[quadrant]) {
            grouped[quadrant] = []
          }
          grouped[quadrant].push(displayTask)
        }
      }
      
      setTasksByQuadrant(grouped)
      
      // 统计信息
      const stats = Object.entries(grouped).map(([quadrant, tasks]) => 
        `${quadrant}: ${tasks.length}`
      ).join(', ')
      console.log(`✅ 任务分组完成: ${stats}`)
      
    } catch (error) {
      console.error('加载任务矩阵失败:', error)
      // 重置为空数据
      setTasksByQuadrant({
        'unclassified': [],
        'urgent-important': [],
        'not-urgent-important': [],
        'urgent-not-important': [],
        'not-urgent-not-important': [],
      })
    }
  }, [])
  
  // 格式化时间范围显示
  const formatTimeRange = (deadlineDatetime: string): string => {
    try {
      const date = new Date(deadlineDatetime)
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  // 加载日期范围内的笔记（用于圆点显示和预览）
  const loadNotesInRange = useCallback(async (userId: string, viewType: 'week' | 'month', referenceDate: Date) => {
    // 根据视图类型计算日期范围
    let startDate: Date
    let endDate: Date
    
    if (viewType === 'week') {
      // 周视图：加载当前周（周一到周日）
      startDate = startOfWeek(referenceDate, { weekStartsOn: 1 }) // 周一开始
      endDate = endOfWeek(referenceDate, { weekStartsOn: 1 })
    } else {
      // 月视图：加载当前月
      startDate = startOfMonth(referenceDate)
      endDate = endOfMonth(referenceDate)
    }
    
    // 检查是否需要重新加载（范围是否改变）
    const startStr = formatNoteDate(startDate)
    const endStr = formatNoteDate(endDate)
    const rangeKey = `${startStr}_${endStr}`
    const lastRangeKey = lastLoadedRange ? `${lastLoadedRange.start}_${lastLoadedRange.end}` : null
    
    if (rangeKey === lastRangeKey && notesCache.size > 0) {
      console.log('📦 使用缓存，无需重新加载')
      console.log('   缓存大小:', notesCache.size)
      return // 范围未变化且缓存不为空，直接返回
    }
    
    if (rangeKey === lastRangeKey && notesCache.size === 0) {
      console.log('⚠️ 缓存范围相同但缓存为空，强制重新加载')
    }
    
    console.log(`📦 加载笔记范围: ${startStr} ~ ${endStr}`)
    
    try {
      // 批量加载笔记
      const notes = await getNotesByDateRange(userId, startDate, endDate)
      
      // 过滤掉空笔记（只保留有实际内容的笔记）
      const nonEmptyNotes = notes.filter(note => {
        // 检查是否有内容：
        // 1. plain_text 有内容
        // 2. 或者 content 字段存在（可能有任务列表、格式化内容等）
        const hasPlainText = note.plain_text && note.plain_text.trim().length > 0
        const hasContent = note.content && typeof note.content === 'object' && Object.keys(note.content).length > 0
        return hasPlainText || hasContent
      })
      
      // ⚠️ 不要创建新 Map，而是合并到现有缓存
      setNotesCache(prevCache => {
        const newCache = new Map(prevCache) // 保留旧数据
        nonEmptyNotes.forEach(note => {
          newCache.set(note.note_date, note)
        })
        return newCache
      })
      
      setLastLoadedRange({ start: startStr, end: endStr })
      console.log(`✅ 已加载 ${nonEmptyNotes.length} 条笔记 (${viewType}视图，过滤掉 ${notes.length - nonEmptyNotes.length} 条空笔记)`)
    } catch (error) {
      console.error('加载笔记范围失败:', error)
    }
  }, [lastLoadedRange])

  // 初始化：检查登录状态
  useEffect(() => {
    const userData = getUserFromStorage()
    if (!userData) {
      router.push('/auth/login')
      return
    }
    setUser(userData)
    loadUserProfile(userData.id)
    setIsLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当用户或日期变化时加载笔记
  useEffect(() => {
    if (user) {
      loadNote(user.id, selectedDate)
    }
  }, [user, selectedDate, loadNote])

  // 当用户或日期变化时加载便签和任务矩阵
  useEffect(() => {
    if (user) {
      loadStickyNotes(user.id, selectedDate)
      loadTaskMatrix(user.id, selectedDate)
    }
  }, [user, selectedDate, loadStickyNotes, loadTaskMatrix])

  // 当用户登录或组件初始化时加载笔记范围（用于圆点和预览）
  // 加载前后多个月的笔记，确保周视图和月视图都能显示圆点
  useEffect(() => {
    if (!user) {
      console.log('⚠️ user 是 null，跳过加载')
      return
    }
    
    const loadMultipleMonths = async () => {
      console.log('🔄 开始加载多个月份的笔记...')
      
      // 加载前1个月、当前月、后1个月的笔记
      const today = new Date()
      const months = [
        new Date(today.getFullYear(), today.getMonth() - 1, 1),  // 上个月
        new Date(today.getFullYear(), today.getMonth(), 1),      // 当前月
        new Date(today.getFullYear(), today.getMonth() + 1, 1),  // 下个月
      ]
      
      for (const month of months) {
        console.log(`📅 加载 ${month.getFullYear()}-${month.getMonth() + 1} 月的笔记`)
        await loadNotesInRange(user.id, 'month', month)
      }
      
      console.log('✅ 多个月份笔记加载完成')
    }
    
    loadMultipleMonths()
  }, [user, loadNotesInRange])

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? 键显示/隐藏帮助面板
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // 检查是否在输入框中
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault()
          setShowShortcutsPanel(prev => !prev)
        }
      }
      
      // Esc 键关闭帮助面板
      if (e.key === 'Escape' && showShortcutsPanel) {
        e.preventDefault()
        setShowShortcutsPanel(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showShortcutsPanel])

  // 处理笔记内容更新（实时更新统计，不保存）
  const handleNoteUpdate = useCallback((content: JSONContent) => {
    calculateTaskStats(content) // 实时更新任务统计
  }, [calculateTaskStats])

  // 检查笔记是否为空
  const isNoteEmpty = useCallback((content: JSONContent): boolean => {
    if (!content || !content.content) return true
    
    // 检查是否只有一个空段落
    if (content.content.length === 1 && 
        content.content[0].type === 'paragraph' && 
        (!content.content[0].content || content.content[0].content.length === 0)) {
      return true
    }
    
    // 检查是否所有节点都没有实际内容
    const hasContent = content.content.some(node => {
      if (node.type === 'text' && node.text?.trim()) return true
      if (node.content && node.content.length > 0) {
        // 递归检查子节点
        return node.content.some((child: any) => {
          if (child.type === 'text' && child.text?.trim()) return true
          if (child.content && child.content.length > 0) return true
          return false
        })
      }
      return false
    })
    
    return !hasContent
  }, [])

  // 保存笔记
  const handleNoteSave = useCallback(async (content: JSONContent) => {
    if (!user) return

    // 检查笔记是否为空
    if (isNoteEmpty(content)) {
      console.log('📝 笔记为空，跳过保存')
      const dateKey = formatNoteDate(selectedDate)
      // 从缓存中移除空笔记
      setNotesCache(prev => {
        const newCache = new Map(prev)
        newCache.delete(dateKey)
        return newCache
      })
      return
    }

    setIsSaving(true)
    try {
      const savedNote = await saveNote(user.id, selectedDate, content)
      setLastSaved(new Date())
      
      // 更新缓存，避免圆点消失
      const dateKey = formatNoteDate(selectedDate)
      setNotesCache(prev => {
        const newCache = new Map(prev)
        newCache.set(dateKey, savedNote)
        return newCache
      })
      
      console.log('✅ 笔记已保存并更新缓存')
      
      // 🔄 同步任务到 daily_tasks 表
      try {
        const syncResult = await syncTasksFromNote(user.id, dateKey, savedNote.content)
        console.log(`✅ 任务同步完成: 创建 ${syncResult.created}, 更新 ${syncResult.updated}, 删除 ${syncResult.deleted}`)
        
        // 同步完成后，重新加载任务矩阵
        await loadTaskMatrix(user.id, selectedDate)
      } catch (syncError) {
        console.error('❌ 任务同步失败:', syncError)
        // 任务同步失败不影响笔记保存，只记录错误
      }
      
    } catch (error) {
      console.error('保存笔记失败:', error)
      alert('保存笔记失败')
    } finally {
      setIsSaving(false)
    }
  }, [user, selectedDate, isNoteEmpty])

  // 处理日期选择
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    
    // ⭐ 同时更新日历视图日期，确保日历显示选中日期所在的月份
    // 这样可以加载正确月份的笔记圆点
    const selectedMonth = date.getMonth()
    const viewMonth = calendarViewDate.getMonth()
    const selectedYear = date.getFullYear()
    const viewYear = calendarViewDate.getFullYear()
    
    if (selectedMonth !== viewMonth || selectedYear !== viewYear) {
      console.log('📅 切换日历月份:', `${viewYear}-${viewMonth + 1}` , '→', `${selectedYear}-${selectedMonth + 1}`)
      setCalendarViewDate(date)
    }
  }, [calendarViewDate])

  // 处理日期悬停
  const handleDateHover = useCallback((date: Date | null, position?: { x: number; y: number }) => {
    if (!date || !position) {
      // 鼠标移开，清除悬停状态
      setHoveredDate(null)
      setHoveredNote(null)
      return
    }

    setHoveredDate(date)
    setTooltipPosition(position)

    // 从缓存中查找笔记
    const dateKey = formatNoteDate(date)
    const cachedNote = notesCache.get(dateKey)

    if (cachedNote) {
      // 缓存命中，直接显示
      setHoveredNote(cachedNote)
      setIsLoadingPreview(false)
    } else {
      // 缓存未命中，显示加载状态
      setHoveredNote(null)
      setIsLoadingPreview(true)
      
      // 可选：异步加载笔记（如果需要支持缓存外的日期）
      // 但通常周/月视图已经预加载了，所以这里可以不加载
      // getNoteByDate(user.id, date).then(note => {
      //   setHoveredNote(note)
      //   setIsLoadingPreview(false)
      // })
    }
  }, [notesCache])

  // 处理日期范围变化
  const handleDateScopeChange = useCallback((newScope: DateScope) => {
    setDateScope(newScope)
  }, [])

  // 处理创建便签
  const handleCreateStickyNote = useCallback(async () => {
    if (!user) return
    
    try {
      const dateStr = formatNoteDate(selectedDate)
      const maxZ = await getMaxZIndex(user.id, dateStr)
      
      const newNote = await createStickyNote(user.id, {
        noteDate: dateStr,
        content: '',
        positionX: 100,
        positionY: 100,
        width: 280,      // 默认宽度增大
        height: 320,     // 默认高度增大
        color: 'yellow',
        zIndex: maxZ + 1,
      })
      
      setStickyNotes(prev => [...prev, newNote])
      console.log('✅ 便签创建成功:', newNote.id)
    } catch (error) {
      console.error('创建便签失败:', error)
      alert('创建便签失败')
    }
  }, [user, selectedDate])

  // 处理更新便签
  const handleUpdateStickyNote = useCallback(async (id: string, updates: Partial<StickyNoteType>) => {
    try {
      const updatedNote = await updateStickyNote(id, updates)
      setStickyNotes(prev => prev.map(note => note.id === id ? updatedNote : note))
      console.log('✅ 便签更新成功:', id)
    } catch (error) {
      console.error('更新便签失败:', error)
      alert('更新便签失败')
    }
  }, [])

  // 处理删除便签
  const handleDeleteStickyNote = useCallback(async (id: string) => {
    try {
      await deleteStickyNote(id)
      setStickyNotes(prev => prev.filter(note => note.id !== id))
      console.log('✅ 便签删除成功:', id)
    } catch (error) {
      console.error('删除便签失败:', error)
      alert('删除便签失败')
    }
  }, [])

  // 处理便签点击（置顶）
  const handleStickyNoteClick = useCallback(async (id: string) => {
    if (!user) return
    
    try {
      const dateStr = formatNoteDate(selectedDate)
      const maxZ = await getMaxZIndex(user.id, dateStr)
      
      await updateStickyNote(id, { zIndex: maxZ + 1 })
      
      setStickyNotes(prev => 
        prev.map(note => 
          note.id === id 
            ? { ...note, zIndex: maxZ + 1 } 
            : note
        )
      )
      
      console.log('✅ 便签已置顶:', id)
    } catch (error) {
      console.error('置顶便签失败:', error)
    }
  }, [user, selectedDate])

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

  // 处理发送消息
  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim() && !selectedImage) return
    if (!doubaoService.hasApiKey()) {
      alert('请先在 .env.local 文件中配置 NEXT_PUBLIC_DOUBAO_API_KEY')
      return
    }

    setIsSending(true)
    setStreamingMessage('')
    
    try {
      const finalPrompt = chatMessage || '请分析这张图片'
      
      // 添加用户消息到聊天历史
      const userMessage: ChatMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: finalPrompt
          }
        ]
      }

      // 处理图片
      let imageBase64: string | undefined
      if (selectedImage) {
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve(reader.result as string)
          }
          reader.readAsDataURL(selectedImage)
        })
        
        userMessage.content.push({
          type: 'image_url',
          image_url: {
            url: imageBase64
          }
        })
      }

      const newMessages = [...chatMessages, userMessage]
      setChatMessages(newMessages)

      // 发送到豆包 API
      const response = await doubaoService.sendMessage(
        finalPrompt,
        imageBase64,
        chatMessages,
        (chunk: string) => {
          setStreamingMessage(prev => prev + chunk)
        }
      )

      if (response.success && response.message) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: response.message
            }
          ]
        }
        
        setStreamingMessage('')
        setIsSending(false)
        setChatMessages([...newMessages, aiMessage])
        
        // 保存到数据库
        if (user) {
          const chatDate = formatNoteDate(selectedDate)
          await saveChatMessage(user.id, chatDate, 'user', userMessage.content)
          await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content)
        }
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `抱歉，发生了错误: ${response.error || '未知错误'}`
            }
          ]
        }
        setChatMessages([...newMessages, errorMessage])
      }

    } catch (error) {
      console.error('发送消息失败:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '抱歉，发送消息时出现了问题，请稍后重试。'
          }
        ]
      }
      setChatMessages([...chatMessages, errorMessage])
    } finally {
      setChatMessage('')
      setSelectedImage(null)
      setIsSending(false)
      setStreamingMessage('')
    }
  }, [chatMessage, selectedImage, chatMessages, user, selectedDate])

  // 处理清除聊天
  const handleClearChat = useCallback(() => {
    if (window.confirm('确定要清空当前日期的所有聊天记录吗？此操作无法撤销。')) {
      setChatMessages([])
    }
  }, [])

  // 处理拖拽进入
  const handleDragEnter = useCallback(() => {
    setIsDragOver(true)
  }, [])

  // 处理拖拽离开
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // 处理拖拽放下
  const handleDrop = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // 处理回车发送
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // 处理任务完成状态切换
  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      console.log('🔄 切换任务完成状态:', taskId)
      
      // 切换任务完成状态
      const updatedTask = await toggleDailyTaskComplete(taskId)
      
      // 更新本地状态
      setTasksByQuadrant(prev => {
        const newState = { ...prev }
        
        // 遍历所有象限，找到并更新任务
        for (const quadrant in newState) {
          const tasks = newState[quadrant as QuadrantType]
          if (tasks) {
            const index = tasks.findIndex(t => t.id === taskId)
            if (index !== -1) {
              // 更新任务的完成状态
              tasks[index] = {
                ...tasks[index],
                completed: updatedTask.completed
              }
            }
          }
        }
        
        return newState
      })
      
      console.log('✅ 任务状态已更新:', updatedTask.completed)
      
    } catch (error) {
      console.error('❌ 切换任务状态失败:', error)
      alert('更新任务状态失败')
    }
  }, [])

  // 处理任务拖拽放置（乐观更新策略）
  const handleTaskDrop = useCallback(async (taskId: string, targetQuadrant: QuadrantType) => {
    if (!user) return
    
    console.log('🎯 拖拽任务:', { taskId, targetQuadrant })
    
    // 保存旧状态（用于回滚）
    let previousState: TasksByQuadrant | null = null
    
    try {
      // 【乐观更新】立即更新本地状态，不等待 API
      setTasksByQuadrant(prev => {
        previousState = prev // 保存旧状态
        
        const newState: TasksByQuadrant = {
          'unclassified': [],
          'urgent-important': [],
          'not-urgent-important': [],
          'urgent-not-important': [],
          'not-urgent-not-important': [],
        }
        
        // 找到被移动的任务
        let movedTask: any = null
        for (const quadrant in prev) {
          for (const task of prev[quadrant as QuadrantType]) {
            if (task.id === taskId) {
              movedTask = task
            } else {
              // 其他任务保持原位
              newState[quadrant as QuadrantType].push(task)
            }
          }
        }
        
        // 将移动的任务添加到目标象限
        if (movedTask) {
          newState[targetQuadrant].push(movedTask)
        }
        
        return newState
      })
      
      // 【后台更新】异步更新数据库
      await updateTaskQuadrant(taskId, targetQuadrant)
      
      console.log('✅ 任务移动成功（数据库已同步）')
      
    } catch (error) {
      console.error('❌ 移动任务失败:', error)
      
      // 【回滚】如果 API 失败，恢复旧状态
      if (previousState) {
        setTasksByQuadrant(previousState)
        console.log('🔄 已回滚到原状态')
      }
      
      alert('移动任务失败，已恢复原状态')
    }
  }, [user])

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
      <main className="pt-20 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* flex布局容器：在主内容区域内部分左右 */}
          <div className="flex gap-6 h-[calc(100vh-12rem)]">
            {/* 左侧：笔记管理区域 */}
            <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out relative overflow-visible">
              
              {/* 日期范围选择器 - 暂时隐藏 */}
              {/* <DateScopeSelector 
                scope={dateScope}
                onScopeChange={handleDateScopeChange}
              /> */}

              {/* 上部区域：日历和进度条（固定高度，可滚动） */}
              <div className="flex-shrink-0 overflow-y-auto custom-scrollbar">
              {/* 日历视图 - 保留显示 */}
              <CalendarView 
                tasks={[]}  // 笔记模式暂时不显示任务标记
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                dateScope={dateScope}
                notesMap={notesCache}  // 传递笔记缓存用于显示圆点
                onDateHover={handleDateHover}  // 传递悬停回调
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
                  {/* 矩阵维度选择器 */}
                  <MatrixSelector
                    currentDimension={selectedMatrixDimension}
                    onDimensionChange={setSelectedMatrixDimension}
                    onToggleView={() => {
                      if (viewMode === 'editor') {
                        setViewMode('matrix')
                        if (user) loadTaskMatrix(user.id, selectedDate)
                      } else {
                        setViewMode('editor')
                      }
                    }}
                    isMatrixMode={viewMode === 'matrix'}
                  />
                  {/* AI助手按钮 */}
                  <button
                    onClick={toggleChatSidebar}
                    className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                    style={{ backgroundColor: '#4A90E2' }}
                    title="打开AI助手"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    AI助手
                  </button>
                  {/* 便签按钮 - 仅在笔记模式下显示 */}
                  {viewMode === 'editor' && (
                    <button
                      onClick={handleCreateStickyNote}
                      className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                      style={{ backgroundColor: '#F59E0B' }}
                      title="创建便签"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      便签
                    </button>
                  )}
                </div>
              </div>

              {/* 笔记编辑器 / 任务矩阵 切换区域（占满剩余空间） */}
              <div className="flex-1 flex flex-col min-h-0 mt-4 relative">
                {viewMode === 'editor' ? (
                  /* 笔记编辑器模式 */
                  <div 
                    className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-fadeIn"
                    style={{
                      animation: 'fadeIn 0.3s ease-in-out'
                    }}
                  >
                <NoteEditor
                  initialContent={currentNote}
                  onUpdate={handleNoteUpdate}
                  onSave={handleNoteSave}
                  placeholder="开始记录... (按 ? 查看快捷键)"
                />
                    
                    {/* 便签容器（绝对定位在编辑器上方） */}
                    {stickyNotes.map(note => (
                      <StickyNote
                        key={note.id}
                        note={note}
                        onUpdate={handleUpdateStickyNote}
                        onDelete={handleDeleteStickyNote}
                        onClick={handleStickyNoteClick}
                      />
                    ))}
                  </div>
                ) : (
                  /* 任务矩阵模式 */
                  <div 
                    className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-fadeIn"
                    style={{
                      animation: 'fadeIn 0.3s ease-in-out'
                    }}
                  >
                    <TaskMatrix
                      tasks={tasksByQuadrant}
                      selectedDate={selectedDate}
                      onClose={() => setViewMode('editor')}
                      onTaskComplete={handleTaskComplete}
                      onTaskDrop={handleTaskDrop}
                      isEmbedded={true}
                    />
                  </div>
                )}
              </div>

              {/* 浮动AI助手按钮 - 固定在屏幕右下角 */}
              {!isChatSidebarOpen && (
                <button
                  onClick={toggleChatSidebar}
                  className="fixed right-4 bottom-4 z-40 w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
                  style={{ backgroundColor: '#4A90E2' }}
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
              handleSendMessage={handleSendMessage}
              handleClearChat={handleClearChat}
              handleDragEnter={handleDragEnter}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleKeyPress={handleKeyPress}
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

      {/* 笔记预览 Tooltip */}
      {hoveredDate && (hoveredNote || isLoadingPreview) && (
        <NotePreviewTooltip
          date={hoveredDate}
          note={hoveredNote}
          position={tooltipPosition}
          isLoading={isLoadingPreview}
        />
      )}

      {/* 快捷键帮助面板 */}
      <KeyboardShortcutsPanel
        isOpen={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
      />

      {/* 快捷键帮助按钮 - 固定在左下角 */}
      <button
        onClick={() => setShowShortcutsPanel(true)}
        className="fixed left-4 bottom-4 z-40 w-12 h-12 bg-gray-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        title="键盘快捷键 (?)"
      >
        <span className="text-xl font-semibold">?</span>
        {/* 悬停提示 */}
        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
          键盘快捷键
        </span>
      </button>
    </div>
  )
}
