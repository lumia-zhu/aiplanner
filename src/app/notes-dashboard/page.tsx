'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getNoteByDate, saveNote, getNotesByDateRange, deleteNote, Note, formatNoteDate } from '@/lib/notes'
import { logger } from '@/utils/logger'
import { JSONContent } from '@tiptap/react'
import NoteEditor from '@/components/NoteEditor'
import CalendarView from '@/components/CalendarView'
import DateScopeSelector from '@/components/DateScopeSelector'
import ChatSidebar from '@/components/ChatSidebar'
import UserProfileModal from '@/components/UserProfileModal'
import NotePreviewTooltip from '@/components/NotePreviewTooltip'
import KeyboardShortcutsPanel from '@/components/KeyboardShortcutsPanel'
import StickyNote from '@/components/StickyNote'
import StickyNotesDropdown from '@/components/StickyNotesDropdown'
import TaskMatrix from '@/components/TaskMatrix'
import ViewModeToggle from '@/components/ViewModeToggle'
import type { DateScope, UserProfile, UserProfileInput, ChatMessage, StickyNote as StickyNoteType, TasksByQuadrant, TaskMatrixDimension } from '@/types'
import { getDefaultDateScope } from '@/utils/dateUtils'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
// 🆕 新的维度系统
import { 
  type DimensionType, 
  type MatrixAxesConfig, 
  DEFAULT_MATRIX_AXES, 
  PRESET_MATRIX_CONFIGS,
  isDimensionConflict 
} from '@/constants/dimensions'
import { getUserProfile, upsertUserProfile } from '@/lib/userProfile'
import { doubaoService } from '@/lib/doubaoService'
import { saveChatMessage, getChatMessages, getAllChatMessages, clearChatMessages, clearAllChatMessages } from '@/lib/chatMessages'
import { getStickyNotes, createStickyNote, updateStickyNote, deleteStickyNote, getMaxZIndex, hideStickyNote, restoreStickyNote, getHiddenStickyNotes } from '@/lib/stickyNotes'
import { getTaskMatrixByDate, ensureTaskMatrix, updateTaskQuadrant } from '@/lib/taskMatrix'
import { getDailyTasksByDate, toggleDailyTaskComplete } from '@/lib/dailyTasks'
import { copyTaskToDate } from '@/lib/tasks'
import { appendTaskToNote } from '@/lib/notes'
import { syncTasksFromNote, sanitizeTaskTitle, parseTasksFromNote } from '@/lib/taskSync'
import type { DailyTask, QuadrantType } from '@/types'
// ⭐ Agent imports
import { ReactAgent } from '@/lib/agent/ReactAgent'
import { AgentMemory } from '@/lib/agent/AgentMemory'
import { getAllTools } from '@/lib/agent/tools'
import type { AgentContext } from '@/lib/agent/AgentTypes'
// ⭐ 任务拆解imports
import { generateContextQuestions } from '@/lib/contextQuestions'

export default function NotesDashboardPage() {
  logger.debug('NotesDashboardPage 组件开始渲染')
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // 日期相关状态
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentContextDate, setCurrentContextDate] = useState<Date>(new Date())  // ✅ 新增：当前对话上下文日期
  const [dateScope, setDateScope] = useState<DateScope>(getDefaultDateScope())
  
  // 笔记相关状态
  const [currentNote, setCurrentNote] = useState<JSONContent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0 })
  
  // 笔记缓存（用于显示圆点和预览）
  const [notesCache, setNotesCache] = useState<Map<string, Note>>(new Map())
  const [lastLoadedRange, setLastLoadedRange] = useState<{ start: string, end: string } | null>(null)
  
  // 日历视图日期（追踪日历当前显示的月份，用于用户浏览不同月份时加载笔记）
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(selectedDate)
  
  // 处理日历月份切换（用户点击左右箭头浏览不同月份）
  const handleCalendarViewDateChange = useCallback((newDate: Date) => {
    console.log('📅 用户切换日历月份:', `${newDate.getFullYear()}-${newDate.getMonth() + 1}`)
    setCalendarViewDate(newDate)
  }, [])
  
  // 悬停预览相关状态
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null)
  const [hoveredTasks, setHoveredTasks] = useState<DailyTask[]>([])  // 悬停日期的任务列表
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)  // 延迟关闭定时器
  
  // AI 对话框状态
  // ✅ 从 localStorage 读取侧边栏状态（永久保存）
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSidebarOpen')
      const isOpen = saved !== null ? JSON.parse(saved) : false
      console.log('🔧 初始化侧边栏状态:', { saved, isOpen })
      return isOpen
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
  
  // ⭐ Agent 相关状态
  const [agentInstance, setAgentInstance] = useState<ReactAgent | null>(null)
  const [agentMemory] = useState(() => {
    console.log('📝 创建 AgentMemory 实例')
    return new AgentMemory()
  })
  const [agentResumeContext, setAgentResumeContext] = useState<any | null>(null)
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  
  logger.debug('Agent 状态:', { agentInstance: !!agentInstance, agentMemory: !!agentMemory, isAgentRunning })
  
  // 任务识别相关状态（笔记模式暂不使用，但 ChatSidebar 需要）
  const [isTaskRecognitionMode, setIsTaskRecognitionMode] = useState(false)
  const [recognizedTasks, setRecognizedTasks] = useState<any[]>([])
  const [showTaskPreview, setShowTaskPreview] = useState(false)
  
  // Chat 滚动 ref
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  
  // ⭐ 任务拆解相关状态
  const [decomposingTaskTitle, setDecomposingTaskTitle] = useState<string | null>(null)
  const [taskContextInput, setTaskContextInput] = useState<string>('')
  
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
  const [selectedMatrixDimension, setSelectedMatrixDimension] = useState<TaskMatrixDimension>('urgent-important')  // 当前选中的矩阵维度（预设）
  const [tasksByQuadrant, setTasksByQuadrant] = useState<TasksByQuadrant>({
    'unclassified': [],
    'urgent-important': [],
    'not-urgent-important': [],
    'urgent-not-important': [],
    'not-urgent-not-important': [],
  })
  
  // 🆕 自定义矩阵轴配置（支持6个维度自由组合）
  const [matrixAxes, setMatrixAxes] = useState<MatrixAxesConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('matrixAxesConfig')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved matrix axes config:', e)
        }
      }
    }
    return DEFAULT_MATRIX_AXES  // 默认：紧急-重要
  })
  
  // 任务进度条显示/隐藏状态（持久化到 localStorage）
  const [isProgressVisible, setIsProgressVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskProgressVisible')
      return saved !== null ? saved === 'true' : true  // 默认显示
    }
    return true
  })
  
  // 切换任务进度条显示/隐藏
  const toggleProgressVisibility = useCallback(() => {
    setIsProgressVisible(prev => {
      const newValue = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('taskProgressVisible', String(newValue))
      }
      return newValue
    })
  }, [])

  // 保存成功后2秒，将状态淡化为 idle
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [saveStatus])
  
  // ⭐ 初始化 Agent（只在组件挂载时运行一次）
  useEffect(() => {
    if (!agentInstance) {
      try {
        const tools = getAllTools()
        const agent = new ReactAgent()
        setAgentInstance(agent)
        logger.success(`ReactAgent 初始化成功 (${tools.length} 个工具)`)
      } catch (error) {
        console.error('❌ ReactAgent 初始化失败:', error)
        console.error('❌ 错误堆栈:', error instanceof Error ? error.stack : error)
      }
    } else {
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // 空依赖数组：只在组件挂载时运行一次

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

  // ✅ 加载全局聊天记录（不按日期过滤）
  const loadAllChatMessages = useCallback(async (userId: string) => {
    try {
      logger.debug('加载全局聊天记录')
      
      // ✅ 使用新的 getAllChatMessages 函数
      const result = await getAllChatMessages(userId, { limit: 100 })
      
      if (result.success && result.messages) {
        // 将数据库格式转换为组件需要的格式
        const formattedMessages = result.messages
          .filter(msg => {
            // ✅ 过滤掉 interactive 类型的消息（思考、Action、Observation卡片）
            // 只保留纯文本消息
            return msg.content.some((c: any) => c.type === 'text')
          })
          .map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.createdAt || msg.created_at || new Date().toISOString(),  // ✅ 使用实际时间戳
            contextDate: msg.contextDate  // ✅ 保留上下文日期信息
          }))
        setChatMessages(formattedMessages)
        logger.success(`加载了 ${formattedMessages.length} 条全局消息（已过滤中间推理过程）`)
      } else {
        setChatMessages([])
      }
    } catch (error) {
      logger.error('加载聊天记录失败:', error)
      // 加载失败时使用空数组，不影响用户使用
      setChatMessages([])
    }
  }, [])

  // 加载全局便签（不受日期限制）
  const loadStickyNotes = useCallback(async (userId: string) => {
    setIsLoadingStickyNotes(true)
    try {
      console.log(`📋 加载全局便签`)
      const notes = await getStickyNotes(userId)
      setStickyNotes(notes)
      console.log(`✅ 加载了 ${notes.length} 个全局便签`)
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
        
        // 如果没有矩阵信息，则自动初始化到默认象限
        if (!matrix) {
          console.log(`⚠️ 任务 ${dailyTask.id} 没有矩阵信息，将自动初始化到默认象限`)
          const newMatrix = await ensureTaskMatrix(userId, dailyTask.id)
          const quadrant = newMatrix.quadrant as QuadrantType
          if (!grouped[quadrant]) {
            grouped[quadrant] = []
          }
          grouped[quadrant].push(displayTask)
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
  
  // 🆕 切换X轴维度（包含冲突检测和提示）
  const handleXAxisChange = useCallback((newDimension: DimensionType) => {
    // 冲突检测
    if (isDimensionConflict(newDimension, matrixAxes.yAxis)) {
      alert(`⚠️ X轴和Y轴不能选择相同维度！\n\n当前Y轴已选择：${matrixAxes.yAxis}`)
      return
    }
    
    // 更新状态
    const newConfig: MatrixAxesConfig = {
      ...matrixAxes,
      xAxis: newDimension
    }
    setMatrixAxes(newConfig)
    
    // 持久化到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))
      console.log('💾 已保存X轴配置:', newConfig)
    }
  }, [matrixAxes])
  
  // 🆕 切换Y轴维度（包含冲突检测和提示）
  const handleYAxisChange = useCallback((newDimension: DimensionType) => {
    // 冲突检测
    if (isDimensionConflict(newDimension, matrixAxes.xAxis)) {
      alert(`⚠️ X轴和Y轴不能选择相同维度！\n\n当前X轴已选择：${matrixAxes.xAxis}`)
      return
    }
    
    // 更新状态
    const newConfig: MatrixAxesConfig = {
      ...matrixAxes,
      yAxis: newDimension
    }
    setMatrixAxes(newConfig)
    
    // 持久化到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))
      console.log('💾 已保存Y轴配置:', newConfig)
    }
  }, [matrixAxes])
  
  // 🆕 同步预设矩阵选择器与自定义轴配置（保持兼容性）
  useEffect(() => {
    // 当用户通过预设选择器切换矩阵时，同步更新自定义轴配置
    const presetConfig = PRESET_MATRIX_CONFIGS[selectedMatrixDimension]
    if (presetConfig) {
      const newConfig: MatrixAxesConfig = {
        xAxis: presetConfig.xAxis,
        yAxis: presetConfig.yAxis
      }
      // 只有在不同时才更新（避免循环）
      if (newConfig.xAxis !== matrixAxes.xAxis || newConfig.yAxis !== matrixAxes.yAxis) {
        setMatrixAxes(newConfig)
        if (typeof window !== 'undefined') {
          localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))
        }
      }
    }
  }, [selectedMatrixDimension, matrixAxes.xAxis, matrixAxes.yAxis])
  
  // 格式化时间范围显示
  const formatTimeRange = (deadlineDatetime: string): string => {
    try {
      const date = new Date(deadlineDatetime)
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  // 计算需要加载笔记的日期范围（覆盖前后N个月）
  const calculateNotesDateRange = useCallback((referenceDate: Date, monthsAround: number = 1) => {
    // 起始日期：referenceDate 的前 N 个月的第一天
    const startDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - monthsAround,
      1
    )
    
    // 结束日期：referenceDate 的后 N 个月的最后一天
    const endDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + monthsAround + 1,
      0
    )
    
    return { startDate, endDate }
  }, [])

  // 批量加载多个月的笔记（一次数据库查询）
  const loadNotesForMultipleMonths = useCallback(async (
    userId: string,
    referenceDate: Date,
    monthsAround: number = 1
  ) => {
    try {
      console.log(`🔄 批量加载笔记: ${referenceDate.getFullYear()}-${referenceDate.getMonth() + 1} 前后 ${monthsAround} 个月`)
      
      // 1. 计算日期范围
      const { startDate, endDate } = calculateNotesDateRange(referenceDate, monthsAround)
      const startStr = formatNoteDate(startDate)
      const endStr = formatNoteDate(endDate)
      
      console.log(`📦 加载笔记范围: ${startStr} ~ ${endStr}`)
      
      // 2. 批量加载笔记（一次数据库查询）
      const notes = await getNotesByDateRange(userId, startDate, endDate)
      
      // 3. 过滤空笔记
      const nonEmptyNotes = notes.filter(note => {
        const hasPlainText = note.plain_text && note.plain_text.trim().length > 0
        const hasContent = note.content && typeof note.content === 'object' && Object.keys(note.content).length > 0
        return hasPlainText || hasContent
      })
      
      // 4. 更新缓存（一次性更新）
      setNotesCache(prevCache => {
        const newCache = new Map(prevCache)
        nonEmptyNotes.forEach(note => {
          newCache.set(note.note_date, note)
        })
        return newCache
      })
      
      // 5. 记录已加载的范围
      setLastLoadedRange({ start: startStr, end: endStr })
      
      console.log(`✅ 批量加载完成: ${nonEmptyNotes.length} 条笔记 (过滤掉 ${notes.length - nonEmptyNotes.length} 条空笔记)`)
    } catch (error) {
      console.error('批量加载笔记失败:', error)
    }
  }, [calculateNotesDateRange])

  // 加载日期范围内的笔记（用于圆点显示和预览）
  const loadNotesInRange = useCallback(async (userId: string, viewType: 'week' | 'month', referenceDate: Date, forceReload: boolean = false) => {
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
    
    // ✅ 如果 forceReload 为 true，跳过缓存检查
    if (!forceReload && rangeKey === lastRangeKey && notesCache.size > 0) {
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

  // ✅ 加载全局聊天记录（只在用户登录时加载一次）
  useEffect(() => {
    if (user && chatMessages.length === 0) {
      loadAllChatMessages(user.id)
    }
  }, [user, loadAllChatMessages])  // ✅ 移除 selectedDate 依赖，避免切换日期时重新加载

  // 当用户登录时加载全局便签（只加载一次，不受日期影响）
  useEffect(() => {
    if (user) {
      loadStickyNotes(user.id)
    }
  }, [user, loadStickyNotes])

  // 当日期变化时加载任务矩阵
  useEffect(() => {
    if (user) {
      loadTaskMatrix(user.id, selectedDate)
    }
  }, [user, selectedDate, loadTaskMatrix])

  // 当用户登录或日期变化时，批量加载前后N个月的笔记
  // 这样可以支持跨月周视图和用户浏览不同月份
  useEffect(() => {
    if (user) {
      console.log('📅 触发批量加载笔记 (selectedDate 变化)')
      loadNotesForMultipleMonths(user.id, selectedDate, 1)  // 前后各1个月
    }
  }, [user, selectedDate, loadNotesForMultipleMonths])
  
  // 当用户浏览日历的不同月份时（点击左右箭头），也加载对应月份的笔记
  useEffect(() => {
    if (user && calendarViewDate) {
      // 检查 calendarViewDate 是否和 selectedDate 是同一个月
      const isSameMonth = 
        calendarViewDate.getFullYear() === selectedDate.getFullYear() &&
        calendarViewDate.getMonth() === selectedDate.getMonth()
      
      // 如果不是同一个月，说明用户在浏览其他月份，需要加载
      if (!isSameMonth) {
        console.log('📅 触发批量加载笔记 (calendarViewDate 变化 - 用户浏览其他月份)')
        loadNotesForMultipleMonths(user.id, calendarViewDate, 1)  // 前后各1个月
      }
    }
  }, [user, calendarViewDate, selectedDate, loadNotesForMultipleMonths])

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
  const handleNoteSave = useCallback(async (content: JSONContent | undefined | null) => {
    if (!user || !content) return

    // 检查笔记是否为空
    if (isNoteEmpty(content)) {
      console.log('📝 笔记为空，删除数据库中的笔记记录')
      const dateKey = formatNoteDate(selectedDate)
      
      try {
        // 🔥 从数据库中删除笔记
        await deleteNote(user.id, selectedDate)
        console.log('✅ 已从数据库删除空笔记:', dateKey)
        
        // 从缓存中移除空笔记
        setNotesCache(prev => {
          const newCache = new Map(prev)
          newCache.delete(dateKey)
          return newCache
        })
        
        // 🔄 强制重新加载当前视图范围的笔记（确保日历蓝点实时更新）
        try {
          await loadNotesInRange(user.id, 'month', calendarViewDate, true)
          console.log('✅ 日历缓存已刷新（删除笔记后）')
        } catch (refreshError) {
          console.error('❌ 刷新日历缓存失败:', refreshError)
        }
        
        // 🔄 同步任务到 daily_tasks 表（删除所有任务）
        try {
          const syncResult = await syncTasksFromNote(user.id, dateKey, { type: 'doc', content: [] })
          console.log(`✅ 任务同步完成（删除）: 删除 ${syncResult.deleted} 个任务`)
          
          // 重新加载任务矩阵
          await loadTaskMatrix(user.id, selectedDate)
        } catch (syncError) {
          console.error('❌ 任务同步失败:', syncError)
        }
      } catch (error) {
        console.error('❌ 删除笔记失败:', error)
      }
      
      return
    }

    setIsSaving(true)
    setSaveStatus('saving')
    try {
      const savedNote = await saveNote(user.id, selectedDate, content)
      setLastSaved(new Date())
      setSaveStatus('saved')
      
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
      setSaveStatus('error')
      alert('保存笔记失败')
    } finally {
      setIsSaving(false)
    }
  }, [user, selectedDate, isNoteEmpty])

  // ⭐ 处理从笔记编辑器发起的任务拆解
  const handleDecomposeFromNoteEditor = useCallback(async (taskTitle: string) => {
    if (!user) return
    
    console.log('✂️ 从笔记编辑器触发任务拆解:', taskTitle)
    
    // 1. 打开侧边栏（同时保存到 localStorage）
    setIsChatSidebarOpen(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatSidebarOpen', JSON.stringify(true))
      console.log('💾 已保存侧边栏状态到 localStorage: true')
    }
    
    // 2. 显示加载提示
    const loadingMessage: ChatMessage = {
      role: 'assistant',
      content: [{
        type: 'text',
        text: '🤔 正在为你生成问题...'
      }]
    }
    setChatMessages(prev => [...prev, loadingMessage])
    
    // 3. 生成反思性问题（使用简化的任务对象）
    const mockTask = { 
      title: taskTitle, 
      tags: [] as string[]
    } as any // ⭐ 强制类型转换，因为我们只需要 title 和 tags
    
    // ⭐ 动态生成问题
    const questions = await generateContextQuestions(mockTask)
    
    // 移除加载消息
    setChatMessages(prev => prev.slice(0, -1))
    
    // 4. 添加交互式输入卡片到聊天
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'interactive',
          interactive: {
            type: 'decomposition-context-input',
            data: {
              taskTitle,
              questions
            },
            isActive: true
          }
        }
      ]
    }
    
    setChatMessages(prev => [...prev, aiMessage])
    
    // 5. 保存任务标题，标记进入拆解流程
    setDecomposingTaskTitle(taskTitle)
    setTaskContextInput('') // 清空之前的上下文
    console.log('✅ 已进入任务拆解流程，任务标题:', taskTitle)
    
    // 6. 自动滚动到最新消息
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        console.log('📜 自动滚动到聊天底部')
      }
    }, 100) // 等待 DOM 更新后滚动
    
    console.log('✅ 已生成反思性问题，等待用户回答')
  }, [user])

  // ⭐ 处理任务拆解（用户回答反思性问题后，或跳过问题）
  const handleTaskDecomposition = useCallback(async (userAnswer: string) => {
    if (!decomposingTaskTitle) return
    
    try {
      console.log('🤖 开始生成任务拆解建议:', decomposingTaskTitle)
      console.log('📝 用户提供的上下文:', userAnswer)
      
      // 1. 添加用户回答到聊天历史
      const userMessage: ChatMessage = {
        role: 'user',
        content: [{
          type: 'text',
          text: userAnswer
        }]
      }
      setChatMessages(prev => [...prev, userMessage])
      
      // 2. 显示"正在拆解..."的加载消息
      const loadingMessage: ChatMessage = {
        role: 'assistant',
        content: [{
          type: 'text',
          text: `🤔 正在拆解任务「${decomposingTaskTitle}」...`
        }]
      }
      setChatMessages(prev => [...prev, loadingMessage])
      
      // 3. 调用 AI 生成拆解建议
      const result = await doubaoService.decomposeTask(
        decomposingTaskTitle,
        undefined, // description
        userAnswer, // 用户提供的上下文
        undefined // 不使用流式输出
      )
      
      // 4. 移除加载消息
      setChatMessages(prev => prev.slice(0, -1))
      
      if (!result.success || !result.message) {
        console.error('AI拆解失败:', result.error)
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: [{
              type: 'text',
              text: `❌ 抱歉，任务拆解失败：${result.error || '未知错误'}`
            }]
          }
        ])
        return
      }
      
      // 5. 解析 AI 返回的 JSON
      let subtasks: string[] = []
      try {
        const jsonMatch = result.message.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0])
          subtasks = parsedData.map((item: any) => item.title || item.name || '')
        }
      } catch (parseError) {
        console.error('解析AI响应失败:', parseError)
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: [{
              type: 'text',
              text: `❌ 抱歉，AI返回的数据格式有误，无法解析任务拆解建议。`
            }]
          }
        ])
        return
      }
      
      if (subtasks.length === 0) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: [{
              type: 'text',
              text: `抱歉，我无法为这个任务生成子任务建议。你可以手动拆解。`
            }]
          }
        ])
        return
      }
      
      // 6. 转换为 SubtaskSuggestion 格式
      const subtaskSuggestions = subtasks.map((task, index) => ({
        id: `suggestion-${Date.now()}-${index}`,
        title: task,
        order: index + 1,
        is_selected: true
      }))
      
      // 7. 创建一个 mock task 用于交互式卡片
      const mockParentTask = {
        id: `mock-${Date.now()}`,
        title: decomposingTaskTitle,
        user_id: user?.id || '',
        is_completed: false,
        created_at: new Date().toISOString()
      } as any
      
      // 8. 显示交互式拆解卡片
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `✅ 好的！我为你拆解了任务「${decomposingTaskTitle}」：`
            },
            {
              type: 'interactive',
              interactive: {
                type: 'task-decomposition',
                data: {
                  parentTask: mockParentTask,
                  suggestions: subtaskSuggestions
                },
                isActive: true
              }
            }
          ]
        }
      ])
      
      // 9. 自动滚动到底部
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
          console.log('📜 自动滚动到聊天底部')
        }
      }, 100)
      
      // 10. 保存到数据库（只保存文本部分）
      if (user) {
        const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
        await saveChatMessage(user.id, chatDate, 'user', userMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
        await saveChatMessage(user.id, chatDate, 'assistant', [{
          type: 'text',
          text: `✅ 已生成任务拆解建议（${subtasks.length}个子任务）`
        }], chatDate)  // ✅ 传入格式化后的 contextDate
      }
      
      console.log('✅ 任务拆解交互式卡片已显示')
    } catch (error) {
      console.error('生成拆解建议异常:', error)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: `❌ 抱歉，发生了意外错误：${error instanceof Error ? error.message : '未知错误'}`
          }]
        }
      ])
    } finally {
      // 11. 清除输入状态（但保留 decomposingTaskTitle，等待用户确认）
      setChatMessage('')
      setIsSending(false)
      console.log('🧹 已清除输入状态（保留拆解上下文）')
    }
  }, [decomposingTaskTitle, user, selectedDate, chatScrollRef])

  // ⭐ 处理拆解确认（用户确认子任务列表）
  const handleDecompositionConfirm = useCallback((parentTask: any, subtasks: any[]) => {
    console.log('✅ 用户确认拆解，准备插入子任务:', {
      parentTask: parentTask.title,
      subtasksCount: subtasks.length
    })
    
    // 1. 禁用交互式卡片
    setChatMessages(prev => 
      prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: any) => 
          c.type === 'interactive' && c.interactive?.type === 'task-decomposition'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      }))
    )
    
    // 2. 在笔记中插入子任务
    if (currentNote && decomposingTaskTitle) {
      try {
        // 深拷贝当前笔记内容
        const newContent = JSON.parse(JSON.stringify(currentNote))
        
        const findAndInsertSubtasks = (node: any, parentPath: number[] = []): boolean => {
          if (!node || !node.content) return false
          
          for (let i = 0; i < node.content.length; i++) {
            const child = node.content[i]
            
            // 检查是否是目标任务
            if (child.type === 'taskList') {
              for (let j = 0; j < (child.content || []).length; j++) {
                const taskItem = child.content[j]
                if (taskItem.type === 'taskItem') {
                  // 提取任务标题
                  const taskText = extractTaskText(taskItem)
                  
                  if (taskText.includes(decomposingTaskTitle)) {
                    console.log('✅ 找到父任务:', taskText)
                    
                    // 创建子任务列表
                    const subtaskItems = subtasks.map(st => ({
                      type: 'taskItem',
                      attrs: { checked: false },
                      content: [
                        {
                          type: 'paragraph',
                          content: [{ type: 'text', text: st.title }]
                        }
                      ]
                    }))
                    
                    // 创建嵌套的 taskList
                    const nestedTaskList = {
                      type: 'taskList',
                      content: subtaskItems
                    }
                    
                    // 在父任务下添加子任务列表
                    if (!taskItem.content) {
                      taskItem.content = []
                    }
                    
                    // 找到 paragraph 的索引
                    const paragraphIndex = taskItem.content.findIndex((c: any) => c.type === 'paragraph')
                    
                    // 在 paragraph 后插入子任务列表
                    if (paragraphIndex !== -1) {
                      taskItem.content.splice(paragraphIndex + 1, 0, nestedTaskList)
                    } else {
                      taskItem.content.push(nestedTaskList)
                    }
                    
                    console.log('✅ 子任务已插入到笔记中')
                    return true
                  }
                }
              }
            }
            
            // 递归查找
            if (findAndInsertSubtasks(child, [...parentPath, i])) {
              return true
            }
          }
          
          return false
        }
        
        // 辅助函数：提取任务文本
        const extractTaskText = (taskItem: any): string => {
          let text = ''
          const traverse = (node: any) => {
            if (node.type === 'text') {
              text += node.text || ''
            }
            if (node.content && Array.isArray(node.content)) {
              node.content.forEach(traverse)
            }
          }
          traverse(taskItem)
          return text
        }
        
        // 执行插入
        if (findAndInsertSubtasks(newContent)) {
          // 更新笔记内容
          setCurrentNote(newContent)
          
          // 触发保存
          handleNoteSave(newContent)
          
          console.log('✅ 子任务已自动添加到笔记中')
        } else {
          console.warn('⚠️ 未找到父任务，无法插入子任务')
        }
      } catch (error) {
        console.error('❌ 插入子任务失败:', error)
      }
    }
    
    // 3. 显示成功消息
    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: [{
          type: 'text',
          text: `✅ 已成功将 ${subtasks.length} 个子任务添加到笔记中！\n\n子任务已自动缩进在「${decomposingTaskTitle}」下方。`
        }]
      }
    ])
    
    // 4. 清除拆解状态
    setDecomposingTaskTitle(null)
    setTaskContextInput('')
    console.log('🧹 拆解流程结束，已清除状态')
    
    // 5. 自动滚动到底部
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
    }, 100)
  }, [chatScrollRef, currentNote, decomposingTaskTitle, handleNoteSave])

  // ⭐ 处理拆解取消
  const handleDecompositionCancel = useCallback((parentTask: any) => {
    console.log('❌ 用户取消拆解')
    
    // 禁用交互式卡片
    setChatMessages(prev => 
      prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: any) => 
          c.type === 'interactive' && c.interactive?.type === 'task-decomposition'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      }))
    )
    
    // 清除拆解状态
    setDecomposingTaskTitle(null)
    setTaskContextInput('')
    console.log('🧹 已取消拆解，清除状态')
  }, [])

  // ⭐ 处理拆解上下文提交（用户回答反思性问题）
  const handleDecompositionContextSubmit = useCallback(async (userInput: string) => {
    console.log('📝 用户提交拆解上下文:', userInput)
    
    // 禁用输入卡片
    setChatMessages(prev => 
      prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: any) => 
          c.type === 'interactive' && c.interactive?.type === 'decomposition-context-input'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      }))
    )
    
    // 调用拆解函数
    await handleTaskDecomposition(userInput)
  }, [handleTaskDecomposition])

  // ⭐ 处理跳过拆解问题
  const handleDecompositionContextSkip = useCallback(async () => {
    console.log('⏭️ 用户跳过反思性问题')
    
    // 禁用输入卡片
    setChatMessages(prev => 
      prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: any) => 
          c.type === 'interactive' && c.interactive?.type === 'decomposition-context-input'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      }))
    )
    
    // 调用拆解函数，传递空字符串（表示跳过）
    await handleTaskDecomposition('')
  }, [handleTaskDecomposition])

  // 处理日期选择
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setCurrentContextDate(date)  // ✅ 更新对话上下文日期（不清空对话）
    
    // ⭐ 同时更新日历视图日期，确保日历显示选中日期所在的月份
    const selectedMonth = date.getMonth()
    const viewMonth = calendarViewDate.getMonth()
    const selectedYear = date.getFullYear()
    const viewYear = calendarViewDate.getFullYear()
    
    if (selectedMonth !== viewMonth || selectedYear !== viewYear) {
      logger.debug('切换日历月份:', `${viewYear}-${viewMonth + 1}` , '→', `${selectedYear}-${selectedMonth + 1}`)
      setCalendarViewDate(date)
    }
  }, [calendarViewDate])

  // 辅助函数：从任务标题中提取标签、优先级和时间
  const parseTaskMetadata = useCallback((taskTitle: string) => {
    let cleanTitle = taskTitle
    const tags: string[] = []
    let priority: string | null = null
    let timeInfo: string | null = null

    // 1. 提取标签（#xxx 或 # xxx，支持空格）
    const tagMatches = taskTitle.match(/#\s*[^\s#@]+/g)
    if (tagMatches) {
      tagMatches.forEach(tag => {
        // 去掉 # 和可能的空格
        const cleanTag = tag.replace(/^#\s*/, '').trim()
        if (cleanTag) {
          tags.push(cleanTag)
        }
      })
      cleanTitle = cleanTitle.replace(/#\s*[^\s#@]+/g, '').trim()
    }

    // 2. 提取优先级（@high/@medium/@low）
    const priorityMatch = taskTitle.match(/@(high|medium|low)/i)
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase()
      cleanTitle = cleanTitle.replace(/@(high|medium|low)/gi, '').trim()
    }

    // 3. 提取时间信息（📅 开头的部分）
    // 匹配格式：📅 10/30 18:00 或 📅 10/30 09:00-18:00
    const timeMatch = taskTitle.match(/📅\s*\d{1,2}\/\d{1,2}(\s+\d{1,2}:\d{2}(-\d{1,2}:\d{2})?)?/)
    if (timeMatch) {
      timeInfo = timeMatch[0]
      cleanTitle = cleanTitle.replace(/📅\s*\d{1,2}\/\d{1,2}(\s+\d{1,2}:\d{2}(-\d{1,2}:\d{2})?)?/g, '').trim()
    }

    // 4. 清理多余空格
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim()

    return {
      cleanTitle,  // 纯净的任务标题
      tags,        // 标签数组
      priority,    // 优先级
      timeInfo     // 时间信息
    }
  }, [])

  // 处理日期悬停
  const handleDateHover = useCallback(async (date: Date | null, position?: { x: number; y: number }) => {
    // 清除之前的延迟关闭定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (!date || !position || !user) {
      // 鼠标移开，延迟关闭预览框（给用户时间移动到预览框上）
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredDate(null)
        setHoveredNote(null)
        setHoveredTasks([])
      }, 200) // 200ms 延迟
      return
    }

    setHoveredDate(date)
    setTooltipPosition(position)

    // 从缓存中查找笔记
    const dateKey = formatNoteDate(date)
    const cachedNote = notesCache.get(dateKey)

    if (cachedNote) {
      // 缓存命中，直接显示笔记
      setHoveredNote(cachedNote)
      setIsLoadingPreview(false)
      
      // 📌 修复：从笔记内容中提取任务（直接从笔记content解析，获取原始未清理的文本）
      try {
        // 手动遍历笔记内容，提取原始任务文本（不使用 sanitizeTaskTitle）
        const extractRawTasks = (content: any) => {
          const tasks: Array<{ title: string; completed: boolean; position: number }> = []
          let position = 0

          const traverse = (node: any) => {
            if (!node) return

            // 找到 taskItem 节点
            if (node.type === 'taskItem') {
              // 提取原始文本（包含标签标记）
              const extractText = (n: any): string => {
                let text = ''
                
                if (n.type === 'text') {
                  let textContent = n.text || ''
                  
                  // ✨ 检查是否有 marks（标记），特别是 taskTag 类型
                  if (n.marks && Array.isArray(n.marks)) {
                    for (const mark of n.marks) {
                      if (mark.type === 'taskTag' && mark.attrs?.label) {
                        // 如果是 taskTag 标记，在文本前加上 #
                        textContent = `#${mark.attrs.label}`
                        break
                      }
                    }
                  }
                  
                  return textContent
                }
                
                if (n.content && Array.isArray(n.content)) {
                  for (const child of n.content) {
                    text += extractText(child)
                  }
                }
                
                return text
              }

              const rawText = extractText(node).trim()
              
              if (rawText) {
                tasks.push({
                  title: rawText,  // ✅ 保留原始文本，包含 #标签 和 @标记
                  completed: node.attrs?.checked || false,
                  position: position++
                })
              }
            }

            // 递归遍历子节点
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                traverse(child)
              }
            }
          }

          traverse(content)
          return tasks
        }

        const rawTasks = extractRawTasks(cachedNote.content)
        console.log(`📋 从笔记内容中解析任务: ${dateKey}, ${rawTasks.length}个任务`)
        
        // 转换为DailyTask格式（用于预览框显示）
        const dailyTasks: DailyTask[] = rawTasks.map((task, index) => {
          // 📌 解析任务标题，提取标签、优先级、时间
          const metadata = parseTaskMetadata(task.title)
          
          return {
            id: `temp-${dateKey}-${index}`,  // 临时ID
            user_id: user.id,
            userId: user.id,
            title: metadata.cleanTitle,  // ✅ 使用纯净标题
            is_completed: task.completed,
            completed: task.completed,
            date: dateKey,
            noteDate: dateKey,
            note_date: dateKey,
            notePosition: task.position,
            note_position: task.position,
            createdAt: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: metadata.tags,           // ✅ 提取的标签
            priority: metadata.priority,   // ✅ 提取的优先级
            timeInfo: metadata.timeInfo    // ✅ 时间信息（供显示用）
          } as any
        })
        
        setHoveredTasks(dailyTasks)
      } catch (error) {
        console.error('解析笔记任务失败:', error)
        setHoveredTasks([])
      }
    } else {
      // 缓存未命中，显示加载状态
      setHoveredNote(null)
      setIsLoadingPreview(true)
      setHoveredTasks([])
    }
  }, [notesCache, user, parseTaskMetadata])

  // 处理预览框鼠标进入（取消延迟关闭）
  const handleTooltipMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  // 处理预览框鼠标离开（立即关闭）
  const handleTooltipMouseLeave = useCallback(() => {
    setHoveredDate(null)
    setHoveredNote(null)
    setHoveredTasks([])
  }, [])

  // 处理日期范围变化
  const handleDateScopeChange = useCallback((newScope: DateScope) => {
    setDateScope(newScope)
  }, [])

  // 处理创建便签
  const handleCreateStickyNote = useCallback(async () => {
    if (!user) return
    
    // 检查当前可见便签数量（最多3个）
    const visibleCount = stickyNotes.filter(note => !note.isHidden).length
    if (visibleCount >= 3) {
      alert('最多只能同时显示 3 个便签！\n\n请先隐藏或删除现有便签。')
      return
    }
    
    try {
      const dateStr = formatNoteDate(selectedDate)
      const maxZ = await getMaxZIndex(user.id, dateStr)
      
      const newNote = await createStickyNote(user.id, {
        noteDate: dateStr,
        content: '',
        positionX: 50,       // 固定左上角位置
        positionY: 100,
        width: 280,
        height: 320,
        color: 'yellow',
        zIndex: maxZ + 1,
      })
      
      setStickyNotes(prev => [...prev, newNote])
      console.log('✅ 便签创建成功:', newNote.id)
    } catch (error) {
      console.error('创建便签失败:', error)
      alert('创建便签失败')
    }
  }, [user, selectedDate, stickyNotes])

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

  // 处理隐藏便签（乐观更新）
  const handleHideStickyNote = useCallback(async (id: string) => {
    // 乐观更新：立即从UI移除
    const noteToHide = stickyNotes.find(note => note.id === id)
    setStickyNotes(prev => prev.filter(note => note.id !== id))
    
    try {
      await hideStickyNote(id)
      console.log('✅ 便签隐藏成功:', id)
    } catch (error) {
      console.error('隐藏便签失败:', error)
      // 失败时回滚：恢复便签
      if (noteToHide) {
        setStickyNotes(prev => [...prev, noteToHide])
      }
      alert('隐藏便签失败')
    }
  }, [stickyNotes])

  // 加载隐藏的便签列表
  const handleLoadHiddenNotes = useCallback(async (): Promise<StickyNoteType[]> => {
    if (!user) return []
    
    try {
      const hiddenNotes = await getHiddenStickyNotes(user.id)
      return hiddenNotes
    } catch (error) {
      console.error('加载隐藏便签失败:', error)
      return []
    }
  }, [user])

  // 恢复隐藏的便签
  const handleRestoreStickyNote = useCallback(async (noteId: string) => {
    if (!user) return
    
    // 检查当前可见便签数量
    const visibleCount = stickyNotes.filter(note => !note.isHidden).length
    if (visibleCount >= 3) {
      alert('最多只能同时显示 3 个便签！\n\n请先隐藏或删除现有便签。')
      throw new Error('便签数量已达上限')
    }
    
    try {
      // 恢复到固定位置（左上角）
      const restoredNote = await restoreStickyNote(noteId, { x: 50, y: 100 })
      setStickyNotes(prev => [...prev, restoredNote])
      console.log('✅ 便签恢复成功:', noteId)
    } catch (error) {
      console.error('恢复便签失败:', error)
      alert('恢复便签失败')
      throw error
    }
  }, [user, stickyNotes])

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
      const result = await upsertUserProfile(user.id, profileInput)
      if (result.success && result.data) {
        setUserProfile(result.data)
        setShowProfileModal(false)
        alert('个人资料已更新！')
      } else {
        throw new Error(result.error || '更新失败')
      }
    } catch (error) {
      console.error('更新用户资料失败:', error)
      alert('更新用户资料失败')
    }
  }, [user])

  // ✅ 辅助函数：设置侧边栏状态（同时保存到 localStorage）
  const setSidebarOpenWithPersist = useCallback((isOpen: boolean) => {
    console.log('🔧 设置侧边栏状态:', isOpen)
    setIsChatSidebarOpen(isOpen)
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatSidebarOpen', JSON.stringify(isOpen))
      console.log('💾 已保存到 localStorage:', isOpen)
    }
  }, [])

  // 切换 AI 侧边栏
  const toggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen((prev: boolean) => {
      const newState = !prev
      console.log('🔄 切换侧边栏状态:', prev, '→', newState)
      // ✅ 保存状态到 localStorage（刷新页面后仍然保留）
      if (typeof window !== 'undefined') {
        localStorage.setItem('chatSidebarOpen', JSON.stringify(newState))
        console.log('💾 已保存到 localStorage:', newState)
      }
      return newState
    })
  }, [])

  // ⭐ Chat 相关辅助函数（为 ChatSidebar props 提供）
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleImageSelect = useCallback(async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
    }
  }, [])

  const handleVoiceClick = useCallback(() => {
    alert('语音转文字功能即将推出，敬请期待！')
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    
    if (imageItem) {
      const file = imageItem.getAsFile()
      if (file) {
        handleImageSelect(file)
        e.preventDefault()
      }
    }
  }, [handleImageSelect])

  const handleAddSelectedTasks = useCallback(() => {
    // 笔记模式暂不使用任务识别功能
    console.log('笔记模式暂不支持任务识别')
  }, [])

  const handleToggleAllTasks = useCallback((checked: boolean) => {
    setRecognizedTasks(tasks => 
      tasks.map(task => ({ ...task, isSelected: checked }))
    )
  }, [])

  const handleToggleTask = useCallback((taskId: string, checked: boolean) => {
    setRecognizedTasks(tasks => 
      tasks.map(t => t.id === taskId ? { ...t, isSelected: checked } : t)
    )
  }, [])

  // ⭐⭐⭐ Agent Message Handling Functions ⭐⭐⭐
  
  // 处理 Agent 模式的消息
  const handleAgentMessage = async () => {
    if (!agentInstance || !user) {
      console.error('❌ Agent 未初始化或用户未登录')
      return
    }
    
    console.log('🤖 Agent 模式：开始处理消息')
    setIsAgentRunning(true)
    
    // ✅ 清除上一次对话的推理过程卡片（思考、Action、Observation）
    // 只保留纯文本的对话历史作为上下文
    setChatMessages(prev => 
      prev.filter(msg => {
        // 保留所有用户消息
        if (msg.role === 'user') return true
        
        // 对于 AI 消息，只保留纯文本类型（不保留 interactive 卡片）
        return msg.content.some((c: any) => c.type === 'text')
      })
    )
    
    // 1. 添加用户消息
    const userMessage: ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text: chatMessage }]
    }
    setChatMessages(prev => [...prev, userMessage])
    
    // 💾 保存用户消息到数据库
    try {
      const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
      await saveChatMessage(user.id, chatDate, 'user', userMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
      logger.success('用户消息已保存到数据库')
    } catch (error) {
      logger.error('保存用户消息失败:', error)
      // 保存失败不影响继续使用
    }
    
    // 2. 添加加载指示器
    const loadingMessage: ChatMessage = {
      role: 'assistant',
      content: [{
        type: 'interactive',
        interactive: {
          type: 'agent-loading',
          data: { iteration: 1, message: 'Agent 正在思考...' },
          isActive: true
        }
      }]
    }
    setChatMessages(prev => [...prev, loadingMessage])
    
    try {
      // 3. 构建 Agent Context
      const agentContext: AgentContext = {
        userId: user.id,
        userProfile: userProfile,
        dateScope: dateScope,
        taskContext: undefined  // 将由 Agent 自动加载
      }
      
      console.log('📦 Agent Context:', agentContext)
      
      // 4. 调用 Agent
      const result = await agentInstance.run(chatMessage, agentContext)
      console.log('📊 Agent 返回结果:', result)
      
      // 4. 移除加载指示器
      setChatMessages(prev => prev.filter(msg => {
        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
        return interactive?.type !== 'agent-loading'
      }))
      
      // 5. 处理 Agent 返回结果
      await handleAgentResult(result)
      
    } catch (error: any) {
      console.error('❌ Agent 执行失败:', error)
      
      // 移除加载指示器
      setChatMessages(prev => prev.filter(msg => {
        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
        return interactive?.type !== 'agent-loading'
      }))
      
      // 添加错误消息
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: [{
          type: 'interactive',
          interactive: {
            type: 'agent-error',
            data: {
              error: error.message || '未知错误',
              timestamp: new Date().toISOString()
            },
            isActive: false
          }
        }]
      }
      setChatMessages(prev => [...prev, errorMessage])
      
      // 💾 保存错误消息到数据库
      if (user) {
        try {
          const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
          await saveChatMessage(user.id, chatDate, 'assistant', errorMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
          logger.success('异常错误消息已保存到数据库')
        } catch (saveError) {
          logger.error('保存异常错误消息失败:', saveError)
        }
      }
    } finally {
      setIsAgentRunning(false)
    }
  }
  
  // 处理 Agent 返回结果
  const handleAgentResult = async (result: any) => {
    console.log('📊 Agent 返回结果:', result)
    
    // 根据返回类型处理
    switch (result.type) {
      case 'text':
        // 普通文本回复
        await addAgentTextResponse(result)
        break
        
      case 'need_input':
        // 需要用户输入（交互式工具）
        await addAgentNeedInputCard(result)
        break
        
      case 'error':
        // Agent 执行出错（如达到最大迭代次数）
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: [{
            type: 'interactive',
            interactive: {
              type: 'agent-error',
              data: {
                error: result.error || '执行超时或达到最大迭代次数',
                iteration: result.iteration || 0,
                timestamp: new Date().toISOString()
              },
              isActive: false
            }
          }]
        }
        setChatMessages(prev => [...prev, errorMessage])
        
        // 💾 保存错误消息到数据库
        if (user) {
          try {
            const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
            await saveChatMessage(user.id, chatDate, 'assistant', errorMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
            logger.success('错误消息已保存到数据库')
          } catch (error) {
            logger.error('保存错误消息失败:', error)
          }
        }
        break
        
      default:
        console.warn('未知的 Agent 返回类型:', result.type)
    }
  }
  
  // 添加文本回复（包含 Thought、Action、Observation）
  const addAgentTextResponse = async (result: any) => {
    const messages: ChatMessage[] = []
    
    // 1. 添加所有的 Thought 卡片
    if (result.metadata?.thoughts && Array.isArray(result.metadata.thoughts)) {
      for (let i = 0; i < result.metadata.thoughts.length; i++) {
        messages.push({
          role: 'assistant',
          content: [{
            type: 'interactive',
            interactive: {
              type: 'agent-thought',
              data: {
                thought: result.metadata.thoughts[i],
                iteration: i + 1,
                timestamp: new Date().toISOString()
              },
              isActive: false
            }
          }]
        })
      }
    }
    
    // 2. 添加所有的 Action 和 Observation 卡片
    if (result.metadata?.steps && Array.isArray(result.metadata.steps)) {
      for (const step of result.metadata.steps) {
        // Action 卡片
        messages.push({
          role: 'assistant',
          content: [{
            type: 'interactive',
            interactive: {
              type: 'agent-action',
              data: {
                toolName: step.tool,
                toolDescription: step.toolDescription || step.tool,
                parameters: step.parameters,
                timestamp: new Date().toISOString()
              },
              isActive: false
            }
          }]
        })
        
        // Observation 卡片
        messages.push({
          role: 'assistant',
          content: [{
            type: 'interactive',
            interactive: {
              type: 'agent-observation',
              data: {
                toolName: step.tool,
                success: step.success !== false,
                result: step.observation,
                error: step.error,
                timestamp: new Date().toISOString()
              },
              isActive: false
            }
          }]
        })
      }
    }
    
    // 🆕 2.5 检测 get_tasks 工具调用，如果有则添加结构化任务列表卡片
    let hasTaskListCard = false
    if (result.metadata?.steps && Array.isArray(result.metadata.steps)) {
      for (const step of result.metadata.steps) {
        // ⭐ 修复：字段名是 step.tool，不是 step.action
        if (step.tool === 'get_tasks' && step.success && step.toolResult?.data?.tasks) {
          const taskData = step.toolResult.data
          messages.push({
            role: 'assistant',
            content: [{
              type: 'task-list',
              taskList: {
                tasks: taskData.tasks,
                totalCount: taskData.count,
                showAll: false
              }
            }]
          })
          hasTaskListCard = true
          logger.debug('✅ 已添加任务列表卡片', { taskCount: taskData.count })
          break // 只添加一次任务列表卡片
        }
      }
    }
    
    // 3. 添加最终文本回复（如果没有任务列表卡片，或者作为补充说明）
    messages.push({
      role: 'assistant',
      content: [{ type: 'text', text: result.content }]
    })
    
    // 4. 批量添加所有消息到前端显示
    setChatMessages(prev => [...prev, ...messages])
    
    // 💾 只保存最终文本回复到数据库（不保存中间推理过程）
    // ⚠️ 思考、Action、Observation 卡片只在当前会话中显示，不持久化
    if (user) {
      try {
        const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
        
        // 只保存最终的文本回复消息（不保存 interactive 类型的中间过程）
        const finalTextMessages = messages.filter(msg => 
          msg.content.some((c: any) => c.type === 'text')
        )
        
        for (const message of finalTextMessages) {
          await saveChatMessage(user.id, chatDate, 'assistant', message.content, chatDate)  // ✅ 传入格式化后的 contextDate
        }
        
        logger.success(`${finalTextMessages.length} 条最终回复已保存到数据库（跳过 ${messages.length - finalTextMessages.length} 条中间推理过程）`)
      } catch (error) {
        logger.error('保存 AI 消息失败:', error)
        // 保存失败不影响继续使用
      }
    }
    
    // 🔄 检测是否有任务操作，如果有则刷新日历缓存
    if (user && result.metadata?.steps && Array.isArray(result.metadata.steps)) {
      const taskOperationTools = [
        'create_task',
        'update_task',
        'delete_task',
        'create_recurring_tasks',
        'update_recurring_tasks',
        'delete_recurring_tasks'
      ]
      
      // ⭐ 修复：字段名是 step.action，不是 step.tool
      const hasTaskOperation = result.metadata.steps.some((step: any) => 
        taskOperationTools.includes(step.action)
      )
      
      console.log('🔍 检测任务操作:', {
        hasSteps: !!result.metadata.steps,
        stepsCount: result.metadata.steps.length,
        actions: result.metadata.steps.map((s: any) => s.action),
        hasTaskOperation
      })
      
      if (hasTaskOperation) {
        logger.info('检测到任务操作，刷新日历缓存和当前笔记...')
        try {
          // ✅ 强制刷新整个月的笔记（确保所有日期的蓝点和内容都更新）
          await loadNotesInRange(user.id, 'month', calendarViewDate, true)
          
          // ✅ 检查是否跨月（比如本周任务可能跨越两个月）
          // 获取当前周的开始和结束日期
          const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
          const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
          
          // 如果跨月，需要刷新相邻月份的数据
          if (weekStart.getMonth() !== weekEnd.getMonth()) {
            logger.debug('检测到跨月情况，刷新相邻月份')
            
            // 刷新前一个月
            if (weekStart.getMonth() !== calendarViewDate.getMonth()) {
              const prevMonth = new Date(calendarViewDate)
              prevMonth.setMonth(prevMonth.getMonth() - 1)
              await loadNotesInRange(user.id, 'month', prevMonth, true)
            }
            
            // 刷新后一个月
            if (weekEnd.getMonth() !== calendarViewDate.getMonth()) {
              const nextMonth = new Date(calendarViewDate)
              nextMonth.setMonth(nextMonth.getMonth() + 1)
              await loadNotesInRange(user.id, 'month', nextMonth, true)
            }
          }
          
          // ✅ 重新加载当前选中日期的笔记内容（实时更新笔记编辑器）
          await loadNote(user.id, selectedDate)
          
          logger.success('日历缓存和当前笔记已刷新')
        } catch (error) {
          logger.error('刷新日历缓存失败:', error)
          // 刷新失败不影响继续使用
        }
      } else {
        logger.debug('没有检测到任务操作，跳过刷新')
      }
    }
  }
  
  // 添加交互式输入卡片
  const addAgentNeedInputCard = async (result: any) => {
    const needInputMessage: ChatMessage = {
      role: 'assistant',
      content: [{
        type: 'interactive',
        interactive: {
          type: 'agent-need-input',
          data: {
            toolName: result.pendingTool || 'unknown',
            prompt: result.prompt || '请提供更多信息',
            placeholder: '请输入您的回答...',
            context: result.resumeContext,
            timestamp: new Date().toISOString()
          },
          isActive: true
        }
      }]
    }
    
    setChatMessages(prev => [...prev, needInputMessage])
    
    // 💾 保存交互式输入卡片到数据库
    if (user) {
      try {
        const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
        await saveChatMessage(user.id, chatDate, 'assistant', needInputMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
        logger.success('交互式输入卡片已保存到数据库')
      } catch (error) {
        logger.error('保存交互式输入卡片失败:', error)
        // 保存失败不影响继续使用
      }
    }
    
    // 保存恢复上下文
    setAgentResumeContext(result.resumeContext)
  }
  
  // 处理 Agent 交互式输入提交
  const handleAgentInputSubmit = async (userInput: string, context: any) => {
    if (!agentInstance || !user) return
    
    console.log('🔄 Agent 恢复执行，用户输入:', userInput)
    setIsAgentRunning(true)
    
    // 1. 禁用当前的 need-input 卡片
    setChatMessages(prev => prev.map(msg => {
      const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
      if (interactive?.type === 'agent-need-input' && interactive.isActive) {
        return {
          ...msg,
          content: msg.content.map((c: any) => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))
    
    // 2. 添加用户输入消息
    const userMessage: ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text: userInput }]
    }
    setChatMessages(prev => [...prev, userMessage])
    
    // 3. 添加加载指示器
    const loadingMessage: ChatMessage = {
      role: 'assistant',
      content: [{
        type: 'interactive',
        interactive: {
          type: 'agent-loading',
          data: { iteration: context?.currentIteration || 0, message: 'Agent 正在处理...' },
          isActive: true
        }
      }]
    }
    setChatMessages(prev => [...prev, loadingMessage])
    
    try {
      // 4. 调用 Agent.resume()
      const result = await agentInstance.resume(userInput, context)
      
      // 5. 移除加载指示器
      setChatMessages(prev => prev.filter(msg => {
        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
        return interactive?.type !== 'agent-loading'
      }))
      
      // 6. 处理结果
      await handleAgentResult(result)
      
      // 7. 清空恢复上下文
      setAgentResumeContext(null)
      
    } catch (error: any) {
      console.error('❌ Agent 恢复执行失败:', error)
      
      setChatMessages(prev => prev.filter(msg => {
        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
        return interactive?.type !== 'agent-loading'
      }))
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: [{
          type: 'interactive',
          interactive: {
            type: 'agent-error',
            data: {
              error: error.message || '未知错误',
              timestamp: new Date().toISOString()
            },
            isActive: false
          }
        }]
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsAgentRunning(false)
    }
  }
  
  // ⭐⭐⭐ End of Agent Functions ⭐⭐⭐

  // 处理发送消息
  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim() && !selectedImage) return
    if (!doubaoService.hasApiKey()) {
      alert('请先在 .env.local 文件中配置 NEXT_PUBLIC_DOUBAO_API_KEY')
      return
    }

    // ⭐ 检查是否为 Agent 模式
    const isAgentMode = typeof window !== 'undefined' 
      ? localStorage.getItem('ai_assistant_mode') === 'agent'
      : false
    
    console.log('🎯 当前模式:', isAgentMode ? 'Agent' : 'Normal')

    setIsSending(true)
    setStreamingMessage('')
    
    try {
      // ⭐ Agent 模式：使用 ReactAgent 处理
      if (isAgentMode && agentInstance && user) {
        console.log('🤖 使用 Agent 模式处理消息')
        await handleAgentMessage()
        // Agent 模式清理
        setChatMessage('')
        setSelectedImage(null)
        setIsSending(false)
        setStreamingMessage('')
        return  // Agent 模式处理完成，直接返回
      }
      
      // ⭐ 普通模式：使用原有逻辑
      console.log('💬 使用普通模式处理消息')
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
          const chatDate = formatNoteDate(currentContextDate)  // ✅ 使用 currentContextDate
          await saveChatMessage(user.id, chatDate, 'user', userMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
          await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content, chatDate)  // ✅ 传入格式化后的 contextDate
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
  }, [chatMessage, selectedImage, chatMessages, user, selectedDate, agentInstance, isAgentRunning, decomposingTaskTitle, handleTaskDecomposition])

  // 处理清除聊天
  const handleClearChat = useCallback(async () => {
    if (!user) return
    
    const confirmed = window.confirm('确定要清空所有聊天记录吗？（包括所有日期的对话）此操作无法撤销。')
    if (!confirmed) return
    
    try {
      // ✅ 清空全局对话记录
      const result = await clearAllChatMessages(user.id)
      
      if (result.success) {
        setChatMessages([])
        // ⭐ 清空 Agent 内存（对话历史、思考、步骤）
        agentMemory.clear()
        logger.success(`已清空 ${result.count} 条全局对话记录和 Agent 内存`)
        alert(`✅ 已清空 ${result.count} 条对话记录`)
      } else {
        logger.error('清空对话失败:', result.error)
        alert(`❌ 清空对话失败: ${result.error}`)
      }
    } catch (error) {
      logger.error('清空对话异常:', error)
      alert('❌ 清空对话失败，请重试')
    }
  }, [user, agentMemory])

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
    if (!user) return
    
    try {
      console.log('🔄 切换任务完成状态:', taskId)
      
      // 1. 切换任务完成状态（更新 daily_tasks 表）
      const updatedTask = await toggleDailyTaskComplete(taskId)
      console.log('✅ 数据库已更新:', updatedTask)
      
      // 2. 更新矩阵本地状态
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
      console.log('✅ 矩阵本地状态已更新')
      
      // 3. 同步更新笔记内容
      try {
        console.log('📝 开始同步更新笔记中的任务状态...')
        console.log('   任务所属笔记日期:', updatedTask.noteDate)
        console.log('   任务在笔记中的位置:', updatedTask.notePosition)
        
        // 获取任务所在日期的笔记
        const taskNoteDate = new Date(updatedTask.noteDate)
        const note = await getNoteByDate(user.id, taskNoteDate)
        
        if (note && note.content) {
          console.log('📝 找到笔记，开始更新内容')
          
          // 动态导入 updateTaskInNote 函数
          const { updateTaskInNote } = await import('@/lib/noteTaskOperations')
          const newContent = updateTaskInNote(
            note.content,
            updatedTask.notePosition,
            { checked: updatedTask.completed }
          )
          
          // 保存到数据库
          await saveNote(user.id, taskNoteDate, newContent)
          console.log('✅ 笔记已保存到数据库')
          
          // 如果是当前日期，更新本地编辑器状态
          if (updatedTask.noteDate === formatNoteDate(selectedDate)) {
            console.log('📝 更新本地编辑器状态（因为是当前日期）')
            setCurrentNote(newContent)
            // 更新任务统计
            calculateTaskStats(newContent)
          }
          
          console.log('✅ 笔记同步完成')
        } else {
          console.warn('⚠️ 未找到笔记内容，跳过同步')
        }
      } catch (noteError) {
        console.error('❌ 同步笔记失败:', noteError)
        console.warn('⚠️ 任务状态已更新，但笔记同步失败')
        // 不阻止流程，任务状态已经更新成功
      }
      
      console.log('✅ 任务状态切换完成:', updatedTask.completed)
      
    } catch (error) {
      console.error('❌ 切换任务状态失败:', error)
      alert('更新任务状态失败')
    }
  }, [user, selectedDate, calculateTaskStats])

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
              if (newState[quadrant as QuadrantType]) {
                newState[quadrant as QuadrantType].push(task)
              }
            }
          }
        }
        
        // 将移动的任务添加到目标象限
        if (movedTask && newState[targetQuadrant]) {
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

  // 📌 处理从历史日期添加任务到今天
  const handleAddTaskToToday = useCallback(async (task: DailyTask) => {
    if (!user) return

    try {
      const today = new Date()
      const todayStr = formatNoteDate(today)
      
      console.log('➕ 添加任务到今天:', { taskTitle: task.title, from: task.date, to: todayStr })

      // 📌 注意：任务ID是临时的（"temp-xxx"），不能用于copyTaskToDate
      // 直接使用任务标题在今天的笔记中追加任务

      // 1. 构造任务标题（保留标签和优先级，但不保留时间）
      let taskTitle = task.title
      
      // 添加标签
      if (task.tags && task.tags.length > 0) {
        taskTitle += ' ' + task.tags.map(tag => `#${tag}`).join(' ')
      }
      
      // 添加优先级
      if (task.priority) {
        taskTitle += ` @${task.priority}`
      }

      // 2. 在今天的笔记中追加任务
      await appendTaskToNote(user.id, today, taskTitle)
      console.log('✅ 任务已添加到笔记:', taskTitle)

      // 3. 刷新相关状态
      // 如果添加到今天的日期，且今天就是当前选中的日期，需要重新加载
      if (todayStr === formatNoteDate(selectedDate)) {
        await loadNote(user.id, selectedDate)  // 重新加载当前笔记（会自动更新任务统计）
      }
      
      // 刷新笔记缓存
      await loadNotesForMultipleMonths(user.id, selectedDate, 1)
      
      // 如果在矩阵视图，刷新矩阵
      if (viewMode === 'matrix') {
        await loadTaskMatrix(user.id, selectedDate)
      }
      
      console.log('✅ 状态已刷新')

    } catch (error) {
      console.error('❌ 添加任务到今天失败:', error)
      throw error // 抛给上层处理（NotePreviewTooltip会显示错误）
    }
  }, [user, selectedDate, viewMode, loadNotesForMultipleMonths, loadNote, loadTaskMatrix])

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
              <h1 className="text-xl font-bold text-gray-900">📝 TaskNotes</h1>
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
                viewDate={calendarViewDate}  // 传递日历视图日期
                onViewDateChange={handleCalendarViewDateChange}  // 传递月份切换回调
                notesMap={notesCache}  // 传递笔记缓存用于显示圆点
                onDateHover={handleDateHover}  // 传递悬停回调
              />

              {/* 任务进度条 - 可完全隐藏 */}
              {isProgressVisible && (
                <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-fadeIn">
                  {/* 标题栏 - 不可点击 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">任务进度</span>
                    <span className="text-sm text-gray-600">
                      {taskStats.completed}/{taskStats.total}
                    </span>
                  </div>
                  
                  {/* 进度条内容 */}
                  <div className="space-y-2">
                    {/* 进度条 */}
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: taskStats.total > 0 ? `${(taskStats.completed / taskStats.total) * 100}%` : '0%'
                        }}
                      />
                    </div>
                    
                    {/* 百分比和完成提示 */}
                    <div className="flex justify-between items-center">
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
              )}
              </div>

              {/* 日期标题和保存状态 */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {format(selectedDate, 'yyyy年MM月dd日')}
                  </h2>
                  
                  {/* 保存状态 - 紧凑单行显示 */}
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                      <>
                        <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm text-blue-600">
                          正在保存... · {lastSaved ? format(lastSaved, 'HH:mm:ss') : format(new Date(), 'HH:mm:ss')}
                        </span>
                      </>
                    )}
                    
                    {saveStatus === 'saved' && (
                      <>
                        <svg className="w-4 h-4 text-green-600 animate-scaleIn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-600">
                          已保存 · {lastSaved ? format(lastSaved, 'HH:mm:ss') : ''}
                        </span>
                      </>
                    )}
                    
                    {saveStatus === 'error' && (
                      <>
                        <svg className="w-4 h-4 text-red-600 animate-pulse-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm text-red-600 cursor-pointer hover:underline" onClick={() => currentNote && handleNoteSave(currentNote)}>
                          保存失败 · 点击重试
                        </span>
                      </>
                    )}
                    
                    {saveStatus === 'idle' && lastSaved && (
                      <>
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-600">
                          已保存 · {format(lastSaved, 'HH:mm:ss')}
                        </span>
                      </>
                    )}
                    
                    {saveStatus === 'idle' && !lastSaved && (
                      <span className="text-sm text-gray-400">
                        未保存
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* 回到今天按钮 */}
                  {selectedDate.toDateString() !== new Date().toDateString() && (
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2.5 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                      style={{ backgroundColor: '#3B82F6' }}
                      title="回到今天"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm">回到今天</span>
                    </button>
                  )}
                  {/* 进度条切换按钮 */}
                  <button
                    onClick={toggleProgressVisibility}
                    className="text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2.5 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                    style={{ backgroundColor: isProgressVisible ? '#10B981' : '#6B7280' }}
                    title={isProgressVisible ? '隐藏任务进度' : '显示任务进度'}
                  >
                    {isProgressVisible ? (
                      // 显示状态 - 眼睛图标
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      // 隐藏状态 - 眼睛斜线图标
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                    <span className="text-sm">进度</span>
                  </button>
                  
                  
                  {/* 便签下拉框 - 仅在笔记模式下显示 */}
                  {viewMode === 'editor' && (
                    <StickyNotesDropdown
                      currentCount={stickyNotes.filter(n => !n.isHidden).length}
                      maxCount={3}
                      onCreateNew={handleCreateStickyNote}
                      onLoadHidden={handleLoadHiddenNotes}
                      onRestore={handleRestoreStickyNote}
                      onDelete={handleDeleteStickyNote}
                    />
                  )}
                  
                  {/* ⭐ 视图模式切换 - 笔记/矩阵 Tab */}
                  <ViewModeToggle
                    currentMode={viewMode}
                    onModeChange={(mode) => {
                      setViewMode(mode)
                      if (mode === 'matrix' && user) {
                        loadTaskMatrix(user.id, selectedDate)
                      }
                    }}
                  />
                  
                </div>
              </div>

              {/* 笔记编辑器 / 任务矩阵 切换区域（占满剩余空间） */}
              <div className="flex-1 flex flex-col min-h-0 mt-4 relative">
                {viewMode === 'editor' ? (
                  /* 笔记编辑器模式 */
                  <div 
                    className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-fadeIn relative"
                    style={{
                      animation: 'fadeIn 0.3s ease-in-out'
                    }}
                  >
                <NoteEditor
                  initialContent={currentNote ?? undefined}
                  onUpdate={handleNoteUpdate}
                  onSave={handleNoteSave}
                  onDecompose={handleDecomposeFromNoteEditor}
                  placeholder="开始记录... (按 ? 查看快捷键)"
                />
                    
                    {/* 便签容器（绝对定位在编辑器上方） */}
                    {stickyNotes.map(note => (
                      <StickyNote
                        key={note.id}
                        note={note}
                        onUpdate={handleUpdateStickyNote}
                        onDelete={handleDeleteStickyNote}
                        onHide={handleHideStickyNote}
                        onClick={handleStickyNoteClick}
                      />
                    ))}
                    
                    {/* 浮动AI助手按钮 - 编辑器右下角 */}
                    {!isChatSidebarOpen && (
                      <button
                        onClick={toggleChatSidebar}
                        className="absolute right-6 bottom-16 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
                        title="展开AI助手 (Ctrl+B)"
                      >
                        <span className="text-3xl">🤖</span>
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                          AI助手
                        </span>
                      </button>
                    )}
                    
                  </div>
                ) : (
                  /* 任务矩阵模式 */
                  <div 
                    className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible animate-fadeIn relative"
                    style={{
                      animation: 'fadeIn 0.3s ease-in-out'
                    }}
                  >
                    <TaskMatrix
                      tasks={tasksByQuadrant}
                      selectedDate={selectedDate}
                      selectedDimension={selectedMatrixDimension}
                      onClose={() => setViewMode('editor')}
                      onTaskComplete={handleTaskComplete}
                      onTaskDrop={handleTaskDrop}
                      isEmbedded={true}
                      customAxes={matrixAxes}
                      onXAxisChange={handleXAxisChange}
                      onYAxisChange={handleYAxisChange}
                    />
                    
                    {/* 浮动AI助手按钮 - 矩阵右下角 */}
                    {!isChatSidebarOpen && (
                      <button
                        onClick={toggleChatSidebar}
                        className="absolute right-6 bottom-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
                        title="展开AI助手 (Ctrl+B)"
                      >
                        <span className="text-3xl">🤖</span>
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                          AI助手
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
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
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleAddSelectedTasks={handleAddSelectedTasks}
              handleToggleAllTasks={handleToggleAllTasks}
              handleToggleTask={handleToggleTask}
              handleImageSelect={handleImageSelect}
              handleVoiceClick={handleVoiceClick}
              handlePaste={handlePaste}
              chatScrollRef={chatScrollRef}
              onAgentInputSubmit={handleAgentInputSubmit}
              isAgentRunning={isAgentRunning}
              onDecompositionContextSubmit={handleDecompositionContextSubmit}
              onDecompositionContextSkip={handleDecompositionContextSkip}
              onDecompositionConfirm={handleDecompositionConfirm}
              onDecompositionCancel={handleDecompositionCancel}
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
          tasks={hoveredTasks}  // 📌 传递任务列表
          position={tooltipPosition}
          isLoading={isLoadingPreview}
          onAddToToday={handleAddTaskToToday}  // 📌 传递回调函数
          onMouseEnter={handleTooltipMouseEnter}  // 📌 鼠标进入预览框
          onMouseLeave={handleTooltipMouseLeave}  // 📌 鼠标离开预览框
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
