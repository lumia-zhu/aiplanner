'use client'



import { useState, useEffect, useCallback, useRef } from 'react'

import { useRouter } from 'next/navigation'

import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'

import { getNoteByDate, saveNote, getNotesByDateRange, deleteNote, Note, formatNoteDate } from '@/lib/notes'
import { createClient } from '@/lib/supabase-client'

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

import type { DateScope, UserProfile, UserProfileInput, ChatMessage, MessageContent, StickyNote as StickyNoteType, TasksByQuadrant, TaskMatrixDimension, MatrixContext } from '@/types'
import type { ReflectionSession, TaskSnapshot, ScanResult, MatrixContextForPriority, MatrixAxisInfo, QuadrantInfo } from '@/types/reflection'
import { 

  createPlanSnapshot, 

  createReflectionSession, 

  getInProgressReflectionSession,

  getCompletedReflectionSession,

  getReflectionSession,

  updateReflectionSession,

  createTaskSnapshots 

} from '@/lib/reflectionService'

import { GlobalScanTool } from '@/lib/agent/tools/GlobalScanTool'

import { 

  generateRoundQuestions, 

  getNextRound, 

  shouldRunRound,

  formatQuestionsAsMessage,

  generateReflectionSummary,

  formatSummaryAsMessage,

  formatDecompositionInquiryMessage,

  generateOverviewMessage,

  generateTimeQuestions,

  generatePriorityQuestions,

  generateTaskHash,

  generatePersonalizedGreeting,

  type ReflectionRoundType 

} from '@/lib/reflectionFlow'

import { MATRIX_DIMENSION_CONFIGS, MATRIX_QUADRANTS_CONFIGS } from '@/types'

import { getDefaultDateScope } from '@/utils/dateUtils'

import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

// 🆕 新的维度系统

import { 

  type DimensionType, 

  type MatrixAxesConfig,

  DEFAULT_MATRIX_AXES, 

  PRESET_MATRIX_CONFIGS,

  isDimensionConflict,

  getDimensionConfig,
  getAxisLabels
} from '@/constants/dimensions'

import { getUserProfile, upsertUserProfile } from '@/lib/userProfile'

import { doubaoService } from '@/lib/doubaoService'

import { saveChatMessage, getChatMessages, getAllChatMessages, clearChatMessages, clearAllChatMessages } from '@/lib/chatMessages'

import { getStickyNotes, createStickyNote, updateStickyNote, deleteStickyNote, getMaxZIndex, hideStickyNote, restoreStickyNote, getHiddenStickyNotes } from '@/lib/stickyNotes'

import { getTaskMatrixByDate, ensureTaskMatrix, updateTaskQuadrant } from '@/lib/taskMatrix'

import { getDailyTasksByDate, toggleDailyTaskComplete } from '@/lib/dailyTasks'

import { copyTaskToDate } from '@/lib/tasks'

import { appendTaskToNote, appendTaskNodeToNote } from '@/lib/notes'

import { syncTasksFromNote, sanitizeTaskTitle, parseTasksFromNote } from '@/lib/taskSync'

import type { DailyTask, QuadrantType } from '@/types'

// ⭐ Agent imports

import { ReactAgent } from '@/lib/agent/ReactAgent'

import { AgentMemory } from '@/lib/agent/AgentMemory'

import { getAllTools } from '@/lib/agent/tools'

import { GetTasksTool } from '@/lib/agent/tools/GetTasksTool'

import type { AgentContext } from '@/lib/agent/AgentTypes'

// ⭐ 任务拆解imports

import { generateContextQuestions } from '@/lib/contextQuestions'

import { generateDynamicDecompositionQuestions } from '@/lib/decompositionAI'

// ⭐ 每日回顾imports
import { 
  getTodayReflection, 
  createDailyReflection, 
  updateReflectionAnswer, 
  skipReflectionQuestion, 
  completeReflection,
  getReflectionHistory,
  getReflectionHistoryCount,
  batchUpdateReflectionAnswers
} from '@/lib/dailyReflections'
import { generateReflectionSummary as generateDailyReflectionSummary } from '@/lib/reflectionSummaryAI'
import { generatePersonalizedQuestions, selectThreeQuestions } from '@/lib/personalizedReflectionAI'
import type { DailyReflection } from '@/types/daily-reflection'
import { getDailyTasksByNoteDate } from '@/lib/dailyTasks'


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

  const [isLoadingNote, setIsLoadingNote] = useState(false)  // 🆕 笔记加载状态
  const [isSaving, setIsSaving] = useState(false)

  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0 })

  
  
  // 笔记缓存（用于显示圆点和预览）

  const [notesCache, setNotesCache] = useState<Map<string, Note>>(new Map())

  const [lastLoadedRange, setLastLoadedRange] = useState<{ start: string, end: string } | null>(null)

  
  
  // 日历视图日期（追踪日历当前显示的月份，用于用户浏览不同月份时加载笔记）

  const [calendarViewDate, setCalendarViewDate] = useState<Date>(selectedDate)

  
  // ⭐ 带超时保护的loading设置函数
  const setReflectionLoadingWithTimeout = useCallback((
    loading: boolean, 
    type: 'clarity' | 'decomposition' | 'time' | 'priority' | null = null
  ) => {
    if (loading) {
      // 清除旧的定时器
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      
      // 5秒后自动清除loading（超时保护）
      loadingTimeoutRef.current = setTimeout(() => {
        setIsReflectionLoading(false)
        setLoadingReflectionType(null)
        console.warn('⚠️ Loading状态超时自动清除')
      }, 5000)
      
      setIsReflectionLoading(true)
      setLoadingReflectionType(type)
    } else {
      // 清除定时器并清除loading
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      setIsReflectionLoading(false)
      setLoadingReflectionType(null)
    }
  }, [])
  
  
  // 处理日历月份切换（用户点击左右箭头浏览不同月份）

  const handleCalendarViewDateChange = useCallback((newDate: Date) => {

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

  // ✅ 默认关闭侧边栏，用户点击机器人图标才展开
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')

  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const [chatMessages, setChatMessages] = useState<any[]>([])

  const [isSending, setIsSending] = useState(false)

  const [streamingMessage, setStreamingMessage] = useState('')

  
  // ⭐ 反思操作loading状态（防止误触）
  const [isReflectionLoading, setIsReflectionLoading] = useState(false)
  const [loadingReflectionType, setLoadingReflectionType] = useState<'clarity' | 'decomposition' | 'time' | 'priority' | null>(null)
  const [isTaskSelectionLoading, setIsTaskSelectionLoading] = useState(false)
  const [isReflectionControlLoading, setIsReflectionControlLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // 🆕 记录最后一次任务查询的条件（用于刷新任务列表）

  const [lastTaskQueryFilters, setLastTaskQueryFilters] = useState<any>(null)

  const [isRefreshingTaskList, setIsRefreshingTaskList] = useState(false)

  const [isImageProcessing, setIsImageProcessing] = useState(false)

  
  
  // ⭐ Agent 相关状态

  const [agentInstance, setAgentInstance] = useState<ReactAgent | null>(null)

  const [agentMemory] = useState(() => {

    return new AgentMemory()

  })

  const [agentResumeContext, setAgentResumeContext] = useState<any | null>(null)

  const [isAgentRunning, setIsAgentRunning] = useState(false)

  
  
  // ⭐ 元认知反思会话状态

  const [reflectionSessionId, setReflectionSessionId] = useState<string | null>(null)

  const [isReflectionMode, setIsReflectionMode] = useState(false)

  const [currentReflectionRound, setCurrentReflectionRound] = useState<ReflectionRoundType | null>(null)

  const [reflectionScanResult, setReflectionScanResult] = useState<ScanResult | null>(null)

  const [reflectionTasks, setReflectionTasks] = useState<TaskSnapshot[]>([])

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)

  const [askedQuestions, setAskedQuestions] = useState<string[]>([])  // 当前轮次已问过的问题

  
  
  // ⭐ 反思流程优化 - 新增状态

  const [completedRounds, setCompletedRounds] = useState<ReflectionRoundType[]>([])  // 已完成的轮次

  const [pendingRound, setPendingRound] = useState<ReflectionRoundType | null>(null)  // 待选择任务的轮次

  const [selectedTasksForRound, setSelectedTasksForRound] = useState<TaskSnapshot[]>([])  // 用户选择的任务

  const [taskContexts, setTaskContexts] = useState<Map<string, string>>(new Map())  // 存储每个任务的用户输入上下文

  
  
  // ⭐ 问答流程状态

  const [isAnsweringQuestions, setIsAnsweringQuestions] = useState(false)  // 是否处于问答阶段

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)  // 当前问题索引

  const [totalQuestions, setTotalQuestions] = useState<string[]>([])  // 所有问题列表

  const [questionAnswers, setQuestionAnswers] = useState<Array<{question: string, answer: string}>>([])  // 问题和回答的记录

  
  // ⭐ 任务哈希：用于判断任务是否变化（避免重复概览）
  const lastOverviewHashRef = useRef<string>('')  // 上次概览时的任务哈希
  const lastOverviewDateRef = useRef<string>('')  // 上次概览的日期
  
  // ⭐ 任务选择界面：折叠状态管理
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set())  // 存储被折叠的主任务ID
  const questionAnswersRef = useRef<Array<{question: string, answer: string}>>([])  // 🔧 同步跟踪回答（解决闭包问题）

  
  
  // ⭐ Clarity 轮后的任务拆解阶段状态

  const [isDecompositionPhase, setIsDecompositionPhase] = useState(false)  // 是否处于拆解选择阶段

  const [decomposableTasks, setDecomposableTasks] = useState<TaskSnapshot[]>([])  // 可拆解的任务列表

  const [decompositionQueue, setDecompositionQueue] = useState<TaskSnapshot[]>([])  // 待拆解任务队列

  
  // ⭐ 每日回顾状态
  const [isDailyReflectionMode, setIsDailyReflectionMode] = useState(false)  // 是否处于每日回顾模式
  const [currentReflectionId, setCurrentReflectionId] = useState<string | null>(null)  // 当前回顾记录ID
  const [dailyReflectionQuestions, setDailyReflectionQuestions] = useState<[string, string, string] | null>(null)  // 3个问题
  const [dailyReflectionAnswers, setDailyReflectionAnswers] = useState<(string | null)[]>([null, null, null])  // 3个回答
  const [currentDailyQuestionIndex, setCurrentDailyQuestionIndex] = useState(0)  // 当前问题索引（0-2）
  
  // ⭐ 任务规划快捷按钮状态
  const [currentReflectionType, setCurrentReflectionType] = useState<'clarity' | 'decomposition' | 'time' | 'priority' | null>(null)  // 当前激活的反思类型
  
  // ⭐ 历史回顾状态
  const [reflectionHistoryData, setReflectionHistoryData] = useState<any[]>([])  // 历史记录数据
  const [reflectionHistoryOffset, setReflectionHistoryOffset] = useState(0)  // 分页偏移
  const [reflectionHistoryHasMore, setReflectionHistoryHasMore] = useState(false)  // 是否有更多
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)  // 加载中
  
  // ⭐ 任务上下文信息状态
  const [pendingContextInsert, setPendingContextInsert] = useState<{
    taskTitle: string
    contextContent: string
    contextId: string
  } | null>(null)  // 待插入的上下文信息
  
  // ⭐ NoteEditor 实例引用
  const editorRef = useRef<any>(null)
  
  // ⭐ 处理上下文信息添加成功
  const handleContextInfoAdded = useCallback((taskTitle: string, contextContent: string, contextId: string) => {
    
    if (!taskTitle || !contextContent) {
      console.warn('⚠️ 任务标题或内容为空，跳过插入')
      return
    }
    
    // 保存待插入信息，触发插入逻辑
    setPendingContextInsert({ taskTitle, contextContent, contextId })
  }, [])
  
  // ⭐ 监听 pendingContextInsert，执行插入
  useEffect(() => {
    if (pendingContextInsert && editorRef.current) {
      insertContextToNote(
        pendingContextInsert.taskTitle, 
        pendingContextInsert.contextContent,
        pendingContextInsert.contextId
      )
      setPendingContextInsert(null)
    }
  }, [pendingContextInsert])
  
  // ⭐ 插入上下文信息到笔记中
  const insertContextToNote = useCallback((taskTitle: string, contextContent: string, contextId: string) => {
    const editor = editorRef.current
    if (!editor) {
      console.warn('⚠️ 编辑器未初始化，无法插入')
      return
    }
    
    
    const doc = editor.state.doc
    let inserted = false
    let foundTasks: string[] = []
    
    // 遍历文档，找到目标任务
    doc.descendants((node: any, pos: number) => {
      if (inserted) return false  // 已插入，停止遍历
      
      // 检查是否是 taskItem 节点
      if (node.type.name === 'taskItem') {
        // 🔧 只获取第一个 paragraph 的文本作为任务标题（避免包含子任务）
        let taskText = ''
        const firstChild = node.firstChild
        if (firstChild && firstChild.type.name === 'paragraph') {
          taskText = firstChild.textContent.trim()
        } else {
          // 兜底：取整个内容的第一行
          taskText = node.textContent.split('\n')[0].trim()
        }
        
        foundTasks.push(taskText)
        
        // 使用包含匹配：任务标题可能包含额外字符（如标签）
        if (taskText === taskTitle.trim() || taskText.startsWith(taskTitle.trim())) {
          
          // 🔧 找到最佳插入位置：在已有上下文信息之后，或在第一个paragraph之后
          let insertPos = pos + 1  // 进入taskItem内部
          let foundFirstParagraph = false
          let lastContextInfoEndPos = -1
          
          // 遍历taskItem的子节点
          node.descendants((childNode: any, childPos: number) => {
            if (childNode.type.name === 'paragraph' && !foundFirstParagraph) {
              // 记录第一个paragraph之后的位置
              insertPos = pos + 1 + childPos + childNode.nodeSize
              foundFirstParagraph = true
            }
            if (childNode.type.name === 'contextInfo') {
              // 记录最后一个contextInfo之后的位置
              lastContextInfoEndPos = pos + 1 + childPos + childNode.nodeSize
            }
          })
          
          // 如果有已存在的上下文信息，在其后插入（保持上下文信息连续）
          if (lastContextInfoEndPos > 0) {
            insertPos = lastContextInfoEndPos
          }
          
          
          // 创建上下文信息节点，包含 contextId 和 taskTitle 属性
          const contextNode = {
            type: 'contextInfo',  // 使用自定义节点类型
            attrs: {
              contextId: contextId,
              taskTitle: taskTitle
            },
            content: [
              {
                type: 'text',
                text: `💡 ${contextContent}`
              }
            ]
          }
          
          
          // 插入节点
          try {
            const result = editor.chain().focus().insertContentAt(insertPos, contextNode).run()
            inserted = true
          } catch (error) {
            console.error('❌ 插入失败:', error)
          }
          
          return false  // 停止遍历
        }
      }
      
      return true  // 继续遍历
    })
    
    if (!inserted) {
      console.warn('⚠️ 未找到匹配的任务:', taskTitle)
      console.log('📋 文档中的所有任务:', foundTasks)
    }
  }, [])
  
  
  logger.debug('Agent 状态:', { agentInstance: !!agentInstance, agentMemory: !!agentMemory, isAgentRunning })

  
  
  // 任务识别相关状态（笔记模式暂不使用，但 ChatSidebar 需要）

  const [isTaskRecognitionMode, setIsTaskRecognitionMode] = useState(false)

  const [recognizedTasks, setRecognizedTasks] = useState<any[]>([])

  const [showTaskPreview, setShowTaskPreview] = useState(false)

  
  
  // Chat 滚动 ref

  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  
  // ⭐ Loading超时保护ref
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // ⭐ 防止消息重复发送的ref（解决异步状态更新导致的多次触发问题）
  const isSendingMessageRef = useRef<boolean>(false)
  
  
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

  
  // 🆕 矩阵中父任务的折叠状态（默认全部折叠）
  const [matrixCollapsedTasks, setMatrixCollapsedTasks] = useState<Set<string>>(new Set())
  
  // 切换矩阵中任务的折叠状态
  const handleToggleMatrixCollapse = useCallback((taskId: string) => {
    setMatrixCollapsedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])
  
  
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

  // ⭐ 预加载任务上下文（用户登录后立即加载，优化第一次对话速度）
  useEffect(() => {
    if (user && agentInstance) {
      // 在后台预加载任务上下文，不阻塞 UI
      const preloadTaskContext = async () => {
        try {
          console.log('🚀 预加载任务上下文...')
          const startTime = Date.now()
          
          // 通过 AgentMemory 预加载（会被缓存）
          const { AgentMemory } = await import('@/lib/agent/AgentMemory')
          const memory = new AgentMemory()
          await memory.ensureTaskContext(user.id)
          
          const duration = Date.now() - startTime
          console.log(`✅ 任务上下文预加载完成 (${duration}ms)`)
        } catch (error) {
          console.error('⚠️ 任务上下文预加载失败（不影响后续使用）:', error)
        }
      }
      
      // 延迟 500ms 执行，避免与页面初始加载竞争资源
      const timer = setTimeout(preloadTaskContext, 500)
      return () => clearTimeout(timer)
    }
  }, [user, agentInstance])



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

      // 🔧 显示加载状态，避免切换日期时短暂显示旧内容
      setIsLoadingNote(true)
      setCurrentNote(null)
      
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

    } finally {
      setIsLoadingNote(false)
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


  // ✅ 辅助函数：保存关键消息到数据库
  const saveKeyMessageToDb = useCallback(async (
    message: ChatMessage,
    messageType: 'overview' | 'reflection' | 'summary' | 'daily-reflection'
  ) => {
    if (!user) return
    
    try {
      const chatDate = formatNoteDate(currentContextDate)
      // 只保存文本内容，过滤掉 interactive 部分
      const textContent = message.content.filter((c: any) => c.type === 'text')
      if (textContent.length > 0) {
        await saveChatMessage(user.id, chatDate, message.role, textContent, chatDate)
        console.log(`✅ ${messageType} 消息已保存到数据库`)
      }
    } catch (error) {
      console.error(`❌ 保存 ${messageType} 消息失败:`, error)
    }
  }, [user, currentContextDate])


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

      const rawDailyTasks = await getDailyTasksByDate(userId, dateStr)
      console.log(`📝 找到 ${rawDailyTasks.length} 个笔记任务（原始）`)
      
      // 🔧 去重：按标题去重，保留第一个（位置最前的）
      const seenTitles = new Set<string>()
      const dailyTasks = rawDailyTasks.filter(task => {
        const cleanTitle = sanitizeTaskTitle(task.title).toLowerCase().trim()
        if (seenTitles.has(cleanTitle)) {
          console.log(`⚠️ 发现重复任务，跳过: ${task.title}`)
          return false
        }
        seenTitles.add(cleanTitle)
        return true
      })
      console.log(`📝 去重后剩余 ${dailyTasks.length} 个笔记任务`)
      
      
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

          // 🆕 层级信息
          depth: dailyTask.depth ?? 0,
          parentTaskId: dailyTask.parentTaskId ?? null,
        }

        
        
        // 如果没有矩阵信息，则自动初始化到默认象限

        if (!matrix) {

          console.log(`⚠️ 任务 ${dailyTask.id} 没有矩阵信息，将自动初始化到默认象限`)

          const newMatrix = await ensureTaskMatrix(userId, dailyTask.id)

          
          // 如果任务已被删除，跳过该任务
          if (!newMatrix) {
            console.warn(`⚠️ 任务 ${dailyTask.id} 无法初始化矩阵，跳过`)
            continue
          }
          
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

      
      // 🆕 设置默认折叠状态：找出所有父任务（有子任务的任务）并默认折叠
      const allTasks = Object.values(grouped).flat()
      const parentTaskIds = new Set<string>()
      allTasks.forEach((task: any) => {
        // 如果有子任务引用这个任务作为父任务，则它是父任务
        allTasks.forEach((otherTask: any) => {
          if (otherTask.parentTaskId === task.id) {
            parentTaskIds.add(task.id)
          }
        })
      })
      // 默认所有父任务都折叠
      setMatrixCollapsedTasks(parentTaskIds)
      console.log(`🔽 默认折叠 ${parentTaskIds.size} 个父任务`)
      
      
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

    
    
    // 尝试同步 selectedMatrixDimension

    const matchedDimension = Object.entries(PRESET_MATRIX_CONFIGS).find(

      ([_, config]) => config.xAxis === newDimension && config.yAxis === matrixAxes.yAxis

    )

    if (matchedDimension) {

      setSelectedMatrixDimension(matchedDimension[0] as TaskMatrixDimension)

    }

    
    
    // 持久化到 localStorage

    if (typeof window !== 'undefined') {

      localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))

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

    
    
    // 尝试同步 selectedMatrixDimension

    const matchedDimension = Object.entries(PRESET_MATRIX_CONFIGS).find(

      ([_, config]) => config.xAxis === matrixAxes.xAxis && config.yAxis === newDimension

    )

    if (matchedDimension) {

      setSelectedMatrixDimension(matchedDimension[0] as TaskMatrixDimension)

    }

    
    
    // 持久化到 localStorage

    if (typeof window !== 'undefined') {

      localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))

    }

  }, [matrixAxes])

  
  
  // 🆕 同步预设矩阵选择器与自定义轴配置（保持兼容性）

  // ⚠️ 已禁用：这个 useEffect 会覆盖用户的手动维度切换

  // useEffect(() => {

  //   // 当用户通过预设选择器切换矩阵时，同步更新自定义轴配置

  //   const presetConfig = PRESET_MATRIX_CONFIGS[selectedMatrixDimension]

  //   if (presetConfig) {

  //     const newConfig: MatrixAxesConfig = {

  //       xAxis: presetConfig.xAxis,

  //       yAxis: presetConfig.yAxis

  //     }

  //     // 只有在不同时才更新（避免循环）

  //     if (newConfig.xAxis !== matrixAxes.xAxis || newConfig.yAxis !== matrixAxes.yAxis) {

  //       setMatrixAxes(newConfig)

  //       if (typeof window !== 'undefined') {

  //         localStorage.setItem('matrixAxesConfig', JSON.stringify(newConfig))

  //       }

  //     }

  //   }

  // }, [selectedMatrixDimension, matrixAxes.xAxis, matrixAxes.yAxis])

  
  
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



  // 初始化：检查登录状态 + 版本检查
  useEffect(() => {

    // ✅ 版本检查：清除旧版本的缓存数据
    const APP_VERSION = '1.1.0' // 🔄 每次重大更新时修改这个版本号
    const cachedVersion = localStorage.getItem('app_version')
    
    if (cachedVersion !== APP_VERSION) {
      console.log(`🔄 检测到版本更新: ${cachedVersion || '未知'} → ${APP_VERSION}，清除旧缓存...`)
      
      // 保存当前登录用户信息
      const currentUser = localStorage.getItem('user')
      
      // 清除所有 localStorage 数据
      localStorage.clear()
      
      // 恢复用户登录信息
      if (currentUser) {
        localStorage.setItem('user', currentUser)
      }
      
      // 保存新版本号
      localStorage.setItem('app_version', APP_VERSION)
      
      console.log('✅ 缓存已清除，版本已更新')
    }
    
    // 检查登录状态
    const userData = getUserFromStorage()

    if (!userData) {

      router.push('/auth/login')

      return

    }

    setUser(userData)

    loadUserProfile(userData.id)

    // 🔥 Supabase 连接预热：发一个轻量查询建立连接
    // 这样后续的数据库查询就不需要等待连接建立
    const warmupConnection = async () => {
      try {
        const supabase = createClient()
        await supabase.from('notes').select('id').limit(1)
        console.log('🔥 Supabase 连接预热完成')
      } catch (error) {
        console.warn('⚠️ Supabase 连接预热失败:', error)
      }
    }
    warmupConnection()

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

  
  
  // ⭐ 当日期变化时，检查是否有未完成的反思会话（用于恢复）

  useEffect(() => {

    const checkReflectionSession = async () => {

      if (!user || !selectedDate) return

      
      
      const noteDate = format(selectedDate, 'yyyy-MM-dd')

      console.log('🔍 检查是否有未完成的反思会话:', noteDate)

      
      
      try {

        const existingSession = await getInProgressReflectionSession(user.id, noteDate)

        
        
        if (existingSession) {

          console.log('📂 发现未完成的反思会话:', existingSession.id)

          setReflectionSessionId(existingSession.id)

          setIsReflectionMode(true)

        } else {

          // 切换日期时重置反思状态

          setReflectionSessionId(null)

          setIsReflectionMode(false)

        }

      } catch (error) {

        console.error('检查反思会话失败:', error)

      }

    }

    
    
    checkReflectionSession()

  }, [user, selectedDate])



  // ⭐ 反思模式下：监听任务变化，自动更新 reflectionTasks 和 decomposableTasks

  useEffect(() => {

    if (!isReflectionMode || !currentNote) return

    
    
    // 从当前笔记中解析任务

    const currentTasks = parseTasksFromNote(currentNote)

    const taskSnapshots = createTaskSnapshots(currentTasks)

    
    
    // 检查任务是否有变化（简单比较数量和标题）

    const hasChanged = 

      taskSnapshots.length !== reflectionTasks.length ||

      taskSnapshots.some((t, i) => reflectionTasks[i]?.title !== t.title)
    
    

    if (hasChanged) {

      console.log('📝 反思模式：检测到任务变化，更新 reflectionTasks')

      setReflectionTasks(taskSnapshots)

      
      
      // 如果处于拆解选择阶段，也更新可拆解任务列表

      if (isDecompositionPhase && decomposableTasks.length > 0) {

        // 根据最新任务列表过滤可拆解任务（保留仍然存在的任务）

        const currentTaskTitles = new Set(taskSnapshots.map(t => t.title))

        const updatedDecomposableTasks = decomposableTasks.filter(t => 

          currentTaskTitles.has(t.title)

        )

        
        
        // 同时检查是否有新任务可以加入（基于简单规则）

        const existingDecomposableTitles = new Set(decomposableTasks.map(t => t.title))

        const newTasks: TaskSnapshot[] = taskSnapshots.filter(t => 

          !existingDecomposableTitles.has(t.title)

        ).map(t => ({ id: t.id, title: t.title, isCompleted: t.isCompleted }))

        
        
        const finalDecomposableTasks: TaskSnapshot[] = [...updatedDecomposableTasks, ...newTasks]

        
        
        if (finalDecomposableTasks.length !== decomposableTasks.length ||

            finalDecomposableTasks.some((t, i) => decomposableTasks[i]?.title !== t.title)) {

          console.log('📝 更新可拆解任务列表:', finalDecomposableTasks.map(t => t.title))

          setDecomposableTasks(finalDecomposableTasks)

        }

      }

    }

  }, [currentNote, isReflectionMode, reflectionTasks, isDecompositionPhase, decomposableTasks])



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

    setCurrentNote(content) // ✅ 同步更新 currentNote，确保 AI 助手能读取最新内容

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

      
      
      // ✅ 同步更新 currentNote 状态，确保 AI 助手能读取最新内容

      setCurrentNote(savedNote.content)
      
      

      // 🔄 后台异步同步任务到 daily_tasks 表（不阻塞UI）
      syncTasksFromNote(user.id, dateKey, savedNote.content)
        .then(async (syncResult) => {
        console.log(`✅ 任务同步完成: 创建 ${syncResult.created}, 更新 ${syncResult.updated}, 删除 ${syncResult.deleted}`)
        
        

          // 同步完成后，后台刷新任务矩阵
          if (syncResult.created > 0 || syncResult.updated > 0 || syncResult.deleted > 0) {
            loadTaskMatrix(user.id, selectedDate)
          }
        })
        .catch((syncError) => {
        console.error('❌ 任务同步失败:', syncError)

        // 任务同步失败不影响笔记保存，只记录错误

        })
      
      
    } catch (error) {

      console.error('保存笔记失败:', error)

      setSaveStatus('error')

      // 不弹出 alert，避免刷新页面时打扰用户

    } finally {

      setIsSaving(false)

    }

  }, [user, selectedDate, isNoteEmpty])



  // ⭐ 处理从笔记编辑器发起的任务拆解（统一到新流程）
  const handleDecomposeFromNoteEditor = useCallback(async (taskTitle: string) => {

    if (!user) return

    
    
    console.log('✂️ 从笔记编辑器触发任务拆解:', taskTitle)

    
    
    // 1. 打开侧边栏（同时保存到 localStorage）

    setIsChatSidebarOpen(true)

    if (typeof window !== 'undefined') {

      localStorage.setItem('chatSidebarOpen', JSON.stringify(true))

      console.log('💾 已保存侧边栏状态到 localStorage: true')

    }

    

    // 2. 设置为 decomposition 模式
    setCurrentReflectionType('decomposition')
    
    // 3. 显示欢迎消息
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: [{
        type: 'text',
        text: `✂️ 好的，让我们来拆解任务「${taskTitle}」～`
      }]
    }
    setChatMessages(prev => [...prev, welcomeMessage])
    
    // 4. 显示加载提示
    const loadingMessage: ChatMessage = {

      role: 'assistant',

      content: [{

        type: 'text',

        text: '让我看看这个任务...'
      }]

    }

    setChatMessages(prev => [...prev, loadingMessage])
    
    

    // 5. 生成context问题
    try {
    const mockTask = { 

        id: `temp-${Date.now()}`,
        user_id: user.id,
      title: taskTitle, 

        completed: false,
        created_at: new Date().toISOString(),
      tags: [] as string[]
    
      } as any
    

    const questions = await generateContextQuestions(mockTask)

    
    
    // 移除加载消息

    setChatMessages(prev => prev.slice(0, -1))
    
    

      // 6. 初始化问答流程
      setDecomposingTaskTitle(taskTitle)
      setTotalQuestions(questions)
      setCurrentQuestionIndex(0)
      setQuestionAnswers([])
      questionAnswersRef.current = []
      setIsAnsweringQuestions(true)
      
      // 7. 显示第一个问题
      const firstQuestionMsg: ChatMessage = {
      role: 'assistant',

        content: [{
          type: 'interactive',

          interactive: {

            type: 'question-answer',
            data: {

              question: questions[0],
              questionIndex: 0,
              totalQuestions: questions.length,
              allQuestions: questions,
              taskTitle: taskTitle,
              taskId: `temp-${Date.now()}`,
              roundType: 'decomposition'
            },

            isActive: true

          }

        }]
    }
    
      setChatMessages(prev => [...prev, firstQuestionMsg])
      
      console.log('✅ 已进入新的任务拆解流程')
    } catch (error) {
      console.error('生成问题失败:', error)
      setChatMessages(prev => prev.slice(0, -1)) // 移除加载消息
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: `❌ 抱歉，生成问题失败：${error instanceof Error ? error.message : '未知错误'}`
          }]
        }
      ])
    }
    
    // 8. 自动滚动到最新消息
    setTimeout(() => {

      if (chatScrollRef.current) {

        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight

      }
    }, 100)
  }, [user, questionAnswersRef])
    

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

        content: msg.content.map((c: MessageContent) => 
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

                    

                    // 🔧 找到最佳插入位置：在上下文信息之后插入
                    // 结构顺序：paragraph → contextInfo → subtasks
                    let insertIndex = taskItem.content.length // 默认添加到末尾
                    
                    // 找到最后一个 contextInfo 的位置
                    const lastContextIndex = taskItem.content.map((c: any, i: number) => 
                      c.type === 'contextInfo' ? i : -1
                    ).filter((i: number) => i !== -1).pop()
                    
                    if (lastContextIndex !== undefined && lastContextIndex !== -1) {
                      // 在最后一个 contextInfo 之后插入
                      insertIndex = lastContextIndex + 1
                      console.log('📍 在上下文信息后插入子任务，位置:', insertIndex)
                    } else {

                      // 没有上下文信息，找 paragraph 的位置
                      const paragraphIndex = taskItem.content.findIndex((c: any) => c.type === 'paragraph')
                      if (paragraphIndex !== -1) {
                        insertIndex = paragraphIndex + 1
                        console.log('📍 在段落后插入子任务，位置:', insertIndex)
                      }
                    }
                    
                    // 插入子任务列表
                    taskItem.content.splice(insertIndex, 0, nestedTaskList)
                    
                    
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

          // 🔧 直接通过编辑器实例更新内容（绕过 isInitializedRef 限制）
          if (editorRef.current) {
            // ⚠️ 输入法(IME)拼字期间不要 setContent，否则可能造成重复/乱码
            if (!editorRef.current.view?.composing) {
              editorRef.current.commands.setContent(newContent)
            }
            console.log('✅ 通过编辑器实例插入子任务')
          }
          
          // 同时更新状态（保持同步）
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
    
    

    // 6. ⭐ 如果是从 decomposition 类型触发的拆解，显示返回按钮
    if (currentReflectionType === 'decomposition') {
      // 显示完成消息和返回按钮
      const completeMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [
          { 
            type: 'text' as const, 
            text: `✅ 任务拆解完成！

你可以：

• **返回选择其他任务进行拆解**

• **点击底部任务规划按钮进行其他类型规划**`
          },
          {
            type: 'interactive' as const,
          interactive: {

              type: 'buttons' as const,
              data: {
                buttons: [
                  { id: 'decomposition-round-complete-back', label: '← 返回选择其他任务', variant: 'secondary' }
                ],
                context: { roundType: 'decomposition' }
              },
            isActive: true

          }

          }
        ]
      }
      
      setChatMessages(prev => [...prev, completeMessage])
    }
  }, [chatScrollRef, currentNote, decomposingTaskTitle, handleNoteSave, currentReflectionType])

  // ⭐ 处理拆解取消（返回任务选择界面）
  const handleDecompositionCancel = useCallback((parentTask: any) => {

    console.log('❌ 用户取消拆解，返回任务选择界面')
    
    
    // 禁用交互式卡片

    setChatMessages(prev => 

      prev.map(msg => ({

        ...msg,

        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'task-decomposition'

            ? { ...c, interactive: { ...c.interactive, isActive: false } }

            : c

        )

      }))

    )

    
    
    // 清除拆解状态

    setDecomposingTaskTitle(null)

    setTaskContextInput('')

    setDecompositionQueue([]) // 清空拆解队列
    console.log('🧹 已取消拆解，清除状态')
    
    

    // 🔧 返回任务选择界面（判断当前是哪个反思类型）
    // 如果是 decomposition 类型，返回任务拆解的任务选择
    const roundType = currentReflectionType === 'decomposition' ? 'decomposition' : 'clarity'
    
    const confirmMessage: ChatMessage = {
        role: 'assistant',

      content: [{ type: 'text', text: '好的，让我们选择其他任务～' }]
    }
    
    // 重新显示对应的任务选择卡片
    const selectionMessage: ChatMessage = {
      role: 'assistant',
      content: [
        { 
          type: 'interactive',

          interactive: {

            type: 'reflection-task-selection',
            data: { roundType },
            isActive: true

          }

        }
      ]
      }
    
    setPendingRound(roundType)
    setChatMessages(prev => [...prev, confirmMessage, selectionMessage])
  }, [currentReflectionType])


  // ⭐ 处理拆解上下文提交（用户回答反思性问题）

  const handleDecompositionContextSubmit = useCallback(async (userInput: string) => {

    console.log('📝 用户提交拆解上下文:', userInput)

    
    
    // 禁用输入卡片

    setChatMessages(prev => 

      prev.map(msg => ({

        ...msg,

        content: msg.content.map((c: MessageContent) => 
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

        content: msg.content.map((c: MessageContent) => 
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

        // 手动遍历笔记内容，提取原始任务文本和完整节点（不使用 sanitizeTaskTitle）

        const extractRawTasks = (content: any) => {

          const tasks: Array<{ title: string; completed: boolean; position: number; rawNode: any }> = []

          let position = 0



          const traverse = (node: any) => {

            if (!node) return



            // 找到 taskItem 节点

            if (node.type === 'taskItem') {

              // 提取原始文本（包含标签标记）- 只从第一个 paragraph 提取

              const extractText = (n: any, onlyParagraph: boolean = false): string => {

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

                  // 如果是 taskItem，只处理第一个 paragraph（任务标题），跳过 contextInfo 和嵌套 taskList

                  if (onlyParagraph && n.type !== 'paragraph') {

                    return ''

                  }

                  

                  for (const child of n.content) {

                    // 跳过 contextInfo 和嵌套 taskList

                    if (child.type === 'contextInfo' || child.type === 'taskList') {

                      continue

                    }

                    text += extractText(child, false)

                  }

                }

                
                
                return text

              }



              // 从 taskItem 的直接子节点中只提取 paragraph 的文本

              let rawText = ''

              if (node.content && Array.isArray(node.content)) {

                for (const child of node.content) {

                  if (child.type === 'paragraph') {

                    rawText = extractText(child, false).trim()

                    break  // 只取第一个 paragraph

                  }

                }

              }

              
              
              if (rawText) {

                // 🔍 调试：检查节点是否包含上下文信息和子任务

                const hasContextInfo = node.content?.some((c: any) => c.type === 'contextInfo')

                const hasSubTasks = node.content?.some((c: any) => c.type === 'taskList')

                console.log(`📋 提取任务: "${rawText}", 有上下文: ${hasContextInfo}, 有子任务: ${hasSubTasks}`)

                

                tasks.push({

                  title: rawText,  // ✅ 保留原始文本，包含 #标签 和 @标记

                  completed: node.attrs?.checked || false,

                  position: position++,

                  rawNode: node  // ✅ 保存完整的任务节点（包含上下文信息和子任务）

                })

              }

            }



            // 递归遍历子节点（但不进入 taskItem 的嵌套内容，避免提取子任务）

            if (node.type !== 'taskItem' && node.content && Array.isArray(node.content)) {

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

            timeInfo: metadata.timeInfo,   // ✅ 时间信息（供显示用）

            rawNode: task.rawNode          // ✅ 完整的任务节点（包含上下文信息和子任务）

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



  // ⭐ 启动反思流程（侧栏展开时调用）

  const startReflectionSession = useCallback(async () => {

    if (!user || !selectedDate) return

    
    
    const noteDate = format(selectedDate, 'yyyy-MM-dd')

    console.log('🧠 检查反思会话:', { userId: user.id, noteDate })

    
    
    try {

      // 1. 检查是否有未完成的反思会话

      const existingSession = await getInProgressReflectionSession(user.id, noteDate)

      
      
      if (existingSession) {

        console.log('📂 恢复未完成的反思会话:', existingSession.id)

        setReflectionSessionId(existingSession.id)

        setIsReflectionMode(true)

        
        
        // ⭐ 重要：从当前笔记中获取最新任务（而不是从快照中）

        const currentTasks = currentNote ? parseTasksFromNote(currentNote) : []

        const taskSnapshots = createTaskSnapshots(currentTasks)

        setReflectionTasks(taskSnapshots)

        
        
        // 恢复扫描结果

        if (existingSession.scanResult) {

          setReflectionScanResult(existingSession.scanResult)

        }

        
        
        console.log('📋 恢复会话，当前任务数:', taskSnapshots.length)

        
        
        // 🆕 使用新的概述界面恢复

        // 如果当前轮次是 overview 或者没有设置，显示概述 + 4按钮

        if (!existingSession.currentRound || existingSession.currentRound === 'overview') {

          // 加载消息已由 toggleChatSidebar 显示，这里直接生成概述消息
          const scan = existingSession.scanResult || {

            totalTaskCount: taskSnapshots.length,

            vagueTaskCount: 0,

            unestimatedTaskCount: 0,

            noPriorityCount: 0,

            workloadLevel: 'medium' as const,

            crossDayTasks: [],

            deadlineConflicts: []

          }

          
          
          const overviewText = await generateOverviewMessage(taskSnapshots, scan)

          
          
          const overviewMessage: ChatMessage = {

            role: 'assistant' as const,

            content: [

              { type: 'text' as const, text: overviewText },
              { 

                type: 'interactive' as const, 

                interactive: {

                  type: 'reflection-overview' as const,

                  data: { taskCount: taskSnapshots.length },

                  isActive: true

                }

              }

            ]

          }

          setChatMessages(prev => {

            // 移除所有加载消息，添加概述消息
            const filtered = prev.filter(m => {
              const text = m.content?.[0]?.text || ''
              return !text.includes('让我看看') && !text.includes('欢迎回来')
            })
            const hasOverview = filtered.some(m => 

              m.content?.some((c: any) => c.interactive?.type === 'reflection-overview')

            )

            if (hasOverview) return filtered
            return [...filtered, overviewMessage]

          })

          
          // ✅ 保存恢复的任务概览到数据库
          if (user) {
            const chatDate = format(selectedDate, 'yyyy-MM-dd')
            const textContent = overviewMessage.content.filter((c: any) => c.type === 'text')
            if (textContent.length > 0) {
              saveChatMessage(user.id, chatDate, 'assistant', textContent, chatDate)
                .then(() => console.log('✅ 恢复的概览消息已保存到数据库'))
                .catch(err => console.error('❌ 保存恢复的概览消息失败:', err))
            }
          }
        } else {

          // 如果有正在进行的轮次，恢复到该轮次

          const round = existingSession.currentRound as ReflectionRoundType

          setCurrentReflectionRound(round)

          
          
          setTimeout(() => {

            startReflectionRound(

              round, 

              taskSnapshots, 

              existingSession.scanResult || {

                totalTaskCount: taskSnapshots.length,

                vagueTaskCount: 0,

                unestimatedTaskCount: 0,

                noPriorityCount: 0,

                workloadLevel: 'medium',

                crossDayTasks: [],

                deadlineConflicts: []

              }, 

              existingSession.id

            )

          }, 1000)

        }

        
        
        return existingSession

      }

      
      
      // 1.5 检查是否有已完成的反思会话

      const completedSession = await getCompletedReflectionSession(user.id, noteDate)

      if (completedSession && completedSession.finalSummary) {

        console.log('✅ 发现已完成的反思会话:', completedSession.id)

        
        
        // 显示之前的总结

        const summaryMessage = {

          role: 'assistant' as const,

          content: [{ 

            type: 'text' as const, 

            text: `**欢迎回来！你今天已经完成过任务规划了** 🌟\n\n**之前的总结：**\n${completedSession.finalSummary}\n\n**执行建议：**\n${completedSession.executionSuggestions}\n\n如果你想重新开始一轮新的反思，可以点击下方的按钮👇`
          }]

        }

        setChatMessages(prev => {

          const hasSummary = prev.some(m => m.content?.[0]?.text?.includes('欢迎回来！你今天已经完成过任务规划了'))
          if (hasSummary) return prev

          return [...prev, summaryMessage]

        })

        
        
        // TODO: 添加"重新开始"按钮（目前可以通过清空聊天记录来重置）

        return completedSession

      }

      
      
      // 2. 从当前笔记内容中提取任务

      const currentTasks = currentNote ? parseTasksFromNote(currentNote) : []

      if (currentTasks.length === 0) {

        console.log('📭 没有任务，不启动反思')

        // 显示提示消息

        const emptyMessage = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: '📭 今天还没有任务，可以先在左边的笔记区域添加一些任务，然后我来帮你做规划反思～' }]

        }

        setChatMessages(prev => [...prev, emptyMessage])

        return null

      }

      
      
      console.log('📋 从笔记中提取到', currentTasks.length, '个任务')

      
      
      // 3. 创建计划快照

      const taskSnapshots = createTaskSnapshots(currentTasks)

      const snapshot = await createPlanSnapshot({

        userId: user.id,

        noteDate,

        tasksJson: taskSnapshots

      })

      
      
      if (!snapshot) {

        console.error('❌ 创建计划快照失败')

        return null

      }

      
      
      console.log('📸 计划快照创建成功:', snapshot.id)

      
      
      // 4. 创建反思会话

      const session = await createReflectionSession({

        planSnapshotId: snapshot.id,

        userId: user.id

      })

      
      
      if (!session) {

        console.error('❌ 创建反思会话失败')

        return null

      }

      
      
      console.log('🧠 反思会话创建成功:', session.id)

      setReflectionSessionId(session.id)

      setIsReflectionMode(true)

      
      
      // 5. 执行 GlobalScan 并显示任务总览

      console.log('🔍 执行 GlobalScan...')

      const globalScanTool = new GlobalScanTool()

      const scanResult = await globalScanTool.execute({

        tasks: taskSnapshots,

        noteDate

      })

      
      
      if (scanResult.type === 'success') {

        const { scanResult: scan } = scanResult.data

        
        
        // 保存扫描结果和任务列表到状态

        setReflectionScanResult(scan)

        setReflectionTasks(taskSnapshots)

        
        
        // 更新反思会话，保存扫描结果（不设置 currentRound，等用户选择）

        await updateReflectionSession(session.id, {

          scanResult: scan,

          currentRound: 'overview'  // 停留在概述阶段，等待用户选择

        })

        

        // 🆕 使用 LLM 生成概述消息（加载消息已在 toggleChatSidebar 中显示）
        console.log('🤖 生成 LLM 概述消息...')

        const overviewText = await generateOverviewMessage(taskSnapshots, scan)

        
        
        // 替换加载消息为概述 + 4个按钮

        const overviewMessage: ChatMessage = {

          role: 'assistant' as const,

          content: [

            { type: 'text' as const, text: overviewText },
            { 

              type: 'interactive' as const, 

              interactive: {

                type: 'reflection-overview' as const,

                data: { taskCount: taskSnapshots.length },

                isActive: true

              }

            }

          ]

        }

        setChatMessages(prev => {

          // 移除所有加载消息，添加概述消息
          const filtered = prev.filter(m => {
            const text = m.content?.[0]?.text || ''
            return !text.includes('让我看看') && !text.includes('欢迎回来')
          })
          // 检查是否已有概述消息，避免重复
          const hasOverview = filtered.some(m => 
            m.content?.some((c: any) => c.interactive?.type === 'reflection-overview')
          )
          if (hasOverview) return filtered  // 已有概述消息，不重复添加
          return [...filtered, overviewMessage]

        })

        
        // ✅ 保存任务概览到数据库
        await saveKeyMessageToDb(overviewMessage, 'overview')
        
        
        console.log('✅ 概述消息已显示，等待用户选择')

      } else {
        // 🆕 GlobalScan 失败时的降级处理
        console.error('❌ GlobalScan 失败:', scanResult)
        
        // 使用空的扫描结果继续
        const emptyScan: ScanResult = {
          totalTaskCount: taskSnapshots.length,
          vagueTaskCount: 0,
          unestimatedTaskCount: 0,
          noPriorityCount: 0,
          workloadLevel: 'medium' as const,
          crossDayTasks: [],
          deadlineConflicts: []
        }
        
        setReflectionScanResult(emptyScan)
        setReflectionTasks(taskSnapshots)
        
        // 仍然生成概述消息
        const overviewText = await generateOverviewMessage(taskSnapshots, emptyScan)
        const overviewMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [
            { type: 'text' as const, text: overviewText },
            { 
              type: 'interactive' as const, 
              interactive: {
                type: 'reflection-overview' as const,
                data: { taskCount: taskSnapshots.length },
                isActive: true
              }
            }
          ]
        }
        setChatMessages(prev => {
          const filtered = prev.filter(m => {
            const text = m.content?.[0]?.text || ''
            return !text.includes('让我看看') && !text.includes('欢迎回来')
          })
          return [...filtered, overviewMessage]
        })
        
        // ✅ 保存降级的任务概览到数据库
        if (user) {
          const chatDate = format(selectedDate, 'yyyy-MM-dd')
          const textContent = overviewMessage.content.filter((c: any) => c.type === 'text')
          if (textContent.length > 0) {
            saveChatMessage(user.id, chatDate, 'assistant', textContent, chatDate)
              .then(() => console.log('✅ 降级概览消息已保存到数据库'))
              .catch(err => console.error('❌ 保存降级概览消息失败:', err))
          }
        }
      }

      
      
      return session
      
      

    } catch (error) {

      console.error('❌ 启动反思会话失败:', error)

      return null

    }

  }, [user, selectedDate, currentNote, saveKeyMessageToDb])
  
  // ⭐ 开启每日回顾（从顶部按钮触发）
  const startDailyReflection = useCallback(async () => {
    if (!user) return
    
    const today = new Date().toISOString().split('T')[0]
    console.log('💭 开启每日回顾:', { userId: user.id, date: today })
    
    try {
      // 1. 检查今天是否已有回顾记录
      const existingReflection = await getTodayReflection(user.id, today)
      
      if (existingReflection) {
        // 2a. 如果已完成，显示已完成提示
        if (existingReflection.status === 'completed') {
          const message: ChatMessage = {
            role: 'assistant' as const,
            content: [
              { type: 'text' as const, text: '你今天已经完成了每日回顾 ✅' },
              {
                type: 'interactive' as const,
                interactive: {
                  type: 'daily-reflection-already-done',
                  data: {
                    summary: existingReflection.ai_summary || '暂无总结',
                    reflectionId: existingReflection.id
                  },
                  isActive: true
                }
              }
            ]
          }
          setChatMessages(prev => [...prev, message])
          return
        }
        
        // 2b. 如果未完成，询问是否继续
        const message: ChatMessage = {
          role: 'assistant' as const,
          content: [
            { type: 'text' as const, text: '发现你还有未完成的反思 ⏸️' },
            {
              type: 'interactive' as const,
              interactive: {
                type: 'daily-reflection-resume',
                data: {
                  questionNumber: existingReflection.current_question_index,
                  totalQuestions: 3,
                  reflectionId: existingReflection.id
                },
                isActive: true
              }
            }
          ]
        }
        setChatMessages(prev => [...prev, message])
        
        // 设置状态以便恢复
        setCurrentReflectionId(existingReflection.id)
        setDailyReflectionQuestions([
          existingReflection.question_1,
          existingReflection.question_2,
          existingReflection.question_3
        ])
        setDailyReflectionAnswers([
          existingReflection.answer_1,
          existingReflection.answer_2,
          existingReflection.answer_3
        ])
        setCurrentDailyQuestionIndex(existingReflection.current_question_index)
        return
      }
      
      // 3. 显示加载状态
      const loadingMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '⏳ 正在为你生成个性化问题，请稍候...' }]
      }
      setChatMessages(prev => [...prev, loadingMessage])
      
      // 4. 生成个性化问题
      console.log('🎯 开始生成个性化反思问题...')
      console.log('🔑 当前用户ID:', user.id, '用户名:', user.username)
      const allTasks = await getDailyTasksByNoteDate(user.id, today)
      
      // 🎯 只保留父任务（depth = 0 或 parentTaskId 为 null）
      const todayTasks = allTasks.filter(task => !task.parentTaskId && (task.depth === 0 || task.depth === undefined))
      console.log(`📋 今日任务数: 全部 ${allTasks.length}, 父任务 ${todayTasks.length}`)
      console.log('📋 父任务标题:', todayTasks.map(t => t.title))
      
      // 获取今天的任务规划会话（澄清、拆解、时间规划、优先级）
      const todayTaskReflection = await getCompletedReflectionSession(user.id, today)
      console.log(`📝 今日任务规划: ${todayTaskReflection ? '有' : '无'}`)
      
      const personalizedQuestions = await generatePersonalizedQuestions({
        tasks: todayTasks,  // 只传入父任务
        todayDailyReflection: null,  // 新创建，没有已有每日回顾
        todayTaskReflection: todayTaskReflection  // 今天的任务规划会话
      })
      const selectedQuestions = selectThreeQuestions(personalizedQuestions)
      console.log('✨ 个性化问题已生成:', selectedQuestions)
      
      // 5. 创建新的反思会话
      const newReflection = await createDailyReflection(user.id, today, selectedQuestions)
      console.log('✅ 创建新反思会话:', newReflection.id)
      
      // 6. 设置状态
      setIsDailyReflectionMode(true)
      setCurrentReflectionId(newReflection.id)
      setDailyReflectionQuestions([
        newReflection.question_1,
        newReflection.question_2,
        newReflection.question_3
      ])
      setDailyReflectionAnswers([null, null, null])
      setCurrentDailyQuestionIndex(0)
      
      // 7. 移除加载消息，显示欢迎消息 + 第一个问题
      const welcomeMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [
          { 
            type: 'text' as const, 
            text: '💭 让我们一起回顾今天的任务吧！我会问你3个问题，帮助你反思今天的收获~'
          },
          {
            type: 'interactive' as const,
            interactive: {
              type: 'daily-reflection-question',
              data: {
                question: newReflection.question_1,
                questionNumber: 1,
                totalQuestions: 3,
                reflectionId: newReflection.id,
                allQuestions: [newReflection.question_1, newReflection.question_2, newReflection.question_3]
              },
              isActive: true
            }
          }
        ]
      }
      
      // 移除加载消息，添加欢迎消息
      setChatMessages(prev => prev.slice(0, -1).concat(welcomeMessage))
      
    } catch (error: any) {
      console.error('❌ 开启每日回顾失败:', error)
      
      const today = new Date().toISOString().split('T')[0]
      
      if (error.message === 'DUPLICATE_REFLECTION') {
        // 唯一约束冲突，直接使用已有记录
        console.log('⚠️ 检测到重复记录，使用已有记录')
        const existing = await getTodayReflection(user.id, today)
        if (existing) {
          // 设置状态
          setIsDailyReflectionMode(true)
          setCurrentReflectionId(existing.id)
          setDailyReflectionQuestions([
            existing.question_1,
            existing.question_2,
            existing.question_3
          ])
          setDailyReflectionAnswers([
            existing.answer_1,
            existing.answer_2,
            existing.answer_3
          ])
          setCurrentDailyQuestionIndex(existing.current_question_index)
          
          // 根据状态显示不同内容
          if (existing.status === 'completed') {
            // 已完成
            setChatMessages(prev => prev.slice(0, -1).concat({
              role: 'assistant' as const,
              content: [
                { type: 'text' as const, text: '你今天已经完成了每日回顾 ✅' },
                {
                  type: 'interactive' as const,
                  interactive: {
                    type: 'daily-reflection-already-done',
                    data: {
                      summary: existing.ai_summary || '暂无总结',
                      reflectionId: existing.id
                    },
                    isActive: true
                  }
                }
              ]
            }))
          } else {
            // 进行中，显示恢复界面
            setChatMessages(prev => prev.slice(0, -1).concat({
              role: 'assistant' as const,
              content: [
                { type: 'text' as const, text: '发现你还有未完成的反思 ⏸️' },
                {
                  type: 'interactive' as const,
                  interactive: {
                    type: 'daily-reflection-resume',
                    data: {
                      questionNumber: existing.current_question_index,
                      totalQuestions: 3,
                      reflectionId: existing.id
                    },
                    isActive: true
                  }
                }
              ]
            }))
          }
        } else {
          // 找不到记录，显示错误
          setChatMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: '❌ 系统异常，请稍后重试' }]
          }))
        }
      } else {
        // 其他错误，移除加载消息，显示错误
        setChatMessages(prev => {
          const lastMsg = prev[prev.length - 1]
          const isLoading = lastMsg?.content?.[0]?.text?.includes('正在为你生成个性化问题')
          const messages = isLoading ? prev.slice(0, -1) : prev
          return [...messages, {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: `❌ 开启回顾失败: ${error.message}` }]
          }]
        })
      }
    }
  }, [user])
  
  // ⭐ 完成每日回顾（生成AI总结）
  const completeDailyReflection = useCallback(async () => {
    console.log('🎉 完成每日回顾，开始生成AI总结...')
    
    if (!user) {
      console.error('❌ 用户未登录')
      return
    }
    
    try {
      // 1. 显示加载消息
      const loadingMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '✨ 正在生成你的反思总结...' }]
      }
      setChatMessages(prev => [...prev, loadingMessage])
      
      // 2. 始终从数据库获取今天的回顾记录（确保使用正确的 ID）
      const today = new Date().toISOString().split('T')[0]
      const todayReflection = await getTodayReflection(user.id, today)
      
      if (!todayReflection) {
        throw new Error('找不到今天的回顾记录')
      }
      
      const reflectionId = todayReflection.id
      const questions: [string, string, string] = [
        todayReflection.question_1, 
        todayReflection.question_2, 
        todayReflection.question_3
      ]
      const answers: [string | null, string | null, string | null] = [
        todayReflection.answer_1, 
        todayReflection.answer_2, 
        todayReflection.answer_3
      ]
      
      console.log('📋 反思数据:', { reflectionId, questions, answers })
      
      // 3. 生成AI总结
      const summary = await generateDailyReflectionSummary(questions, answers)
      console.log('📝 AI总结生成成功:', summary)
      
      // 4. 保存总结到数据库
      await completeReflection(reflectionId!, summary)
      console.log('💾 总结已保存到数据库')
      
      // 5. 移除加载消息
      setChatMessages(prev => prev.filter(m => !m.content?.[0]?.text?.includes('正在生成你的反思总结')))
      
      // 6. 显示完成卡片
      const completeMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [
          {
            type: 'interactive' as const,
            interactive: {
              type: 'daily-reflection-complete',
              data: {
                summary,
                reflectionId
              },
              isActive: true
            }
          }
        ]
      }
      setChatMessages(prev => [...prev, completeMessage])
      
      // ✅ 保存每日回顾总结到数据库（单独保存文本版本）
      const summaryTextMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `📝 每日回顾总结：\n${summary}` }]
      }
      await saveKeyMessageToDb(summaryTextMessage, 'daily-reflection')
      
      // 7. 重置状态
      setIsDailyReflectionMode(false)
      setCurrentReflectionId(null)
      setDailyReflectionQuestions(null)
      setDailyReflectionAnswers([null, null, null])
      setCurrentDailyQuestionIndex(0)
      
      console.log('✅ 每日回顾完成')
      
    } catch (error: any) {
      console.error('❌ 完成反思失败:', error)
      
      // 移除加载消息
      setChatMessages(prev => prev.filter(m => !m.content?.[0]?.text?.includes('正在生成你的反思总结')))
      
      const errorMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `❌ 生成总结失败: ${error.message}` }]
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }, [user])
  
  // ⭐ 处理每日回顾回答（优化版：批量提交，减少等待时间）
  const handleDailyReflectionAnswer = useCallback(async (data: any) => {
    console.log('💬 handleDailyReflectionAnswer 被调用:', { 
      data, 
      currentReflectionId, 
      dailyReflectionQuestions,
      状态中的问题数量: dailyReflectionQuestions?.length 
    })
    
    const { questionNumber, answer, reflectionId, question, allQuestions } = data
    
    // 使用传入的 reflectionId（而不是状态中的 currentReflectionId）
    const targetReflectionId = reflectionId || currentReflectionId
    
    // 使用传入的 allQuestions（而不是状态中的 dailyReflectionQuestions）
    const questions = allQuestions || dailyReflectionQuestions
    
    if (!targetReflectionId) {
      console.error('❌ reflectionId 缺失')
      return
    }
    
    console.log('💬 保存反思回答（本地）:', { questionNumber, answer, reflectionId: targetReflectionId, questions })
    
    try {
      // ⚡ 优化：先更新本地状态，立即切换问题（不等待数据库）
      
      // 1. 同步 reflectionId（如果不一致）
      if (currentReflectionId !== targetReflectionId) {
        console.log('🔄 同步 reflectionId:', targetReflectionId)
        setCurrentReflectionId(targetReflectionId)
      }
      
      // 2. 更新本地答案状态（立即更新，无需等待数据库）
      let updatedAnswers: (string | null)[] = dailyReflectionAnswers || [null, null, null]
      setDailyReflectionAnswers(prev => {
        const newAnswers = [...prev]
        newAnswers[questionNumber - 1] = answer
        updatedAnswers = newAnswers
        console.log('📝 更新本地答案（即时）:', newAnswers)
        return newAnswers
      })
      setCurrentDailyQuestionIndex(questionNumber)
      
      // 3. 判断是否还有下一个问题
      console.log('🔢 检查是否有下一个问题:', { questionNumber, totalQuestions: 3 })
      
      if (questionNumber < 3) {
        // 立即显示下一个问题（从传入的 allQuestions 获取）
        const nextQuestionText = questions?.[questionNumber] || ''
        console.log('⚡ 立即切换到下一个问题:', { 
          nextQuestionNumber: questionNumber + 1, 
          nextQuestionText,
          questions
        })
        
        // 找到最后一个问题卡片并更新它
        setChatMessages(prev => {
          const messages = [...prev]
          let foundIndex = -1
          
          // 从后往前找最后一个每日回顾问题卡片
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            const hasReflectionQuestion = msg.content?.some((c: MessageContent) => 
              c.type === 'interactive' && 
              c.interactive?.type === 'daily-reflection-question'
            )
            
            if (hasReflectionQuestion) {
              foundIndex = i
              console.log('🔍 找到问题卡片，索引:', i)
              break
            }
          }
          
          if (foundIndex !== -1) {
            // 更新这个卡片的内容
            console.log('🔄 更新卡片内容')
            messages[foundIndex] = {
              ...messages[foundIndex],
              content: [{
                type: 'interactive' as const,
                interactive: {
                  type: 'daily-reflection-question',
                  data: {
                    question: nextQuestionText,
                    questionNumber: questionNumber + 1,
                    totalQuestions: 3,
                    reflectionId: targetReflectionId,
                    allQuestions: questions // 传递所有问题
                  },
                  isActive: true
                }
              }]
            }
          } else {
            console.warn('⚠️ 没有找到问题卡片，创建新卡片')
            // 如果没找到，创建新卡片
            messages.push({
              role: 'assistant' as const,
              content: [{
                type: 'interactive' as const,
                interactive: {
                  type: 'daily-reflection-question',
                  data: {
                    question: nextQuestionText,
                    questionNumber: questionNumber + 1,
                    totalQuestions: 3,
                    reflectionId: targetReflectionId,
                    allQuestions: questions // 传递所有问题
                  },
                  isActive: true
                }
              }]
            })
          }
          
          return messages
        })
      } else {
        // 所有问题已回答完毕
        console.log('🎉 所有问题已回答，批量提交到数据库')
        
        // 禁用问题卡片（但保留显示）
        setChatMessages(prev => 
          prev.map(msg => ({
            ...msg,
            content: msg.content?.map((c: MessageContent) => 
              c.type === 'interactive' && 
              c.interactive?.type === 'daily-reflection-question'
                ? { ...c, interactive: { ...c.interactive, isActive: false } }
                : c
            )
          }))
        )
        
        // 批量提交所有答案到数据库（后台操作）
        console.log('📦 批量提交答案:', updatedAnswers!)
        await batchUpdateReflectionAnswers(
          targetReflectionId, 
          updatedAnswers! as [string | null, string | null, string | null]
        )
        console.log('✅ 批量提交成功')
        
        // 生成AI总结
        await completeDailyReflection()
      }
      
    } catch (error: any) {
      console.error('❌ 保存反思回答失败:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `❌ 保存失败: ${error.message}` }]
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }, [currentReflectionId, dailyReflectionQuestions, completeDailyReflection])
  
  // ⭐ 处理每日回顾跳过（优化版：立即切换，减少等待）
  const handleDailyReflectionSkip = useCallback(async (data: any) => {
    console.log('⏭️ handleDailyReflectionSkip 被调用:', { 
      data, 
      currentReflectionId, 
      dailyReflectionQuestions 
    })
    
    const { questionNumber, reflectionId, question, allQuestions } = data
    
    // 使用传入的 reflectionId（而不是状态中的 currentReflectionId）
    const targetReflectionId = reflectionId || currentReflectionId
    
    // 使用传入的 allQuestions（而不是状态中的 dailyReflectionQuestions）
    const questions = allQuestions || dailyReflectionQuestions
    
    if (!targetReflectionId) {
      console.error('❌ reflectionId 缺失')
      return
    }
    
    console.log('⏭️ 跳过反思问题（本地）:', { questionNumber, reflectionId: targetReflectionId, questions })
    
    try {
      // ⚡ 优化：立即更新本地状态，不等待数据库
      
      // 1. 同步 reflectionId
      if (currentReflectionId !== targetReflectionId) {
        console.log('🔄 同步 reflectionId:', targetReflectionId)
        setCurrentReflectionId(targetReflectionId)
      }
      
      // 2. 更新本地状态（跳过=不保存答案）
      let updatedAnswers: (string | null)[] = dailyReflectionAnswers || [null, null, null]
      setDailyReflectionAnswers(prev => {
        updatedAnswers = [...prev]
        // 跳过的问题保持 null
        console.log('⏭️ 跳过问题，本地答案保持:', updatedAnswers)
        return updatedAnswers
      })
      setCurrentDailyQuestionIndex(questionNumber)
      
      // 3. 判断是否还有下一个问题
      console.log('🔢 检查是否有下一个问题:', { questionNumber, totalQuestions: 3 })
      
      if (questionNumber < 3) {
        // 立即显示下一个问题（从传入的 allQuestions 获取）
        const nextQuestionText = questions?.[questionNumber] || ''
        console.log('⚡ 立即切换到下一个问题:', { 
          nextQuestionNumber: questionNumber + 1, 
          nextQuestionText,
          questions
        })
        
        // 找到最后一个问题卡片并更新它
        setChatMessages(prev => {
          const messages = [...prev]
          let foundIndex = -1
          
          // 从后往前找最后一个每日回顾问题卡片
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            const hasReflectionQuestion = msg.content?.some((c: MessageContent) => 
              c.type === 'interactive' && 
              c.interactive?.type === 'daily-reflection-question'
            )
            
            if (hasReflectionQuestion) {
              foundIndex = i
              console.log('🔍 找到问题卡片，索引:', i)
              break
            }
          }
          
          if (foundIndex !== -1) {
            // 更新这个卡片的内容
            console.log('🔄 更新卡片内容')
            messages[foundIndex] = {
              ...messages[foundIndex],
              content: [{
                type: 'interactive' as const,
                interactive: {
                  type: 'daily-reflection-question',
                  data: {
                    question: nextQuestionText,
                    questionNumber: questionNumber + 1,
                    totalQuestions: 3,
                    reflectionId: targetReflectionId,
                    allQuestions: questions // 传递所有问题
                  },
                  isActive: true
                }
              }]
            }
          } else {
            console.error('❌ 未找到问题卡片')
          }
          
          return messages
        })
      } else {
        // 所有问题已处理完毕
        console.log('✅ 所有问题已完成，批量提交到数据库')
        
        // 禁用问题卡片
        setChatMessages(prev => 
          prev.map(msg => ({
            ...msg,
            content: msg.content?.map((c: MessageContent) => 
              c.type === 'interactive' && 
              c.interactive?.type === 'daily-reflection-question'
                ? { ...c, interactive: { ...c.interactive, isActive: false } }
                : c
            )
          }))
        )
        
        // 批量提交所有答案到数据库（后台操作）
        console.log('📦 批量提交答案:', updatedAnswers!)
        await batchUpdateReflectionAnswers(
          targetReflectionId, 
          updatedAnswers! as [string | null, string | null, string | null]
        )
        console.log('✅ 批量提交成功')
        
        // 生成AI总结
        await completeDailyReflection()
      }
      
    } catch (error: any) {
      console.error('❌ 跳过问题失败:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `❌ 跳过失败: ${error.message}` }]
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }, [currentReflectionId, dailyReflectionQuestions, completeDailyReflection])
  
  // ⭐ 查看历史回顾
  const viewReflectionHistory = useCallback(async () => {
    if (!user) return
    
    console.log('📚 查看历史回顾')
    setIsLoadingHistory(true)
    
    try {
      // 获取历史记录（第一页）
      const history = await getReflectionHistory(user.id, 10, 0)
      const totalCount = await getReflectionHistoryCount(user.id)
      
      console.log('📚 历史记录:', { count: history.length, total: totalCount })
      
      // 更新状态
      setReflectionHistoryData(history)
      setReflectionHistoryOffset(history.length)
      setReflectionHistoryHasMore(history.length < totalCount)
      
      // 显示历史记录卡片
      const historyMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [
          {
            type: 'interactive' as const,
            interactive: {
              type: 'daily-reflection-history',
              data: {
                reflections: history,
                hasMore: history.length < totalCount,
                isLoading: false
              },
              isActive: true
            }
          }
        ]
      }
      
      setChatMessages(prev => [...prev, historyMessage])
      
    } catch (error: any) {
      console.error('❌ 查看历史回顾失败:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `❌ 加载历史记录失败: ${error.message}` }]
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [user])
  
  // ⭐ 加载更多历史回顾
  const loadMoreReflectionHistory = useCallback(async () => {
    if (!user || isLoadingHistory) return
    
    console.log('📚 加载更多历史回顾, offset:', reflectionHistoryOffset)
    setIsLoadingHistory(true)
    
    try {
      // 获取下一页
      const moreHistory = await getReflectionHistory(user.id, 10, reflectionHistoryOffset)
      const totalCount = await getReflectionHistoryCount(user.id)
      
      // 合并数据
      const allHistory = [...reflectionHistoryData, ...moreHistory]
      const newOffset = allHistory.length
      const hasMore = newOffset < totalCount
      
      // 更新状态
      setReflectionHistoryData(allHistory)
      setReflectionHistoryOffset(newOffset)
      setReflectionHistoryHasMore(hasMore)
      
      // 更新卡片
      setChatMessages(prev => 
        prev.map(msg => ({
          ...msg,
          content: msg.content?.map((c: MessageContent) => 
            c.type === 'interactive' && c.interactive?.type === 'daily-reflection-history'
              ? {
                  ...c,
                  interactive: {
                    ...c.interactive,
                    data: {
                      reflections: allHistory,
                      hasMore,
                      isLoading: false
                    }
                  }
                }
              : c
          )
        }))
      )
      
    } catch (error: any) {
      console.error('❌ 加载更多失败:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [user, isLoadingHistory, reflectionHistoryOffset, reflectionHistoryData])
  
  // ⭐ 处理任务折叠状态切换
  const toggleTaskCollapse = useCallback((taskId: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)  // 展开
      } else {
        next.add(taskId)  // 折叠
      }
      console.log('🔄 切换折叠状态:', taskId, next.has(taskId) ? '折叠' : '展开')
      return next
    })
  }, [])
  
  // ⭐ 初始化默认折叠状态（折叠所有有子任务的主任务）
  const initializeCollapsedTasks = useCallback(() => {
    const tasksWithChildren = reflectionTasks
      .filter(task => !task.parent_task_id) // 主任务
      .filter(task => reflectionTasks.some(t => t.parent_task_id === task.id)) // 有子任务
      .map(task => task.id)
    
    if (tasksWithChildren.length > 0) {
      setCollapsedTasks(new Set(tasksWithChildren))
      console.log('📁 默认折叠任务:', tasksWithChildren.length, '个主任务')
    }
  }, [reflectionTasks])
  
  
  // ⭐ 处理概述页面按钮点击

  const handleOverviewButtonClick = useCallback((action: 'clarity' | 'decomposition' | 'time' | 'priority' | 'cancel') => {
    console.log('🔘 概述按钮点击:', action)

    
    
    // 禁用概述按钮

    setChatMessages(prev => prev.map(msg => ({

      ...msg,

      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'reflection-overview'

          ? { ...c, interactive: { ...c.interactive, isActive: false } }

          : c

      )

    })))

    
    
    if (action === 'cancel') {

      // 显示告别消息

      const byeMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的，有需要随时叫我～ 👋' }]

      }

      setChatMessages(prev => [...prev, byeMessage])

      
      // 清除loading状态
      setReflectionLoadingWithTimeout(false)
      
      
      // 1秒后关闭侧边栏

      setTimeout(() => {

        setIsChatSidebarOpen(false)

        // 清理反思状态

        setIsReflectionMode(false)

        setReflectionSessionId(null)

        setCurrentReflectionRound(null)

        setCompletedRounds([])

        setPendingRound(null)

        setCurrentReflectionType(null)  // 🆕 清空反思类型
      }, 1000)

      return

    }

    
    
    // 🔧 清空之前的问答状态

    setIsAnsweringQuestions(false)

    setCurrentQuestionIndex(0)

    setTotalQuestions([])

    setQuestionAnswers([])

    questionAnswersRef.current = []  // 🔧 同时清空 ref

    setDecomposingTaskTitle(null)

    setTaskContextInput('')

    
    // 🆕 设置当前反思类型
    setCurrentReflectionType(action)
    
    
    // 设置待选择任务的轮次

    setPendingRound(action)

    
    // ⭐ 初始化默认折叠状态
    initializeCollapsedTasks()
    
    
    // 显示任务选择消息（分成两条）

    const roundInfo = {

      clarity: { emoji: '📝', label: '澄清任务' },

      decomposition: { emoji: '✂️', label: '任务拆解' },
      time: { emoji: '⏱️', label: '时间规划' },

      priority: { emoji: '🎯', label: '优先级排列' }

    }

    const info = roundInfo[action]

    
    
    // 第一条：确认消息

    const confirmMessage: ChatMessage = {

      role: 'assistant' as const,

      content: [{ type: 'text' as const, text: `${info.emoji} 好的，让我们来做「${info.label}」～` }]

    }

    

    // 🆕 优先级排列的特殊处理
    if (action === 'priority') {
      // 如果用户已经在矩阵模式，直接显示使用指南
      if (viewMode === 'matrix') {
        // 直接显示使用指南 + 任务选择卡片
        const guideMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [{ 
            type: 'text' as const, 
            text: `📊 太好了，你已经在矩阵模式了！

**使用指南**：

✓ 选择合适的维度（重要/紧急、价值/工作量等）

✓ 已经清晰的任务建议直接拖入矩阵对应的象限

✓ 还不清晰的任务请在下面勾选，我会帮你思考优先级`
          }]
        }
        
    const selectionMessage: ChatMessage = {

      role: 'assistant' as const,

      content: [

        { 

          type: 'interactive' as const, 

          interactive: {

            type: 'reflection-task-selection' as const,

                data: { roundType: 'priority' },
            isActive: true

          }

        }

      ]

    }

    

        setChatMessages(prev => [...prev, confirmMessage, guideMessage, selectionMessage])
      } else {
        // 不在矩阵模式：先显示矩阵建议
        const matrixSuggestionMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [
            { 
              type: 'interactive' as const, 
              interactive: {
                type: 'priority-matrix-suggestion' as const,
                data: { taskCount: reflectionTasks.length },
                isActive: true
              }
            }
          ]
        }
        setChatMessages(prev => [...prev, confirmMessage, matrixSuggestionMessage])
      }
    } else {
      // 澄清任务和时间规划：直接显示任务选择卡片
    const selectionMessage: ChatMessage = {
      role: 'assistant' as const,
      content: [
        { 
          type: 'interactive' as const, 
          interactive: {
            type: 'reflection-task-selection' as const,
            data: { roundType: action },
            isActive: true
          }
        }
      ]
    }
    setChatMessages(prev => [...prev, confirmMessage, selectionMessage])

    }
    
    // 延迟清除loading状态（让按钮有时间显示loading并等待消息渲染完成）
    setTimeout(() => {
      console.log('🔓 清除loading状态')
      setReflectionLoadingWithTimeout(false)
    }, 500)  // 500ms后清除，确保UI已完全更新
  }, [reflectionTasks, initializeCollapsedTasks, setReflectionLoadingWithTimeout, viewMode])
  
  // ⭐ 底部快捷按钮启动反思
  const handleReflectionQuickStart = useCallback(async (type: 'clarity' | 'decomposition' | 'time' | 'priority') => {
    // 🔒 防止重复点击
    if (isReflectionLoading) {
      console.log('⚠️ 正在处理中，忽略重复点击')
      return
    }
    
    console.log('🚀 底部按钮启动反思:', type)
    
    // 设置loading状态
    setReflectionLoadingWithTimeout(true, type)
    console.log('🔒 已设置loading状态:', { isReflectionLoading: true, loadingReflectionType: type })
    
    // 1. 如果正在进行其他反思，清除相关消息
    if (currentReflectionType && currentReflectionType !== type) {
      console.log('🔄 切换反思类型:', currentReflectionType, '->', type)
      
      // 清除旧的反思相关消息（问题卡片、任务选择卡片等）
      setChatMessages(prev => 
        prev.filter(msg => 
          !msg.content?.some((c: MessageContent) => 
            c.type === 'interactive' && 
            (c.interactive?.type === 'question-answer' ||
             c.interactive?.type === 'reflection-task-selection' ||
             c.interactive?.type === 'decomposition-context-input' ||
             c.interactive?.type === 'priority-matrix-suggestion')
          )
        )
      )
      
      // 可选：添加系统提示消息
      const typeNames = {
        clarity: '任务澄清',
        decomposition: '任务拆解',
        time: '时间规划',
        priority: '优先级排列'
      }
      const switchMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ 
          type: 'text' as const, 
          text: `已切换到${typeNames[type]}` 
        }]
      }
      setChatMessages(prev => [...prev, switchMessage])
    }
    
    // 2. 设置当前反思类型
    setCurrentReflectionType(type)
    
    // 3. 确保有反思会话（如果没有则创建）
    if (!reflectionSessionId || !reflectionScanResult) {
      console.log('🔧 没有反思会话，先启动...')
      await startReflectionSession()
      // 等待状态更新后再继续
      setTimeout(() => {
        handleOverviewButtonClick(type)
        // loading会在handleOverviewButtonClick中清除
      }, 500)
    } else {
      // 4. 延迟调用反思启动逻辑，让loading状态有机会渲染
      setTimeout(() => {
        handleOverviewButtonClick(type)
        // loading会在handleOverviewButtonClick中清除
      }, 50)  // 最小延迟，确保至少有一次渲染周期显示loading
    }
  }, [currentReflectionType, handleOverviewButtonClick, reflectionSessionId, reflectionScanResult, startReflectionSession, isReflectionLoading, setReflectionLoadingWithTimeout])
  
  // ⭐ 处理切换到矩阵模式
  const handleSwitchToMatrix = useCallback(() => {
    console.log('🎯 用户选择切换到矩阵模式')
    
    // 禁用矩阵建议卡片
    setChatMessages(prev => prev.map(msg => ({
      ...msg,
      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'priority-matrix-suggestion'
          ? { ...c, interactive: { ...c.interactive, isActive: false } }
          : c
      )
    })))
    
    // 切换到矩阵视图（侧边栏不关闭）
    setViewMode('matrix')
    
    // 显示切换成功消息 + 使用指南
    const switchMessage: ChatMessage = {
      role: 'assistant' as const,
      content: [{ 
        type: 'text' as const, 
        text: `✨ 已切换到矩阵模式！

**使用指南**：

✓ 选择合适的维度（重要/紧急、价值/工作量等）

✓ 已经清晰的任务建议直接拖入矩阵对应的象限

✓ 还不清晰的任务请在下面勾选，我会帮你思考优先级` 
      }]
    }
    
    // 显示任务选择卡片
    const selectionMessage: ChatMessage = {
      role: 'assistant' as const,
      content: [
        { 
          type: 'interactive' as const, 
          interactive: {
            type: 'reflection-task-selection' as const,
            data: { roundType: 'priority' },
            isActive: true
          }
        }
      ]
    }
    
    setChatMessages(prev => [...prev, switchMessage, selectionMessage])
  }, [setViewMode])
  
  // ⭐ 处理跳过矩阵建议
  const handleSkipMatrixSwitch = useCallback(() => {
    console.log('⏭️ 用户跳过矩阵建议，继续优先级反思')
    
    // 禁用矩阵建议卡片
    setChatMessages(prev => prev.map(msg => ({
      ...msg,
      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'priority-matrix-suggestion'
          ? { ...c, interactive: { ...c.interactive, isActive: false } }
          : c
      )
    })))
    
    // 显示任务选择卡片
    const selectionMessage: ChatMessage = {
      role: 'assistant' as const,
      content: [
        { 
          type: 'interactive' as const, 
          interactive: {
            type: 'reflection-task-selection' as const,
            data: { roundType: 'priority' },
            isActive: true
          }
        }
      ]
    }
    setChatMessages(prev => [...prev, selectionMessage])
  }, [])

  
  
  // ⭐ 处理轮次完成后按钮点击

  const handleRoundCompleteButtonClick = useCallback((action: 'clarity' | 'decomposition' | 'time' | 'priority' | 'end') => {
    console.log('🔘 轮次完成按钮点击:', action)

    console.log('🔘 当前 completedRounds:', completedRounds)

    
    
    // 禁用按钮

    setChatMessages(prev => prev.map(msg => ({

      ...msg,

      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'reflection-round-complete'

          ? { ...c, interactive: { ...c.interactive, isActive: false } }

          : c

      )

    })))

    
    
    if (action === 'end') {

      // 结束反思，生成总结

      if (completedRounds.length > 0) {

        generateAndShowSummary()

      } else {

        // 没有完成任何轮次，显示告别消息

        const byeMessage: ChatMessage = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: '好的，有需要随时叫我～ 👋' }]

        }

        setChatMessages(prev => [...prev, byeMessage])

        
        
        setTimeout(() => {

          setIsChatSidebarOpen(false)

          setIsReflectionMode(false)

          setReflectionSessionId(null)

          setCurrentReflectionRound(null)

          setCompletedRounds([])

          setPendingRound(null)

          setCurrentReflectionType(null)  // 🆕 清空反思类型
        }, 1000)

      }

      return

    }

    
    
    // 🔧 清空之前的问答状态（允许重复进行轮次）

    setIsAnsweringQuestions(false)

    setCurrentQuestionIndex(0)

    setTotalQuestions([])

    setQuestionAnswers([])

    questionAnswersRef.current = []  // 🔧 同时清空 ref

    setDecomposingTaskTitle(null)

    setTaskContextInput('')

    
    
    // 设置待选择任务的轮次

    setPendingRound(action)

    
    
    // 显示任务选择消息（分成两条）

    const roundInfo = {

      clarity: { emoji: '📝', label: '澄清任务' },

      decomposition: { emoji: '✂️', label: '任务拆解' },
      time: { emoji: '⏱️', label: '时间规划' },

      priority: { emoji: '🎯', label: '优先级排列' }

    }

    const info = roundInfo[action]

    
    
    // 第一条：确认消息

    const confirmMessage: ChatMessage = {

      role: 'assistant' as const,

      content: [{ type: 'text' as const, text: `${info.emoji} 好的，让我们来做「${info.label}」～` }]

    }

    
    
    // 第二条：任务选择卡片

    const selectionMessage: ChatMessage = {

      role: 'assistant' as const,

      content: [

        { 

          type: 'interactive' as const, 

          interactive: {

            type: 'reflection-task-selection' as const,

            data: { roundType: action },

            isActive: true

          }

        }

      ]

    }

    
    
    setChatMessages(prev => [...prev, confirmMessage, selectionMessage])

  }, [completedRounds])

  
  
  // ⭐ 处理任务选择确认

  const handleTaskSelectionConfirm = useCallback(async (taskIds: string[]) => {

    console.log('✅ 任务选择确认:', taskIds)

    
    
    if (!pendingRound || !reflectionSessionId || !reflectionScanResult) {

      console.error('❌ 缺少必要状态')

      return

    }

    
    
    // 禁用任务选择卡片

    setChatMessages(prev => prev.map(msg => ({

      ...msg,

      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'reflection-task-selection'

          ? { ...c, interactive: { ...c.interactive, isActive: false } }

          : c

      )

    })))

    
    
    // 根据选中的 ID 获取任务

    const selectedTasks = reflectionTasks.filter(t => taskIds.includes(t.id))

    setSelectedTasksForRound(selectedTasks)
    
    

    // 🆕 对于 Clarity、Decomposition、Time 和 Priority 轮，使用单问题卡片流程
    if ((pendingRound === 'clarity' || pendingRound === 'decomposition' || pendingRound === 'time' || pendingRound === 'priority') && selectedTasks.length > 0) {
      // 显示加载消息

      const loadingMsg: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: pendingRound === 'priority' ? '让我看看这些任务...' : '让我看看这个任务...' }]

      }

      setChatMessages(prev => [...prev, loadingMsg])

      
      
      // 根据轮次生成不同的问题

      try {

        let questions: string[]

        let taskTitle: string

        
        
        if (pendingRound === 'clarity') {

          // Clarity 轮：生成澄清问题（单个任务）

          const task = selectedTasks[0]

          taskTitle = task.title

          questions = await generateDynamicDecompositionQuestions({

            id: task.id,

            title: task.title,

            estimatedDuration: task.estimatedDuration,

            deadline_datetime: task.deadline,

          } as any)

        } else if (pendingRound === 'decomposition') {
          // Decomposition 轮：生成context问题（单个任务）
          const task = selectedTasks[0]
          taskTitle = task.title
          questions = await generateContextQuestions({
            id: task.id,
            title: task.title,
            user_id: user?.id || '',
            completed: task.isCompleted,
            created_at: new Date().toISOString(),
            estimatedDuration: task.estimatedDuration,
            deadline_datetime: task.deadline,
          } as any)
        } else if (pendingRound === 'time') {

          // Time 轮：生成时间规划问题（单个任务）

          const task = selectedTasks[0]

          taskTitle = task.title

          questions = await generateTimeQuestions([task])

        } else {

          // Priority 轮：生成优先级问题（多个任务）

          taskTitle = selectedTasks.map(t => t.title).join('、')

          // 传入矩阵上下文，让 LLM 知道当前维度和已分类任务
          const matrixContext = buildMatrixContextForPriority()
          console.log('🎯 优先级反思矩阵上下文:', matrixContext)
          questions = await generatePriorityQuestions(selectedTasks, matrixContext)
        }

        
        
        console.log(`🔍 生成的问题数量: ${questions.length}`, questions)

        
        
        // 移除加载消息

        const loadingText = pendingRound === 'priority' ? '让我看看这些任务...' : '让我看看这个任务...'

        setChatMessages(prev => prev.filter(m => m.content?.[0]?.text !== loadingText))

        
        
        // 保存当前选择的任务和问题到状态

        setDecomposingTaskTitle(taskTitle)

        setTaskContextInput('')  // 清空之前的输入

        
        
        // 🆕 初始化问答流程

        console.log('🔄 初始化问答流程 - 清空之前的状态')

        setTotalQuestions(questions)

        setCurrentQuestionIndex(0)

        setQuestionAnswers([])  // 清空之前的回答

        questionAnswersRef.current = []  // 🔧 同时清空 ref

        setIsAnsweringQuestions(true)

        
        
        // 显示第一个问题的输入卡片

        const firstQuestionMsg: ChatMessage = {

          role: 'assistant' as const,

          content: [

            {

              type: 'interactive' as const,

              interactive: {

                type: 'question-answer' as const,

                data: {

                  question: questions[0],

                  questionIndex: 0,

                  totalQuestions: questions.length,

                  allQuestions: questions,  // 🆕 传递完整的问题数组
                  taskTitle: taskTitle,

                  taskId: pendingRound === 'priority' ? 'multiple' : selectedTasks[0].id,  // Priority 轮使用特殊标识

                  roundType: pendingRound  // 🆕 添加轮次类型，用于后续判断

                },

                isActive: true

              }

            }

          ]

        }

        
        
        setChatMessages(prev => [...prev, firstQuestionMsg])

      } catch (error) {

        console.error(`生成${pendingRound === 'clarity' ? '澄清' : '时间规划'}问题失败:`, error)

        // 降级：直接开始反思

        await startReflectionRound(pendingRound, selectedTasks, reflectionScanResult, reflectionSessionId)

      }

    } else {

      // 其他轮次（Priority）：直接开始反思

      await startReflectionRound(pendingRound, selectedTasks, reflectionScanResult, reflectionSessionId)

    }

    
    
    // 清除待选择状态

    setPendingRound(null)

  }, [pendingRound, reflectionSessionId, reflectionScanResult, reflectionTasks])

  
  
  // ⭐ 处理任务选择返回

  const handleTaskSelectionBack = useCallback(() => {

    console.log('↩️ 任务选择返回, 当前类型:', currentReflectionType || pendingRound)
    
    
    // 禁用任务选择卡片

    setChatMessages(prev => prev.map(msg => ({

      ...msg,

      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'reflection-task-selection'

          ? { ...c, interactive: { ...c.interactive, isActive: false } }

          : c

      )

    })))

    

    // 获取当前的反思类型（用于判断显示什么提示）
    const reflectionType = currentReflectionType || pendingRound
    
    // 清除待选择状态和当前反思类型
    setPendingRound(null)

    setCurrentReflectionType(null)
    
    // 根据反思类型显示不同的返回消息
    const promptText = reflectionType ? 
      `好的～

你可以：

• **点击下方任务规划按钮进行其他类型反思**

• **或点击右上角关闭侧边栏**` :
      '好的～ 继续反思请使用下方的快捷按钮\n\n如果觉得反思足够了，可以点击右上角 > 关闭侧边栏'
    
    
    // 显示返回消息

    const overviewMessage: ChatMessage = {
      role: 'assistant' as const,

      content: [
        { type: 'text' as const, text: promptText },
        { 
          type: 'interactive' as const, 
          interactive: {
            type: 'reflection-overview' as const,
            data: { taskCount: reflectionTasks.length },
            isActive: true
          }
        }
      ]
    }
    
    setChatMessages(prev => [...prev, overviewMessage])
  }, [reflectionTasks, currentReflectionType, pendingRound])
  
  // ⭐ 处理拆解建议按钮点击
  const handleDecomposeSuggestionButton = useCallback(async (buttonId: string, context: any) => {
    console.log('🔘 按钮点击:', buttonId, context)
    
    // ⭐ 处理每日回顾相关按钮
    if (buttonId === 'daily-reflection-answer') {
      await handleDailyReflectionAnswer(context)
      return
    }
    
    if (buttonId === 'daily-reflection-skip') {
      await handleDailyReflectionSkip(context)
      return
    }
    
    if (buttonId === 'daily-reflection-resume') {
      // 恢复未完成的反思
      if (!user) return
      
      console.log('🔄 继续反思按钮被点击')
      
      // 禁用恢复卡片，显示加载状态
      setChatMessages(prev => prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'daily-reflection-resume'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      })))
      
      // 显示加载提示
      const loadingMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '⏳ 正在恢复反思...' }]
      }
      setChatMessages(prev => [...prev, loadingMessage])
      
      try {
        // 从数据库获取回顾记录（确保数据准确）
        const reflectionId = context.reflectionId
        const today = new Date().toISOString().split('T')[0]
        const existingReflection = await getTodayReflection(user.id, today)
        
        if (!existingReflection) {
          console.error('❌ 找不到回顾记录')
          // 移除加载消息，显示错误
          setChatMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: '❌ 找不到回顾记录，请重新开始' }]
          }))
          return
        }
        
        // 获取问题和当前进度
        const questions: [string, string, string] = [
          existingReflection.question_1,
          existingReflection.question_2,
          existingReflection.question_3
        ]
        const nextQuestionIndex = existingReflection.current_question_index // 0-based
        
        console.log('📋 恢复反思:', { 
          reflectionId: existingReflection.id, 
          nextQuestionIndex,
          questions 
        })
        
        // 更新状态
        setCurrentReflectionId(existingReflection.id)
        setDailyReflectionQuestions(questions)
        setDailyReflectionAnswers([
          existingReflection.answer_1,
          existingReflection.answer_2,
          existingReflection.answer_3
        ])
        setCurrentDailyQuestionIndex(nextQuestionIndex)
        
        if (nextQuestionIndex < 3) {
          // 移除加载消息，显示下一个问题
          const confirmMessage: ChatMessage = {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: '好的，让我们继续～' }]
          }
          
          const nextQuestion: ChatMessage = {
        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

                  type: 'daily-reflection-question',
                  data: {
                    question: questions[nextQuestionIndex],
                    questionNumber: nextQuestionIndex + 1,
                    totalQuestions: 3,
                    reflectionId: existingReflection.id,
                    allQuestions: questions
                  },
              isActive: true

            }

          }

        ]

      }

          
          setChatMessages(prev => prev.slice(0, -1).concat([confirmMessage, nextQuestion]))
          setIsDailyReflectionMode(true)
    } else {

          // 已经回答完所有问题，直接生成总结
          setChatMessages(prev => prev.slice(0, -1).concat({
        role: 'assistant' as const,
            content: [{ type: 'text' as const, text: '你已经回答完所有问题了，正在生成总结...' }]
          }))
          // 这里可以触发生成总结的逻辑
        }
      } catch (error: any) {
        console.error('❌ 恢复反思失败:', error)
        setChatMessages(prev => prev.slice(0, -1).concat({
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: `❌ 恢复失败: ${error.message}` }]
        }))
      }
      return
    }
    
    if (buttonId === 'daily-reflection-restart') {
      // 重新开始反思（删除旧记录）
      if (!user) return
      
      console.log('🔄 重新开始反思按钮被点击')
      
      // 禁用恢复卡片
      setChatMessages(prev => prev.map(msg => ({
        ...msg,
        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'daily-reflection-resume'
            ? { ...c, interactive: { ...c.interactive, isActive: false } }
            : c
        )
      })))
      
      // 显示加载提示
      const loadingMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '⏳ 正在为你生成个性化问题，请稍候...' }]
      }
      setChatMessages(prev => [...prev, loadingMessage])
      
      try {
        // 删除旧记录
        if (currentReflectionId) {
          const { deleteReflection } = await import('@/lib/dailyReflections')
          await deleteReflection(currentReflectionId)
          console.log('🗑️ 已删除旧的回顾记录')
        }
        
        // 重置状态
        setCurrentReflectionId(null)
        setDailyReflectionQuestions(null)
        setDailyReflectionAnswers([null, null, null])
        setCurrentDailyQuestionIndex(0)
        
        // 创建新的反思会话（处理可能的重复错误）
        const today = new Date().toISOString().split('T')[0]
        const { createDailyReflection: createReflection, getTodayReflection: getReflection } = await import('@/lib/dailyReflections')
        
        // 生成个性化问题
        console.log('🎯 开始生成个性化反思问题...')
        const allTasks = await getDailyTasksByNoteDate(user.id, today)
        
        // 🎯 只保留父任务（depth = 0 或 parentTaskId 为 null）
        const todayTasks = allTasks.filter(task => !task.parentTaskId && (task.depth === 0 || task.depth === undefined))
        console.log(`📋 今日任务数: 全部 ${allTasks.length}, 父任务 ${todayTasks.length}`)
        
        // 获取今天的任务规划会话
        const todayTaskReflection = await getCompletedReflectionSession(user.id, today)
        console.log(`📝 今日任务规划: ${todayTaskReflection ? '有' : '无'}`)
        
        const personalizedQuestions = await generatePersonalizedQuestions({
          tasks: todayTasks,  // 只传入父任务
          todayDailyReflection: null,
          todayTaskReflection: todayTaskReflection
        })
        const selectedQuestions = selectThreeQuestions(personalizedQuestions)
        console.log('✨ 个性化问题已生成:', selectedQuestions)
      
      let newReflection
      try {
        newReflection = await createReflection(user.id, today, selectedQuestions)
        console.log('✅ 创建新反思会话:', newReflection.id)
      } catch (error: any) {
        if (error.message === 'DUPLICATE_REFLECTION') {
          // 如果有重复，等待一下再尝试删除并重新创建
          console.log('⚠️ 检测到重复记录，重新处理...')
          await new Promise(resolve => setTimeout(resolve, 200)) // 等待200ms
          const existingReflection = await getReflection(user.id, today)
          if (existingReflection) {
            const { deleteReflection } = await import('@/lib/dailyReflections')
            await deleteReflection(existingReflection.id)
            await new Promise(resolve => setTimeout(resolve, 200)) // 再等待200ms
            newReflection = await createReflection(user.id, today, selectedQuestions)
            console.log('✅ 重新创建反思会话成功:', newReflection.id)
          }
    } else {
          throw error
        }
      }
      
      if (!newReflection) {
        throw new Error('创建反思会话失败')
      }
      
      // 设置状态
      setIsDailyReflectionMode(true)
      setCurrentReflectionId(newReflection.id)
      setDailyReflectionQuestions([
        newReflection.question_1,
        newReflection.question_2,
        newReflection.question_3
      ])
      setDailyReflectionAnswers([null, null, null])
      setCurrentDailyQuestionIndex(0)
      
      // 显示确认消息 + 第一个问题
      const confirmMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '好的，让我们重新开始～' }]
      }
      
      const firstQuestionMessage: ChatMessage = {
        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

              type: 'daily-reflection-question',
              data: {
                question: newReflection.question_1,
                questionNumber: 1,
                totalQuestions: 3,
                reflectionId: newReflection.id,
                allQuestions: [newReflection.question_1, newReflection.question_2, newReflection.question_3]
              },
              isActive: true

            }

          }

        ]

      }

      
        // 移除加载消息，显示实际问题
        setChatMessages(prev => prev.slice(0, -1).concat([confirmMessage, firstQuestionMessage]))
        
      } catch (error: any) {
        console.error('❌ 重新开始反思失败:', error)
        // 移除加载消息，显示错误
        setChatMessages(prev => prev.slice(0, -1).concat({
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: `❌ 生成问题失败: ${error.message}，请稍后重试` }]
        }))
      }
      return
    }
    
    if (buttonId === 'daily-reflection-close') {
      // 关闭反思界面
      
      // 1. 添加结束消息
      const byeMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '✨ 今日回顾已保存！期待明天与你再次相见 ~' }]
      }
      setChatMessages(prev => [...prev, byeMessage])
      
      // 2. 重置状态
      setIsDailyReflectionMode(false)
      setCurrentReflectionId(null)
      
      // 3. 延迟关闭侧边栏（让用户看到消息）
      setTimeout(() => {
        setIsChatSidebarOpen(false)
        if (typeof window !== 'undefined') {
          localStorage.setItem('chatSidebarOpen', JSON.stringify(false))
        }
      }, 1500) // 1.5秒后关闭
      
      return
    }
    
    if (buttonId === 'daily-reflection-view-history') {
      // 查看历史回顾
      await viewReflectionHistory()
      return
    }
    
    if (buttonId === 'daily-reflection-clear') {
      // 清空今日回顾
      if (!user) return
      
      const confirmClear = window.confirm('确定要清空今天的回顾记录和相关消息吗？')
      if (!confirmClear) return
      
      try {
        // 1. 先重置状态
        setIsDailyReflectionMode(false)
        setCurrentReflectionId(null)
        setDailyReflectionQuestions(null)
        setDailyReflectionAnswers([null, null, null])
        setCurrentDailyQuestionIndex(0)
        
        // 2. 清空相关消息
        setChatMessages(prev => 
          prev.filter(msg => 
            !msg.content?.some((c: MessageContent) => 
              c.type === 'interactive' && 
              (c.interactive?.type === 'daily-reflection-question' ||
               c.interactive?.type === 'daily-reflection-complete' ||
               c.interactive?.type === 'daily-reflection-already-done' ||
               c.interactive?.type === 'daily-reflection-resume')
            ) &&
            !msg.content?.some((c: MessageContent) => 
              c.type === 'text' && 
              (c.text?.includes('让我们一起回顾今天的任务吧') ||
               c.text?.includes('正在生成你的回顾总结'))
            )
          )
        )
        
        // 3. 删除数据库记录
        try {
          const today = new Date().toISOString().split('T')[0]
          const { getTodayReflection, deleteReflection } = await import('@/lib/dailyReflections')
          const reflection = await getTodayReflection(user.id, today)
          
          if (reflection) {
            await deleteReflection(reflection.id)
            console.log('✅ 已清空今日数据库回顾记录')
          }
        } catch (dbError: any) {
          console.warn('⚠️ 数据库清空失败（但状态已重置）:', dbError.message)
        }
        
        // 4. 显示成功消息
        const successMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: '✅ 今日回顾已清空，你可以重新开始回顾了～' }]
        }
        setChatMessages(prev => [...prev, successMessage])
        
      } catch (error: any) {
        console.error('❌ 清空回顾失败:', error)
        alert(`❌ 清空失败: ${error.message}`)
      }
      return
    }
    
    if (buttonId === 'daily-reflection-load-more') {
      // 加载更多历史
      await loadMoreReflectionHistory()
      return
    }
    
    if (buttonId === 'daily-reflection-history-close') {
      // 关闭历史卡片
      setChatMessages(prev => 
        prev.filter(msg => 
          !msg.content?.some((c: MessageContent) => 
            c.type === 'interactive' && 
            c.interactive?.type === 'daily-reflection-history'
          )
        )
      )
      // 重置历史状态
      setReflectionHistoryData([])
      setReflectionHistoryOffset(0)
      setReflectionHistoryHasMore(false)
      return
    }
    
    
    // 禁用按钮

    setChatMessages(prev => prev.map(msg => ({

      ...msg,

      content: msg.content.map((c: MessageContent) => 
        c.type === 'interactive' && c.interactive?.type === 'buttons' && 

        (c.interactive?.data?.context?.taskId === context?.taskId || 

         c.interactive?.data?.context?.action === context?.action ||

         c.interactive?.data?.context?.questionIndex === context?.questionIndex)

          ? { ...c, interactive: { ...c.interactive, isActive: false } }

          : c

      )

    })))

    
    
    // 🆕 处理"下一个问题"按钮（从卡片接收answer）

    if (buttonId === 'next-question') {

      const taskId = context?.taskId

      const currentAnswer = context?.answer || ''  // 从卡片传递的answer

      
      
      // 🔧 使用从卡片传来的 questionIndex 和 totalQuestions，而不是状态中的值

      const currentIndex = context?.questionIndex ?? 0

      const totalQuestionsCount = context?.totalQuestions ?? totalQuestions.length

      
      // 🆕 从卡片获取完整的问题数组（优先使用卡片数据，回退到状态）
      const questionsArray = context?.allQuestions || totalQuestions
      
      
      console.log('🔘 下一个问题按钮点击', {

        currentIndex,

        totalQuestionsCount,

        totalQuestionsFromState: totalQuestions.length,

        questionsArrayLength: questionsArray.length,
        currentAnswer

      })

      
      
      // 禁用当前问答卡片

      setChatMessages(prev => prev.map(msg => ({

        ...msg,

        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'question-answer' && 

          c.interactive?.data?.questionIndex === currentIndex

            ? { ...c, interactive: { ...c.interactive, isActive: false } }

            : c

        )

      })))

      
      
      // 保存当前问题的回答（即使为空）

      let currentQuestionAnswer: { question: string; answer: string } | null = null

      if (currentIndex < totalQuestionsCount) {

        // 🔧 直接使用 context?.question（当前卡片显示的问题），而不是从状态中获取

        const currentQuestion = context?.question || questionsArray[currentIndex] || '未知问题'
        currentQuestionAnswer = { 

          question: currentQuestion, 

          answer: currentAnswer || '(跳过)' 

        }

        
        
        console.log('💾 保存问题回答', currentQuestionAnswer)

        
        
        // 🔧 同时更新 ref 和 state（ref 是同步的，state 是异步的）

        questionAnswersRef.current = [...questionAnswersRef.current, currentQuestionAnswer!]

        console.log('💾 questionAnswersRef.current:', questionAnswersRef.current)

        
        
        setQuestionAnswers(questionAnswersRef.current)

        
        
        // 如果用户有输入，保存到上下文

        if (currentAnswer) {

          setTaskContexts(prev => {

            const newMap = new Map(prev)

            const existingContext = newMap.get(taskId) || ''

            newMap.set(taskId, existingContext ? `${existingContext}\n${currentAnswer}` : currentAnswer)

            return newMap

          })

        }

      }

      
      
      const nextIndex = currentIndex + 1

      
      
      console.log('🔢 计算下一个问题索引', {

        currentIndex,

        nextIndex,

        totalQuestionsCount,

        hasMore: nextIndex < totalQuestionsCount

      })

      
      
      if (nextIndex < totalQuestionsCount) {

        // 还有下一个问题 - 更新当前卡片而不是创建新消息

        setCurrentQuestionIndex(nextIndex)
        
        

        // 🔧 边界检查：确保问题存在（使用 questionsArray）
        const nextQuestion = (questionsArray.length > nextIndex && questionsArray[nextIndex]) 
          ? questionsArray[nextIndex]
          : '问题加载失败，请跳过或返回重试'
        
        

        if (questionsArray.length === 0 || !questionsArray[nextIndex]) {
          console.error(`⚠️ 问题数组异常：尝试访问 questionsArray[${nextIndex}]，但数组长度为 ${questionsArray.length}`)
          console.error(`⚠️ Context信息:`, {

            taskId: context?.taskId,

            roundType: context?.roundType,

            totalQuestionsCount,

            currentIndex,
            hasAllQuestions: !!context?.allQuestions
          })

        }

        
        
        // 更新现有的问答卡片，显示下一个问题

        setChatMessages(prev => prev.map(msg => ({

          ...msg,

          content: msg.content.map((c: MessageContent) => 
            c.type === 'interactive' && c.interactive?.type === 'question-answer' && 

            c.interactive?.data?.questionIndex === currentIndex

              ? {

                  ...c,

                  interactive: {

                    ...c.interactive,

                    data: {

                      question: nextQuestion,  // 🔧 使用经过边界检查的问题

                      questionIndex: nextIndex,

                      totalQuestions: totalQuestionsCount,  // 🔧 使用从 context 获取的值

                      allQuestions: questionsArray,  // 🆕 传递完整问题数组
                      taskTitle: context?.taskTitle,

                      taskId,

                      roundType: context?.roundType  // 🔧 保留 roundType

                    },

                    isActive: true  // 重新激活卡片

                  }

                }

              : c

          )

        })))

      } else {

        // 所有问题回答完毕

        setIsAnsweringQuestions(false)

        
        
        // 卡片已经在前面被禁用了，这里不需要再次禁用

        
        
        console.log('📊 生成总结 - 调试信息:', {

          currentQuestionAnswer,

          questionAnswersRefLength: questionAnswersRef.current.length,

          questionAnswersRef: questionAnswersRef.current

        })

        
        
        // 🔧 使用 ref 获取所有回答（ref 是同步更新的，不受闭包影响）

        const allAnswers = [...questionAnswersRef.current]

        
        
        console.log('📊 最终的 allAnswers:', allAnswers)
        
        

        // 显示问答总结（带添加到任务按钮）
        const summaryMsg: ChatMessage = {

          role: 'assistant' as const,

          content: allAnswers.length > 0 
            ? [
                { type: 'text' as const, text: '好的，已经保存好您提供的信息，后续提供建议时会考虑～' },
                {
                  type: 'interactive' as const,
                  interactive: {
                    type: 'reflection-qa-summary' as const,
                    data: {
                      qaList: allAnswers,
                      taskId,
                      roundType: context?.roundType || 'clarity'
                    },
                    isActive: true
                  }
                }
              ]
            : [{ type: 'text' as const, text: '好的，已经保存好您提供的信息，后续提供建议时会考虑～' }]
        }
        
        // ✅ 保存任务规划问答到数据库
        if (allAnswers.length > 0) {
          const qaTextContent = allAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
          const qaMessage: ChatMessage = {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: `📋 任务规划问答记录（${context?.taskTitle || '任务'}）：\n\n${qaTextContent}` }]
          }
          saveKeyMessageToDb(qaMessage, 'reflection')
        }

        
        
        // 🆕 根据轮次类型显示不同的后续选项

        const roundType = context?.roundType || 'clarity'

        
        
        console.log('🔍 完成问答后的 roundType:', roundType, 'context:', context)

        
        
        let optionsMsg: ChatMessage

        
        
        if (roundType === 'clarity') {

          // Clarity 轮：显示返回按钮（不再提供拆解选项）
          optionsMsg = {

            role: 'assistant' as const,

            content: [

              { 

                type: 'text' as const, 

                text: `✅ 任务澄清完成！

你可以：

• **返回选择其他任务进行澄清**

• **点击底部任务规划按钮进行其他类型规划**`
              },

              {

                type: 'interactive' as const,

                interactive: {

                  type: 'buttons' as const,

                  data: {

                    buttons: [

                      { id: 'clarity-round-complete-back', label: '← 返回选择其他任务', variant: 'secondary' }
                    ],

                    context: { taskId, taskTitle: context?.taskTitle, roundType }

                  },

                  isActive: true

                }

              }

            ]

          }

        } else if (roundType === 'decomposition') {
          // Decomposition 轮：直接生成拆解建议
          console.log('✂️ 开始生成任务拆解建议', { taskTitle: context?.taskTitle, taskId })
          
          // 先显示总结消息
          setChatMessages(prev => [...prev, summaryMsg])
          
          // 确保设置了 decomposingTaskTitle
          const taskTitle = context?.taskTitle || '未知任务'
          setDecomposingTaskTitle(taskTitle)
          
          // 显示加载消息
          const loadingMsg: ChatMessage = {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: `🤔 正在拆解任务「${taskTitle}」...` }]
          }
          setChatMessages(prev => [...prev, loadingMsg])
          
          // 调用拆解AI
          setTimeout(async () => {
            try {
              const userContext = allAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
              
              // 调用 AI 生成拆解建议
              const result = await doubaoService.decomposeTask(
                taskTitle,
                undefined,
                userContext,
                undefined
              )
              
              // 移除加载消息
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
              
              // 解析 AI 返回的 JSON
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
              
              // 转换为 SubtaskSuggestion 格式
              const subtaskSuggestions = subtasks.map((task, index) => ({
                id: `suggestion-${Date.now()}-${index}`,
                title: task,
                order: index + 1,
                is_selected: true
              }))
              
              // 创建 mock task
              const mockParentTask = {
                id: `mock-${Date.now()}`,
                title: taskTitle,
                user_id: user?.id || '',
                is_completed: false,
                created_at: new Date().toISOString()
              } as any
              
              // 显示拆解卡片
              setChatMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: `✅ 好的！我为你拆解了任务「${taskTitle}」：`
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
              
              // 滚动到底部
              setTimeout(() => {
                if (chatScrollRef.current) {
                  chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
                }
              }, 100)
              
            } catch (error) {
              console.error('拆解失败:', error)
              setChatMessages(prev => prev.slice(0, -1)) // 移除加载消息
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
            }
          }, 100)
          
          return
        } else if (roundType === 'time') {

          // Time 轮：显示返回按钮

          optionsMsg = {

            role: 'assistant' as const,

            content: [

              { 

                type: 'text' as const, 

                text: `✅ 时间规划完成！

你可以：

• **返回选择其他任务进行时间规划**

• **点击底部任务规划按钮进行其他类型规划**`
              },

              {

                type: 'interactive' as const,

                interactive: {

                  type: 'buttons' as const,

                  data: {

                    buttons: [

                      { id: 'time-round-complete-back', label: '← 返回选择其他任务', variant: 'secondary' }
                    ],

                    context: { taskId, taskTitle: context?.taskTitle, roundType }

                  },

                  isActive: true

                }

              }

            ]

          }

        } else if (roundType === 'priority') {

          // Priority 轮：显示返回按钮

          optionsMsg = {

            role: 'assistant' as const,

            content: [

              { 

                type: 'text' as const, 

                text: `✅ 优先级反思完成！

你可以：

• **返回选择其他任务进行优先级反思**

• **点击底部任务规划按钮进行其他类型规划**`
              },

              {

                type: 'interactive' as const,

                interactive: {

                  type: 'buttons' as const,

                  data: {

                    buttons: [

                      { id: 'priority-round-complete-back', label: '← 返回选择其他任务', variant: 'secondary' }
                    ],

                    context: { taskId, taskTitle: context?.taskTitle, roundType }

                  },

                  isActive: true

                }

              }

            ]

          }

        } else {

          // 其他轮次（降级方案）

          // 根据轮次类型生成对应的返回按钮ID
          const backButtonId = `${roundType}-round-complete-back`
          
          optionsMsg = {

            role: 'assistant' as const,

            content: [

              { 

                type: 'text' as const, 

                text: `反思完成！`

              },

              {

                type: 'interactive' as const,

                interactive: {

                  type: 'buttons' as const,

                  data: {

                    buttons: [

                      { id: backButtonId, label: '← 返回', variant: 'secondary' }
                    ],

                    context: { taskId, taskTitle: context?.taskTitle, roundType }

                  },

                  isActive: true

                }

              }

            ]

          }

        }

        
        
        setChatMessages(prev => [...prev, summaryMsg, optionsMsg])

      }

      
      
      return

    }

    
    
    // 🆕 处理问答阶段的"返回"按钮

    if (buttonId === 'back-to-selection-from-qa') {

      // 清空问答状态

      setIsAnsweringQuestions(false)

      setCurrentQuestionIndex(0)

      setTotalQuestions([])

      setQuestionAnswers([])

      questionAnswersRef.current = []  // 🔧 同时清空 ref

      setDecomposingTaskTitle(null)

      setTaskContextInput('')

      
      // 从 context 中获取当前的 roundType，如果没有则使用 pendingRound
      const currentRoundType = context?.roundType || pendingRound || 'clarity'
      
      
      const confirmMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的，让我们选择其他任务～' }]

      }
      
      

      // 重新显示对应轮次的任务选择卡片
      const selectionMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

              type: 'reflection-task-selection' as const,

              data: { roundType: currentRoundType },
              isActive: true

            }

          }

        ]

      }
      
      

      setPendingRound(currentRoundType)
      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])

      
      
      return

    }

    
    
    // 处理返回任务选择按钮

    if (buttonId === 'back-to-selection') {

      // 从 context 中获取当前的 roundType，如果没有则使用 pendingRound
      const currentRoundType = context?.roundType || pendingRound || 'clarity'
      
      const confirmMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的，让我们选择其他任务～' }]

      }
      
      

      // 重新显示对应轮次的任务选择卡片
      const selectionMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

              type: 'reflection-task-selection' as const,

              data: { roundType: currentRoundType },
              isActive: true

            }

          }

        ]

      }
      
      

      setPendingRound(currentRoundType)
      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])

      
      
      // 清空拆解状态

      setDecomposingTaskTitle(null)

      setTaskContextInput('')

      
      
      return

    }

    

    if (buttonId === 'clarity-round-complete-back') {
      // Clarity 轮完成后返回到任务选择界面
      
      // 清空问答状态
      setIsAnsweringQuestions(false)
      setCurrentQuestionIndex(0)
      setTotalQuestions([])
      setQuestionAnswers([])
      questionAnswersRef.current = []  // 🔧 同时清空 ref
      setDecomposingTaskTitle(null)
      setTaskContextInput('')
      
      const confirmMessage: ChatMessage = {
        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的，让我们选择其他任务～' }]
      }
      
      // 重新显示澄清任务选择卡片
      const selectionMessage: ChatMessage = {
              role: 'assistant' as const,

              content: [

                {

                  type: 'interactive' as const,

                  interactive: {

              type: 'reflection-task-selection' as const,
              data: { roundType: 'clarity' },
                    isActive: true

                  }

                }

              ]

            }

      
      setPendingRound('clarity')
      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])
      
    } else if (buttonId === 'decomposition-round-complete-back') {
      // Decomposition 轮完成后返回到任务选择界面
      
      // 清空问答状态和拆解状态
      setIsAnsweringQuestions(false)
      setCurrentQuestionIndex(0)
      setTotalQuestions([])
      setQuestionAnswers([])
      questionAnswersRef.current = []  // 🔧 同时清空 ref
      setDecomposingTaskTitle(null)
      setTaskContextInput('')
      
      const confirmMessage: ChatMessage = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '好的，让我们选择其他任务～' }]
      }
      
      // 重新显示任务拆解选择卡片
      const selectionMessage: ChatMessage = {
          role: 'assistant' as const,

        content: [
          { 
            type: 'interactive' as const, 
            interactive: {
              type: 'reflection-task-selection' as const,
              data: { roundType: 'decomposition' },
              isActive: true
            }
          }
        ]
        }
      
      setPendingRound('decomposition')
      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])
      
    } else if (buttonId === 'time-round-complete-back') {

      // Time 轮完成后返回到任务选择界面

      
      
      // 清空问答状态

      setIsAnsweringQuestions(false)

      setCurrentQuestionIndex(0)

      setTotalQuestions([])

      setQuestionAnswers([])

      questionAnswersRef.current = []  // 🔧 同时清空 ref

      setDecomposingTaskTitle(null)

      setTaskContextInput('')

      
      
      const confirmMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的，让我们选择其他任务～' }]

      }

      
      
      // 重新显示时间规划任务选择卡片

      const selectionMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

              type: 'reflection-task-selection' as const,

              data: { roundType: 'time' },

              isActive: true

            }

          }

        ]

      }

      
      
      setPendingRound('time')

      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])
      
      

    } else if (buttonId === 'priority-round-complete-back') {

      // Priority 轮完成后返回到任务选择界面
      
      
      // 清空问答状态

      setIsAnsweringQuestions(false)

      setCurrentQuestionIndex(0)

      setTotalQuestions([])

      setQuestionAnswers([])

      questionAnswersRef.current = []  // 🔧 同时清空 ref

      setDecomposingTaskTitle(null)

      setTaskContextInput('')

      
      
      // 标记 Priority 轮已完成

      if (!completedRounds.includes('priority')) {

        setCompletedRounds(prev => [...prev, 'priority'])

      }

      

      const confirmMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [{ type: 'text' as const, text: '好的～' }]

      }
      
      

      // 显示任务选择卡片（回到 Priority 轮的任务选择界面）
      const selectionMessage: ChatMessage = {

        role: 'assistant' as const,

        content: [

          { 

            type: 'interactive' as const, 

            interactive: {

              type: 'reflection-task-selection' as const,

              data: { roundType: 'priority' },
              isActive: true

            }

          }

        ]

      }
      
      

      setChatMessages(prev => [...prev, confirmMessage, selectionMessage])
      
    }

  }, [taskContextInput, user])

  
  
  // ⭐ 开始某一轮反思

  const startReflectionRound = useCallback(async (

    round: ReflectionRoundType,

    tasks: TaskSnapshot[],

    scanResult: ScanResult,

    sessionId: string

  ) => {

    console.log(`🔄 开始 ${round} 轮反思...`)

    
    
    // 保存状态

    setCurrentReflectionRound(round)

    setReflectionScanResult(scanResult)

    setReflectionTasks(tasks)

    setIsGeneratingQuestions(true)

    setAskedQuestions([])  // 新轮次开始，清空已问问题

    
    
    try {

      // 检查是否需要执行这一轮

      const { shouldRun, reason } = shouldRunRound(round, scanResult, tasks.length)

      
      
      if (!shouldRun) {

        console.log(`⏭️ 跳过 ${round} 轮: ${reason}`)

        // 自动进入下一轮

        const nextRound = getNextRound(round)

        if (nextRound !== 'summary' && nextRound !== 'overview') {

          setTimeout(() => {

            startReflectionRound(nextRound as ReflectionRoundType, tasks, scanResult, sessionId)

          }, 500)

        } else {

          // 进入总结阶段

          // TODO: 调用总结工具

          console.log('📝 进入总结阶段')

        }

        return

      }

      
      
      // 生成反思问题

      const result = await generateRoundQuestions(round, tasks, scanResult)

      
      
      if (result) {

        // 记录已问的问题

        const questionTexts = result.questions.map(q => q.text)

        setAskedQuestions(questionTexts)

        
        
        // 显示问题

        const questionMessage = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: formatQuestionsAsMessage(result) }]

        }

        setChatMessages(prev => [...prev, questionMessage])
        
        

        // ⭐ Clarity 轮已不再自动进入拆解阶段
        // 用户可以通过底部"任务拆解"按钮主动选择拆解
        
        
        // 更新会话状态

        await updateReflectionSession(sessionId, {

          currentRound: round

        })

        
        
        console.log(`✅ ${round} 轮问题已显示`)

      } else {

        console.error(`❌ 生成 ${round} 轮问题失败`)

      }
      
      

    } catch (error) {

      console.error(`❌ ${round} 轮反思失败:`, error)

    } finally {

      setIsGeneratingQuestions(false)

    }

  }, [])
  
      
  
  // ⭐ 生成并显示反思总结（三轮完成后或点击结束时调用）

  // 注意：这个函数需要在 handleReflectionResponse 和 skipReflectionRound 之前定义

  const generateAndShowSummary = useCallback(async () => {

    if (!reflectionSessionId) return

    
    
    console.log('🌟 生成反思总结...')

    setCurrentReflectionRound(null)

    
    
    // 显示"正在生成总结"的消息

    const loadingMessage = {

      role: 'assistant' as const,

      content: [{ type: 'text' as const, text: '三轮反思完成！正在为你生成总结...' }]

    }

    setChatMessages(prev => [...prev, loadingMessage])

    
    
    // 收集已完成的轮次

    const completedRounds: ('clarity' | 'time' | 'priority')[] = ['clarity', 'time', 'priority']

    const userResponses: Record<string, string[]> = {}

    
    
    // 生成反思总结

    const summaryResult = await generateReflectionSummary(

      reflectionTasks,

      reflectionScanResult || {

        totalTaskCount: reflectionTasks.length,

        vagueTaskCount: 0,

        unestimatedTaskCount: 0,

        noPriorityCount: 0,

        workloadLevel: 'medium' as const,

        crossDayTasks: [],

        deadlineConflicts: []

      },

      completedRounds,

      userResponses

    )

    
    
    // 更新消息为总结内容

    if (summaryResult) {

      const summaryText = formatSummaryAsMessage(summaryResult)

      setChatMessages(prev => {

        const newMessages = [...prev]

        newMessages[newMessages.length - 1] = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: summaryText }]

        }

        return newMessages

      })

      
      
      // 保存到数据库

      await updateReflectionSession(reflectionSessionId, {

        status: 'completed',

        finalSummary: summaryResult.miniSummary,

        executionSuggestions: summaryResult.executionSuggestions.map(s => s.text)

      })

    } else {

      // 降级处理

      setChatMessages(prev => {

        const newMessages = [...prev]

        newMessages[newMessages.length - 1] = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: '反思完成！你可以回到任务列表根据需要调整，也可以直接开始执行。加油！💪' }]

        }

        return newMessages

      })

      
      
      await updateReflectionSession(reflectionSessionId, {

        status: 'completed'

      })

    }

    
    
    // 重置状态

    setIsReflectionMode(false)

    setReflectionSessionId(null)

    setCurrentReflectionType(null)  // 🆕 清空反思类型
  }, [reflectionSessionId, reflectionTasks, reflectionScanResult])

  
  
  // ⭐ 处理用户在反思中的回答，进入下一轮

  const handleReflectionResponse = useCallback(async (userResponse: string) => {

    if (!currentReflectionRound || !reflectionSessionId || !reflectionScanResult) {

      return false  // 不在反思模式

    }

    
    
    console.log(`📝 用户回答 (${currentReflectionRound}轮):`, userResponse)

    
    
    // TODO: 保存用户回答到会话

    
    
    // 进入下一轮

    const nextRound = getNextRound(currentReflectionRound)

    console.log(`➡️ 下一轮: ${nextRound}`)

    
    
    if (nextRound !== 'summary' && nextRound !== 'overview') {

      // 延迟一下再开始下一轮

      setTimeout(() => {

        startReflectionRound(

          nextRound as ReflectionRoundType, 

          reflectionTasks, 

          reflectionScanResult, 

          reflectionSessionId

        )

      }, 1000)

    } else {

      // 进入总结阶段 - 自动生成总结

      console.log('📝 三轮反思完成，自动进入总结阶段')

      await generateAndShowSummary()

    }

    
    
    return true  // 表示已处理

  }, [currentReflectionRound, reflectionSessionId, reflectionScanResult, reflectionTasks, startReflectionRound, generateAndShowSummary])

  
  
  // ⭐ 进入下一步（用户点击"下一步"按钮）- 现在改为显示轮次完成消息

  const handleNextStep = useCallback(async () => {

    if (!currentReflectionRound || !reflectionSessionId) {

      return

    }

    
    
    console.log(`➡️ 用户点击下一步，完成 ${currentReflectionRound} 轮`)

    
    
    // ⭐ 清除拆解阶段状态（如果有）

    if (isDecompositionPhase) {

      setIsDecompositionPhase(false)

      setDecomposableTasks([])

    }

    
    
    // 记录已完成的轮次

    setCompletedRounds(prev => {

      if (prev.includes(currentReflectionRound)) return prev

      return [...prev, currentReflectionRound]

    })

    
    
    // 清除当前轮次

    setCurrentReflectionRound(null)

    
    
    // 显示"这一轮完成了" + 4个按钮

    const roundInfo = {

      clarity: { emoji: '📝', label: '任务澄清' },

      decomposition: { emoji: '✂️', label: '任务拆解' },
      time: { emoji: '⏱️', label: '时间规划' },

      priority: { emoji: '🎯', label: '优先级排列' }

    }

    const info = roundInfo[currentReflectionRound]

    
    
    const completeMessage: ChatMessage = {

      role: 'assistant' as const,

      content: [

        { type: 'text' as const, text: `${info.emoji} 「${info.label}」这一轮完成了！你还想继续吗？` },

        { 

          type: 'interactive' as const, 

          interactive: {

            type: 'reflection-round-complete' as const,

            data: { completedRound: currentReflectionRound },

            isActive: true

          }

        }

      ]

    }

    setChatMessages(prev => [...prev, completeMessage])

  }, [currentReflectionRound, reflectionSessionId, isDecompositionPhase])

  
  
  // ⭐ 处理用户选择要拆解的任务（显示反思性问题）

  const handleDecomposeTaskSelect = useCallback(async (taskIds: string[]) => {

    console.log('✂️ 用户选择拆解任务:', taskIds)

    
    
    // 根据 ID 找到对应的任务

    const selectedTasks = decomposableTasks.filter(t => taskIds.includes(t.id))

    
    
    if (selectedTasks.length === 0) return

    
    
    // 设置拆解队列（第一个任务立即处理，剩余的放入队列）

    setDecompositionQueue(selectedTasks.slice(1))

    
    
    // 清除拆解选择阶段

    setIsDecompositionPhase(false)

    setDecomposableTasks([])

    
    
    // 开始处理第一个任务（显示反思性问题）

    const firstTask = selectedTasks[0]

    await startDecomposeWithQuestions(firstTask.title)
    
    

  }, [decomposableTasks])

  
  
  // ⭐ 开始拆解任务（先显示反思性问题）

  const startDecomposeWithQuestions = useCallback(async (taskTitle: string) => {

    console.log('🔄 开始拆解任务（显示问题）:', taskTitle)

    
    
    // 设置拆解状态

    setDecomposingTaskTitle(taskTitle)

    
    
    // 显示加载消息

    const loadingMessage: ChatMessage = {

      role: 'assistant',

      content: [{ type: 'text', text: `🤔 正在为「${taskTitle}」生成拆解问题...` }]

    }

    setChatMessages(prev => [...prev, loadingMessage])

    
    
    try {

      // 生成反思性问题

      const { generateDynamicDecompositionQuestions } = await import('@/lib/decompositionAI')

      const mockTask = {

        id: `decompose-${Date.now()}`,

        title: taskTitle,

        user_id: user?.id || '',

        is_completed: false,

        created_at: new Date().toISOString()

      }

      
      
      const questions = await generateDynamicDecompositionQuestions(mockTask as any)

      
      
      // 移除加载消息

      setChatMessages(prev => prev.slice(0, -1))

      
      
      // 显示问题输入卡片

      const aiMessage: ChatMessage = {

        role: 'assistant',

        content: [{

          type: 'interactive',

          interactive: {

            type: 'decomposition-context-input',

            data: {

              taskTitle: taskTitle,

              questions: questions || []

            },

            isActive: true

          }

        }]

      }

      setChatMessages(prev => [...prev, aiMessage])

      
      
      console.log('✅ 拆解问题已显示')
      
      

    } catch (error) {

      console.error('❌ 生成拆解问题失败:', error)

      setChatMessages(prev => prev.slice(0, -1))

      setChatMessages(prev => [...prev, {

        role: 'assistant',

        content: [{ type: 'text', text: '❌ 抱歉，生成问题时出错了，请稍后再试。' }]

      }])

    }

  }, [user])

  
  
  // ⭐ 跳过拆解，进入下一步（Time 轮）

  const handleSkipDecomposition = useCallback(() => {

    console.log('⏭️ 用户跳过拆解')

    
    
    // 清除拆解阶段状态

    setIsDecompositionPhase(false)

    setDecomposableTasks([])

    
    
    // 显示消息

    const skipMessage = {

      role: 'assistant' as const,

      content: [{ type: 'text' as const, text: '好的，我们继续下一步～' }]

    }

    setChatMessages(prev => [...prev, skipMessage])

    
    
    // 进入 Time 轮

    if (reflectionSessionId && reflectionScanResult) {

      setTimeout(() => {

        startReflectionRound('time', reflectionTasks, reflectionScanResult, reflectionSessionId)

      }, 500)

    }

  }, [reflectionSessionId, reflectionScanResult, reflectionTasks, startReflectionRound])

  
  
  // ⭐ 请求更多问题

  const requestMoreQuestions = useCallback(async () => {

    if (!currentReflectionRound || !reflectionScanResult || isGeneratingQuestions) return

    
    
    console.log('➕ 用户请求更多问题，已问过:', askedQuestions)

    setIsGeneratingQuestions(true)

    
    
    // 显示加载消息

    const loadingMessage = {

      role: 'assistant' as const,

      content: [{ type: 'text' as const, text: '好的，让我从其他角度再想几个问题...' }]

    }

    setChatMessages(prev => [...prev, loadingMessage])

    
    
    try {

      // 传递已问过的问题，让 LLM 生成不同的问题

      const result = await generateRoundQuestions(

        currentReflectionRound,

        reflectionTasks,

        reflectionScanResult,

        undefined,  // previousResponses

        askedQuestions  // 传递已问过的问题

      )

      
      
      if (result) {

        // 追加新问题到已问列表

        const newQuestionTexts = result.questions.map(q => q.text)

        setAskedQuestions(prev => [...prev, ...newQuestionTexts])

        
        
        const questionsText = formatQuestionsAsMessage({

          ...result,

          title: '补充问题',

          description: '换个角度再想想～'

        })

        
        
        // 替换加载消息

        setChatMessages(prev => {

          const newMessages = [...prev]

          newMessages[newMessages.length - 1] = {

            role: 'assistant' as const,

            content: [{ type: 'text' as const, text: questionsText }]

          }

          return newMessages

        })

      } else {

        // 没有更多问题

        setChatMessages(prev => {

          const newMessages = [...prev]

          newMessages[newMessages.length - 1] = {

            role: 'assistant' as const,

            content: [{ type: 'text' as const, text: '暂时没有更多问题了，你可以点击"下一步"继续～' }]

          }

          return newMessages

        })

      }

    } catch (error) {

      console.error('生成更多问题失败:', error)

      setChatMessages(prev => {

        const newMessages = [...prev]

        newMessages[newMessages.length - 1] = {

          role: 'assistant' as const,

          content: [{ type: 'text' as const, text: '生成问题时出了点问题，你可以点击"下一步"继续～' }]

        }

        return newMessages

      })

    } finally {

      setIsGeneratingQuestions(false)

    }

  }, [currentReflectionRound, reflectionScanResult, reflectionTasks, isGeneratingQuestions, askedQuestions])

  
  
  // ⭐ 结束反思流程（用户主动点击"结束"按钮）

  const endReflection = useCallback(async () => {

    if (!reflectionSessionId) return

    
    
    console.log('🏁 用户选择提前结束反思')

    await generateAndShowSummary()

  }, [reflectionSessionId, generateAndShowSummary])

  
  
  // ⭐ 用户选择继续拆解下一个任务

  const handleContinueDecompose = useCallback(async () => {

    if (decompositionQueue.length === 0) return

    
    
    const nextTask = decompositionQueue[0]

    console.log('📋 用户选择继续拆解:', nextTask.title)

    
    
    // 从队列中移除

    setDecompositionQueue(prev => prev.slice(1))

    
    
    // 禁用当前的选项卡片

    setChatMessages(prev => 

      prev.map(msg => ({

        ...msg,

        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'continue-decompose-options'

            ? { ...c, interactive: { ...c.interactive, isActive: false } }

            : c

        )

      }))

    )

    
    
    // 开始拆解下一个任务（显示问题）

    await startDecomposeWithQuestions(nextTask.title)

  }, [decompositionQueue, startDecomposeWithQuestions])

  
  
  // ⭐ 用户选择跳过继续拆解，进入下一步

  const handleSkipContinueDecompose = useCallback(() => {

    console.log('⏭️ 用户跳过继续拆解，清空队列')

    
    
    // 清空队列

    setDecompositionQueue([])

    
    
    // 禁用当前的选项卡片

    setChatMessages(prev => 

      prev.map(msg => ({

        ...msg,

        content: msg.content.map((c: MessageContent) => 
          c.type === 'interactive' && c.interactive?.type === 'continue-decompose-options'

            ? { ...c, interactive: { ...c.interactive, isActive: false } }

            : c

        )

      }))

    )

    

    // 显示消息和任务选择界面
    const overviewMessage: ChatMessage = {
      role: 'assistant' as const,
      content: [
        { type: 'text' as const, text: '好的，我们继续下一步～' },
        { 
          type: 'interactive' as const, 
          interactive: {
            type: 'reflection-overview' as const,
            data: { taskCount: reflectionTasks.length },
            isActive: true
    }
        }
      ]
    }
    
    setChatMessages(prev => [...prev, overviewMessage])
  }, [reflectionTasks])
  
  
  // 切换 AI 侧边栏

  const toggleChatSidebar = useCallback(async () => {

    const newState = !isChatSidebarOpen

    console.log('🔄 切换侧边栏状态:', isChatSidebarOpen, '→', newState)

    
    
    setIsChatSidebarOpen(newState)

    
    
    // ✅ 保存状态到 localStorage

    if (typeof window !== 'undefined') {

      localStorage.setItem('chatSidebarOpen', JSON.stringify(newState))

      console.log('💾 已保存到 localStorage:', newState)

    }
    
    

    // ⭐ 侧栏展开时，判断任务是否变化
    if (newState) {
      const currentDateKey = formatNoteDate(selectedDate)
      const currentTasks = reflectionTasks || []
      const currentHash = generateTaskHash(currentTasks)
      
      // 判断是否需要完整概览：日期变化 或 任务变化 或 首次打开
      const needsFullOverview = 
        lastOverviewDateRef.current !== currentDateKey ||
        lastOverviewHashRef.current !== currentHash ||
        lastOverviewHashRef.current === ''
      
      console.log('🔍 任务变化检测:', {
        dateChanged: lastOverviewDateRef.current !== currentDateKey,
        hashChanged: lastOverviewHashRef.current !== currentHash,
        needsFullOverview
      })
      
      if (needsFullOverview) {
        // 🆕 任务有变化 → 显示完整概览
        const loadingMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: '让我看看你这天的任务...' }]
        }
        setChatMessages(prev => {
          const filtered = prev.filter(m => {
            const text = m.content?.[0]?.text || ''
            return !text.includes('让我看看') && !text.includes('欢迎回来') && !text.includes('进展') && !text.includes('顺利')
          })
          return [...filtered, loadingMessage]
        })
        
        // 异步启动反思流程
        const session = await startReflectionSession()
        
        if (session) {
          console.log('✅ 反思会话已启动:', session.id)
          // 更新哈希记录
          lastOverviewDateRef.current = currentDateKey
          lastOverviewHashRef.current = currentHash
        }
      } else {
        // 🆕 任务没变化 → 显示个性化问候
        console.log('💬 任务无变化，显示个性化问候')
        
        // 先显示加载状态
        const loadingMessage: ChatMessage = {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: '...' }]
        }
        setChatMessages(prev => {
          const filtered = prev.filter(m => {
            const text = m.content?.[0]?.text || ''
            return !text.includes('让我看看') && !text.includes('欢迎回来') && !text.includes('进展') && !text.includes('顺利')
          })
          return [...filtered, loadingMessage]
        })
        
        // 生成个性化问候
        try {
          const greeting = await generatePersonalizedGreeting(currentTasks)
          const greetingMessage: ChatMessage = {
            role: 'assistant' as const,
            content: [{ 
              type: 'text' as const, 
              text: `${greeting}\n\n👇 请使用下方的快捷按钮开始规划` 
            }]
          }
          setChatMessages(prev => {
            // 替换加载消息
            const filtered = prev.filter(m => {
              const text = m.content?.[0]?.text || ''
              return text !== '...'
            })
            return [...filtered, greetingMessage]
          })
        } catch (error) {
          console.error('生成问候失败:', error)
          // 降级：使用简单问候
          const fallbackMessage: ChatMessage = {
            role: 'assistant' as const,
            content: [{ 
              type: 'text' as const, 
              text: `👋 今天任务怎么样呀～\n\n👇 请使用下方的快捷按钮开始规划` 
            }]
          }
          setChatMessages(prev => {
            const filtered = prev.filter(m => {
              const text = m.content?.[0]?.text || ''
              return text !== '...'
            })
            return [...filtered, fallbackMessage]
          })
        }
      }
    }

  }, [isChatSidebarOpen, startReflectionSession, selectedDate, reflectionTasks])



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



  // ⭐⭐⭐ Matrix Context Functions ⭐⭐⭐

  
  
  /**

   * 构建矩阵模式的AI上下文

   * 

   * 当用户在矩阵视图时，收集当前矩阵状态，让AI理解：

   * - 用户正在查看哪一天的矩阵

   * - 当前使用的矩阵维度

   * - 每个象限有哪些任务

   */

  const buildMatrixContext = useCallback((): MatrixContext | null => {

    // 只有在矩阵模式下才返回上下文

    if (viewMode !== 'matrix') {

      return null

    }

    
    
    console.log('📊 构建矩阵上下文...')

    
    
    // 获取当前矩阵维度的配置

    const dimensionConfig = MATRIX_DIMENSION_CONFIGS[selectedMatrixDimension]

    const quadrantsConfig = MATRIX_QUADRANTS_CONFIGS[selectedMatrixDimension]

    
    
    // 构建矩阵上下文

    const context: MatrixContext = {

      isMatrixMode: true,

      matrixDate: formatNoteDate(selectedDate),

      matrixDimension: selectedMatrixDimension,

      tasksByQuadrant: {

        // Q1: 右上 (top-right)

        q1: (tasksByQuadrant['urgent-important'] || []).map(t => ({

          title: t.title,

          checked: t.checked

        })),

        // Q2: 左上 (top-left)

        q2: (tasksByQuadrant['not-urgent-important'] || []).map(t => ({

          title: t.title,

          checked: t.checked

        })),

        // Q3: 右下 (bottom-right)

        q3: (tasksByQuadrant['urgent-not-important'] || []).map(t => ({

          title: t.title,

          checked: t.checked

        })),

        // Q4: 左下 (bottom-left)

        q4: (tasksByQuadrant['not-urgent-not-important'] || []).map(t => ({

          title: t.title,

          checked: t.checked

        }))

      },

      quadrantLabels: {

        q1: quadrantsConfig['top-right'].name,

        q2: quadrantsConfig['top-left'].name,

        q3: quadrantsConfig['bottom-right'].name,

        q4: quadrantsConfig['bottom-left'].name

      }

    }

    
    
    console.log('📊 矩阵上下文已构建:', {

      date: context.matrixDate,

      dimension: context.matrixDimension,

      taskCounts: {

        q1: context.tasksByQuadrant.q1.length,

        q2: context.tasksByQuadrant.q2.length,

        q3: context.tasksByQuadrant.q3.length,

        q4: context.tasksByQuadrant.q4.length

      }

    })

    
    
    return context

  }, [viewMode, selectedDate, selectedMatrixDimension, tasksByQuadrant])


  /**
   * 构建优先级反思的矩阵上下文
   * 用于生成更有针对性的优先级反思问题
   */
  const buildMatrixContextForPriority = useCallback((): MatrixContextForPriority => {
    // 获取当前矩阵轴配置
    const axesConfig = matrixAxes || DEFAULT_MATRIX_AXES
    const xDimConfig = getDimensionConfig(axesConfig.xAxis)
    const yDimConfig = getDimensionConfig(axesConfig.yAxis)
    const axisLabels = getAxisLabels(axesConfig)
    
    // 构建轴信息
    const xAxisInfo: MatrixAxisInfo = {
      id: xDimConfig.id,
      name: xDimConfig.name,
      highLabel: xDimConfig.levels.high,
      lowLabel: xDimConfig.levels.low
    }
    
    const yAxisInfo: MatrixAxisInfo = {
      id: yDimConfig.id,
      name: yDimConfig.name,
      highLabel: yDimConfig.levels.high,
      lowLabel: yDimConfig.levels.low
    }
    
    // 辅助函数：构建象限信息
    const buildQuadrantInfo = (quadrantKey: string, label: string): QuadrantInfo => {
      const tasks = tasksByQuadrant[quadrantKey as keyof typeof tasksByQuadrant] || []
      return {
        label,
        tasks: tasks
          .filter(t => !t.checked)  // 只考虑未完成的任务
          .map(t => t.title)
      }
    }
    
    // 动态生成象限标签
    // top-left: 高Y + 低X, top-right: 高Y + 高X
    // bottom-left: 低Y + 低X, bottom-right: 低Y + 高X
    const topLeftLabel = `${yAxisInfo.highLabel}但${xAxisInfo.lowLabel}`  // 如：重要但不紧急
    const topRightLabel = `${yAxisInfo.highLabel}且${xAxisInfo.highLabel}`  // 如：重要且紧急
    const bottomLeftLabel = `${yAxisInfo.lowLabel}且${xAxisInfo.lowLabel}`  // 如：不重要且不紧急
    const bottomRightLabel = `${yAxisInfo.lowLabel}但${xAxisInfo.highLabel}`  // 如：不重要但紧急
    
    // 构建象限任务分布
    // 注意：tasksByQuadrant 使用的是静态键名，需要映射到实际象限位置
    const quadrants = {
      topLeft: buildQuadrantInfo('not-urgent-important', topLeftLabel),
      topRight: buildQuadrantInfo('urgent-important', topRightLabel),
      bottomLeft: buildQuadrantInfo('not-urgent-not-important', bottomLeftLabel),
      bottomRight: buildQuadrantInfo('urgent-not-important', bottomRightLabel)
    }
    
    // 获取待分类任务（未完成的）
    const unclassifiedTasks = (tasksByQuadrant['unclassified'] || [])
      .filter(t => !t.checked)
      .map(t => t.title)
    
    const context: MatrixContextForPriority = {
      axes: {
        xAxis: xAxisInfo,
        yAxis: yAxisInfo
      },
      quadrants,
      unclassifiedTasks
    }
    
    console.log('🎯 优先级反思矩阵上下文:', {
      axes: `${yAxisInfo.name} × ${xAxisInfo.name}`,
      quadrantCounts: {
        topLeft: quadrants.topLeft.tasks.length,
        topRight: quadrants.topRight.tasks.length,
        bottomLeft: quadrants.bottomLeft.tasks.length,
        bottomRight: quadrants.bottomRight.tasks.length
      },
      unclassifiedCount: unclassifiedTasks.length
    })
    
    return context
  }, [matrixAxes, tasksByQuadrant])


  // ⭐⭐⭐ Agent Message Handling Functions ⭐⭐⭐

  
  
  // 处理 Agent 模式的消息

  // 🆕 检查并刷新笔记（根据工具执行结果）

  const checkAndRefreshNote = useCallback(async (agent: any) => {

    try {

      console.log('🔍 [DEBUG] 开始检查是否需要刷新笔记...')

      
      
      // 从 Agent 的执行历史中获取所有工具执行步骤

      const steps = agent.memory.getSteps()

      console.log('🔍 [DEBUG] Agent 执行步骤数量:', steps.length)

      
      
      // 检查是否有任何工具要求刷新

      let needsRefresh = false

      const allAffectedDates = new Set<string>()

      
      
      for (let i = 0; i < steps.length; i++) {

        const step = steps[i]

        // observation 中包含了 ToolResult

        const toolResult = step.observation

        
        
        console.log(`🔍 [DEBUG] 步骤 ${i}:`, {

          action: step.action,

          observationType: toolResult?.type,

          shouldRefreshNote: toolResult?.shouldRefreshNote,

          affectedDates: toolResult?.affectedDates,

          fullObservation: toolResult

        })

        
        
        if (toolResult?.shouldRefreshNote === true) {

          needsRefresh = true

          console.log(`✅ [DEBUG] 步骤 ${i} 需要刷新`)

          
          
          // 收集受影响的日期

          if (toolResult.affectedDates && Array.isArray(toolResult.affectedDates)) {

            toolResult.affectedDates.forEach((date: string) => 

              allAffectedDates.add(date)

            )

          }

        }

      }

      
      
      console.log('🔍 [DEBUG] 检查结果:', { needsRefresh, affectedDatesCount: allAffectedDates.size })

      
      
      if (!needsRefresh) {

        console.log('ℹ️ 无需刷新笔记')

        return

      }

      
      
      console.log('🔄 检测到笔记修改，开始刷新...')

      console.log('📅 受影响的日期:', Array.from(allAffectedDates))

      
      
      // 刷新当前笔记

      if (user) {

        await loadNote(user.id, selectedDate)

        console.log('✅ 当前笔记已刷新')

      }

      
      
      // 如果有多个日期受影响，刷新日历视图

      if (allAffectedDates.size > 1 && user) {

        console.log('🔄 刷新日历视图（多个日期受影响）...')

        await loadNotesForMultipleMonths(user.id, selectedDate, 1)

        console.log('✅ 日历视图已刷新')

      }
      
      

    } catch (error) {

      console.error('❌ 刷新笔记失败:', error)

      // 不抛出错误，避免影响用户体验

    }

  }, [loadNote, loadNotesForMultipleMonths, user, selectedDate, calculateNotesDateRange])

  
  
  const handleAgentMessage = async () => {

    if (!agentInstance || !user) {

      console.error('❌ Agent 未初始化或用户未登录')

      return

    }

    // ⭐ 立即保存并清空输入框，防止重复提交
    const messageToSend = chatMessage.trim()
    if (!messageToSend) {
      console.warn('⚠️ 消息为空，跳过处理')
      return
    }
    setChatMessage('')  // 立即清空，防止重复添加
    
    console.log('🤖 Agent 模式：开始处理消息:', messageToSend)

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

      content: [{ type: 'text', text: messageToSend }]

    }

    // ⭐ 防重复：如果上一条已经是相同的 user 文本，就不要再追加一次
    // 同时立即添加 loading 指示器（不等待数据库保存）
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
    
    setChatMessages(prev => {
      const last = prev[prev.length - 1]
      const lastText = last?.role === 'user'
        ? (last.content.find((c: any) => c.type === 'text') as any)?.text?.trim?.() || ''
        : ''
      // 如果上一条已经是相同的 user 文本，只添加 loading
      if (last?.role === 'user' && lastText === messageToSend) {
        return [...prev, loadingMessage]
      }
      // 否则添加用户消息 + loading
      return [...prev, userMessage, loadingMessage]
    })

    
    
    // 💾 异步保存用户消息到数据库（不阻塞 UI）
    const chatDate = formatNoteDate(currentContextDate)
    saveChatMessage(user.id, chatDate, 'user', userMessage.content, chatDate)
      .then(() => logger.success('用户消息已保存到数据库'))
      .catch((error) => logger.error('保存用户消息失败:', error))

    
    
    // ⭐ 超时保护：30秒后自动移除 loading 并提示
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Agent 执行超时（30秒）')
      
      // 移除 loading
      setChatMessages(prev => prev.filter(msg => {
        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive
        return interactive?.type !== 'agent-loading'
      }))
      
      // 添加超时提示
      const timeoutMessage: ChatMessage = {
        role: 'assistant',
        content: [{
          type: 'text',
          text: '⏱️ 处理超时了，请稍后再试，或者简化一下你的问题～'
        }]
      }
      setChatMessages(prev => [...prev, timeoutMessage])
      
      setIsAgentRunning(false)
    }, 30000)  // 30秒超时
    
    try {

      // 3. 构建 Agent Context

      const matrixCtx = buildMatrixContext()  // 🆕 构建矩阵上下文

      
      
      const agentContext: AgentContext = {

        userId: user.id,

        userProfile: userProfile,

        dateScope: dateScope,

        taskContext: undefined,  // 将由 Agent 自动加载

        matrixContext: matrixCtx  // 🆕 传入矩阵上下文

      }

      
      
      console.log('📦 Agent Context:', agentContext)

      if (matrixCtx) {

        console.log('📊 包含矩阵上下文:', matrixCtx.matrixDimension, matrixCtx.matrixDate)

      }

      
      
      // 4. 调用 Agent

      const result = await agentInstance.run(messageToSend, agentContext)

      console.log('📊 Agent 返回结果:', result)

      
      
      // 4. 移除加载指示器

      setChatMessages(prev => prev.filter(msg => {

        const interactive = msg.content.find((c: any) => c.type === 'interactive')?.interactive

        return interactive?.type !== 'agent-loading'

      }))

      
      
      // ⭐ 清除超时定时器
      clearTimeout(timeoutId)
      
      // 5. 处理 Agent 返回结果（加上异常捕获，防止卡住 loading）
      try {
        await handleAgentResult(result)
      } catch (resultError: any) {
        console.error('❌ 处理 Agent 结果时出错:', resultError)
        
        // 添加兜底错误消息
        const fallbackError: ChatMessage = {
          role: 'assistant',
          content: [{
            type: 'text',
            text: `抱歉，处理结果时出现了问题：${resultError.message || '未知错误'}`
          }]
        }
        setChatMessages(prev => [...prev, fallbackError])
      }
      
      

    } catch (error: any) {

      console.error('❌ Agent 执行失败:', error)

      
      
      // ⭐ 清除超时定时器
      clearTimeout(timeoutId)
      
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

      
      
      // 🆕 检查是否需要刷新笔记

      if (agentInstance) {

        await checkAndRefreshNote(agentInstance)

      }

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
    const now = new Date().toISOString()

    
    
    // ⭐ 新版：将所有 Thought + Action + Observation 合并成一个"推理过程"卡片
    const hasThoughts = result.metadata?.thoughts && Array.isArray(result.metadata.thoughts) && result.metadata.thoughts.length > 0
    const hasSteps = result.metadata?.steps && Array.isArray(result.metadata.steps) && result.metadata.steps.length > 0
    
    if (hasThoughts || hasSteps) {
      // 构建 thoughts 数组
      const thoughts = hasThoughts 
        ? result.metadata.thoughts.map((thought: string, i: number) => ({
            thought,
            iteration: i + 1,
            timestamp: now
          }))
        : []
      
      // 构建 actions 数组（每个 action 配对对应的 observation）
      const actions = hasSteps
        ? result.metadata.steps.map((step: any) => ({
            action: {
              toolName: step.tool || step.action,
              toolDescription: step.toolDescription || step.tool || step.action,
              parameters: step.parameters || step.input,
              timestamp: now
            },
            observation: {
              toolName: step.tool || step.action,
              success: step.success !== false && step.observation?.type !== 'error',
              result: step.observation,
              error: step.error || (step.observation?.type === 'error' ? step.observation.message : undefined),
              timestamp: now
            }
          }))
        : []
      
      // 添加合并后的推理过程卡片
      messages.push({
        role: 'assistant',
        content: [{
          type: 'interactive',
          interactive: {
            type: 'agent-reasoning',
            data: {
              thoughts,
              actions,
              startTime: now,
              endTime: now
            },
            isActive: false
          }
        }]
      })
    }

    
    
    // 🆕 2.5 检测 get_tasks 工具调用，如果有则添加结构化任务列表卡片

    let hasTaskListCard = false

    if (result.metadata?.steps && Array.isArray(result.metadata.steps)) {

      for (const step of result.metadata.steps) {

        logger.debug('🔍 检查 step:', {

          action: step.action,

          hasObservation: !!step.observation,

          observationType: step.observation?.type,

          hasData: !!step.observation?.data,

          hasTasks: !!step.observation?.data?.tasks,

          observationKeys: step.observation ? Object.keys(step.observation) : [],

          dataKeys: step.observation?.data ? Object.keys(step.observation.data) : []

        })

        
        
        // ⭐ 修复：AgentMemory.addStep 的结构是 { action, input, observation }

        // observation 保存的是完整的 toolResult，结构为 { type: 'success', data: { count, tasks, ... }, message: string }

        if (step.action === 'get_tasks' && step.observation?.type === 'success' && step.observation?.data?.tasks && Array.isArray(step.observation.data.tasks)) {

          const taskData = step.observation.data

          
          
          // 🆕 保存查询条件（用于后续刷新）

          if (step.input) {

            setLastTaskQueryFilters(step.input)

            logger.debug('💾 已保存任务查询条件:', step.input)

          }

          
          
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

    
    
    // 3. 🆕 只在没有任务列表卡片时才添加文本回复（避免内容重复）

    if (!hasTaskListCard) {

      messages.push({

        role: 'assistant',

        content: [{ type: 'text', text: result.content }]

      })

    } else {

      logger.debug('⏭️ 跳过文本回复（已显示任务列表卡片）')

    }

    
    
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

          
          
          // 🆕 刷新任务列表卡片

          await refreshTaskListInChat()

          
          
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

          content: msg.content.map((c: MessageContent) => 
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



  // ⭐⭐⭐ Context Building Functions ⭐⭐⭐



  // 辅助函数：将 ProseMirror JSON 转为纯文本

  const getNoteText = useCallback((content: JSONContent | null): string => {

    if (!content) return ''

    let text = ''

    if (content.text) text += content.text

    // 处理段落换行

    if (content.type === 'paragraph') text += '\n'

    if (content.content) {

      content.content.forEach(child => {

        text += getNoteText(child)

      })

    }

    return text

  }, [])



  // 🆕 构建笔记上下文文本 (已瘦身优化)

  const buildNoteContextText = useCallback(() => {

    if (viewMode !== 'editor') return null

    
    
    const dateStr = formatNoteDate(currentContextDate)

    
    
    // ✂️ 笔记内容截断优化

    let noteText = currentNote ? getNoteText(currentNote).trim() : '（空笔记）'

    if (noteText.length > 1000) {

      noteText = noteText.substring(0, 600) + '\n\n...（中间内容已折叠以加速AI响应）...\n\n' + noteText.substring(noteText.length - 300)

    }

    
    
    // ✂️ 任务列表瘦身优化

    const allTasks = Object.values(tasksByQuadrant).flat()

    const completedCount = allTasks.filter(t => t.completed).length

    const pendingTasks = allTasks.filter(t => !t.completed)

    
    
    let taskListText = ''

    if (completedCount > 0) {

       taskListText += `✅ 已完成：${completedCount} 项\n`

    }

    
    
    if (pendingTasks.length > 0) {

       taskListText += pendingTasks.map(t => `- [TODO] ${t.title}`).join('\n')

    } else if (completedCount === 0) {

       taskListText = '（无任务）'

    }



    // ✂️ 用户画像瘦身优化

    let profileText = ''

    if (userProfile) {

       const parts = []

       if (user?.username) parts.push(`用户:${user.username}`)

       if (userProfile.challenges?.length) parts.push(`挑战:${userProfile.challenges.join(',')}`)

       if (parts.length > 0) profileText = `[用户简报] ${parts.join(' | ')}\n\n`

    }

      
      
    return `

${profileText}[笔记上下文] ${dateStr}

【笔记摘要】：

${noteText || '（无内容）'}

【待办清单】：

${taskListText}

`.trim()

  }, [viewMode, currentContextDate, currentNote, tasksByQuadrant, getNoteText, userProfile, user])



  // 🆕 构建矩阵上下文文本 (已瘦身优化)

  const buildMatrixContextText = useCallback(() => {

    if (viewMode !== 'matrix') return null



    const dateStr = formatNoteDate(currentContextDate)

    const axesConfig = matrixAxes || DEFAULT_MATRIX_AXES

    
    
    // ⭐ 动态获取维度配置

    const xDimConfig = getDimensionConfig(axesConfig.xAxis)

    const yDimConfig = getDimensionConfig(axesConfig.yAxis)

    
    
    // ⭐ 动态生成象限名称（不再依赖静态配置）

    const dynamicQuadrantsConfig = {

        'top-right': `${yDimConfig.levels.high}且${xDimConfig.levels.high}`, // e.g. 重要且紧急

        'top-left': `${yDimConfig.levels.high}${xDimConfig.levels.low}`,      // e.g. 重要不紧急

        'bottom-right': `${yDimConfig.levels.low}${xDimConfig.levels.high}`,  // e.g. 不重要紧急

        'bottom-left': `${yDimConfig.levels.low}${xDimConfig.levels.low}`     // e.g. 不重要不紧急

    }



    // 🔍 调试日志：验证当前维度

    console.log('🔍 构建矩阵上下文:', {

      xAxis: xDimConfig.name,

      yAxis: yDimConfig.name,

      quadrants: dynamicQuadrantsConfig

    })

    
    
    // ⭐ 建立物理象限ID到象限位置的映射关系

    // 物理象限ID（数据库存储） → 象限位置（用于获取当前维度的标签）

    const quadrantIdToPosition: Record<QuadrantType, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {

      'urgent-important': 'top-right',           // 右上

      'not-urgent-important': 'top-left',        // 左上

      'urgent-not-important': 'bottom-right',    // 右下

      'not-urgent-not-important': 'bottom-left', // 左下

      'unclassified': 'top-left'                 // 默认

    }

    
    
    let matrixStats = ''

    let totalCompleted = 0

    
    
    // ⭐ 遍历所有物理象限，使用当前维度的动态标签

    const physicalQuadrants: QuadrantType[] = [

      'urgent-important',

      'not-urgent-important',

      'urgent-not-important',

      'not-urgent-not-important',

      'unclassified'

    ]

    
    
    physicalQuadrants.forEach(quadrantId => {

      const tasks = tasksByQuadrant[quadrantId] || []

      if (tasks.length > 0) {

        // ⭐ 根据当前维度获取对应的象限标签

        const position = quadrantIdToPosition[quadrantId]

        const quadrantLabel = quadrantId === 'unclassified' 

          ? '待分类'

          : dynamicQuadrantsConfig[position]
        
        

        // ✂️ 瘦身优化：统计完成数，只列出未完成

        const completed = tasks.filter(t => t.completed).length

        totalCompleted += completed

        const pending = tasks.filter(t => !t.completed)



        if (pending.length > 0) {

            matrixStats += `\n${quadrantLabel}:\n`

            matrixStats += pending.map(t => `- ${t.title}`).join('\n')

        }

      }

    })



    if (totalCompleted > 0) {

        matrixStats = `✅ 今日已完成：${totalCompleted} 项\n` + matrixStats

    }



    // 尝试找到对应的维度名称（用于显示）

    const matchedDimensionName = Object.values(MATRIX_DIMENSION_CONFIGS).find(

        d => PRESET_MATRIX_CONFIGS[d.id]?.xAxis === axesConfig.xAxis && 

             PRESET_MATRIX_CONFIGS[d.id]?.yAxis === axesConfig.yAxis

    )?.name || `${yDimConfig.name}-${xDimConfig.name}`



    // ✂️ 用户画像瘦身优化

    let profileText = ''

    if (userProfile) {

       const parts = []

       if (user?.username) parts.push(`用户:${user.username}`)

       if (userProfile.challenges?.length) parts.push(`挑战:${userProfile.challenges.join(',')}`)

       if (parts.length > 0) profileText = `[用户简报] ${parts.join(' | ')}\n\n`

    }



    const contextText = `

${profileText}[矩阵上下文] ${dateStr} | 维度：${matchedDimensionName}

X轴：${xDimConfig.name} | Y轴：${yDimConfig.name}

【待办分布】：

${matrixStats || '（无待办）'}

`.trim()

    
    
    // 🔍 调试日志：输出生成的上下文文本（前200字符）

    console.log('📊 生成的矩阵上下文（瘦身版）:', contextText.substring(0, 200) + '...')

    
    
    return contextText

  }, [viewMode, currentContextDate, matrixAxes, tasksByQuadrant, userProfile, user])



  // ⭐ 处理普通对话（非任务管理）

  const handleCasualChat = useCallback(async () => {

    if (!user) return

    
    
    setIsSending(true)

    setStreamingMessage('')

    
    
    try {

      const { casualChat } = await import('@/lib/casualChatService')

      
      
      // 添加用户消息到聊天历史

      const userMessage: ChatMessage = {

        role: 'user',

        content: [{

          type: 'text',

          text: chatMessage.trim()

        }]

      }

      
      
      const newMessages = [...chatMessages, userMessage]

      setChatMessages(newMessages)

      
      
      // 🆕 构建对话历史（过滤掉 interactive 内容，只保留纯文本）

      const conversationHistory = chatMessages

        .slice(-5)

        .map(msg => {

          // 提取纯文本内容

          const textContent = msg.content

            .filter((c: any) => c.type === 'text')

            .map((c: any) => c.text)

            .join('\n')
          
          

          return {

            role: msg.role as 'user' | 'assistant',

            content: textContent

          }

        })

        // 过滤掉内容为空的消息（例如纯 loading 状态的消息）

        .filter(msg => msg.content.trim().length > 0)



      // 🆕 动态获取上下文

      const matrixContext = buildMatrixContextText()

      const noteContext = buildNoteContextText()

      const systemContext = matrixContext || noteContext

      
      
      console.log('🔍 发送对话 (带上下文):', {

        mode: viewMode,

        contextType: matrixContext ? 'matrix' : (noteContext ? 'note' : 'none'),

        historyLength: conversationHistory.length

      })

      
      
      // 流式接收 AI 回复

      let fullResponse = ''

      for await (const chunk of casualChat(

        chatMessage.trim(), 

        conversationHistory,

        systemContext ? { systemContext } : {}

      )) {

        fullResponse += chunk

        setStreamingMessage(prev => prev + chunk)

      }

      
      
      // 完成后添加到聊天历史

      const aiMessage: ChatMessage = {

        role: 'assistant',

        content: [{

          type: 'text',

          text: fullResponse

        }]

      }

      
      
      setStreamingMessage('')

      setChatMessages([...newMessages, aiMessage])

      
      
      // 保存到数据库

      const chatDate = formatNoteDate(currentContextDate)

      await saveChatMessage(user.id, chatDate, 'user', userMessage.content, chatDate)

      await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content, chatDate)

      
      
      console.log('✅ 普通对话完成')
      
      

    } catch (error) {

      console.error('❌ 普通对话失败:', error)

      const errorMessage: ChatMessage = {

        role: 'assistant',

        content: [{

          type: 'text',

          text: '抱歉，处理您的消息时出现了问题，请稍后重试。'

        }]

      }

      setChatMessages([...chatMessages, errorMessage])

    } finally {

      setChatMessage('')

      setIsSending(false)

      setStreamingMessage('')

    }

  }, [chatMessage, chatMessages, user, currentContextDate])



  // 处理发送消息

  const handleSendMessage = useCallback(async () => {

    // ⭐ 防止重复发送：使用 ref 立即检查并锁定（必须尽早上锁，避免并发双触发）
    if (isSendingMessageRef.current) {
      console.log('⚠️ 消息正在发送中，忽略重复请求')
      return
    }
    
    // ⭐ 先上锁，避免 Enter + 点击等并发触发在“锁之前”的时间窗里重复进入
    isSendingMessageRef.current = true

    // 无内容：解锁并返回
    if (!chatMessage.trim() && !selectedImage) {
      isSendingMessageRef.current = false
      return
    }

    if (!doubaoService.hasApiKey()) {

      isSendingMessageRef.current = false
      alert('请先在 .env.local 文件中配置 NEXT_PUBLIC_DOUBAO_API_KEY')

      return

    }
    
    //（已在上方提前上锁）



    // ⭐ 反思模式下：记录用户回答并给予简单回应

    if (isReflectionMode && chatMessage.trim()) {

      console.log('💭 反思模式：记录用户回答')

      
      
      // 添加用户消息

      const userMessage: ChatMessage = {

        role: 'user',

        content: [{ type: 'text', text: chatMessage.trim() }]

      }

      setChatMessages(prev => [...prev, userMessage])

      setChatMessage('')

      
      
      // 🆕 问答阶段：输入框已禁用，不应该到达这里

      if (isAnsweringQuestions && decomposingTaskTitle && !currentReflectionRound) {

        console.log('⚠️ 问答阶段不应该使用底部输入框')

        isSendingMessageRef.current = false  // 解锁
        return

      }

      
      
      // 常规反思轮次：记录到已问问题的上下文中

      if (currentReflectionRound) {

        setAskedQuestions(prev => [...prev, `用户回答: ${chatMessage.trim()}`])

        
        
        // 给予简单的回应

        const responseMessage: ChatMessage = {

          role: 'assistant',

          content: [{ type: 'text', text: '好的，我记下了 👍 你可以继续回答其他问题，或者点击"下一步"进入下一轮反思～' }]

        }

        setChatMessages(prev => [...prev, responseMessage])

        
        
        isSendingMessageRef.current = false  // 解锁
        return

      }

    }



    // 🆕 矩阵模式下：强制使用普通对话模式（不使用 Agent）

    if (viewMode === 'matrix') {

      console.log('📊 矩阵模式：使用普通对话模式')

      await handleCasualChat()

      isSendingMessageRef.current = false  // 解锁
      return

    }



    // ⭐ 第一步：意图分类（仅对文本消息，且仅在编辑器模式下）

    if (chatMessage.trim() && !selectedImage) {

      try {

        const { classifyIntent } = await import('@/lib/intentClassifier')

        const intent = await classifyIntent(chatMessage.trim())

        
        
        console.log('🎯 意图分类结果:', intent)

        
        
        // 如果是普通聊天，直接调用简单对话服务

        if (intent.type === 'casual_chat') {

          console.log('💬 检测到普通聊天，使用简单对话模式')

          await handleCasualChat()

          isSendingMessageRef.current = false  // 解锁
          return

        }

        
        
        // 如果是任务管理，继续使用 Agent 或普通模式

        console.log('📋 检测到任务管理意图，使用 Agent/普通模式')

      } catch (error) {

        console.error('⚠️ 意图分类失败，使用默认流程:', error)

        // 分类失败，继续使用默认流程

      }

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

        // Agent 模式清理（注意：chatMessage 已在 handleAgentMessage 中清空）

        setSelectedImage(null)

        setIsSending(false)

        setStreamingMessage('')

        isSendingMessageRef.current = false  // 解锁
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
      
      // ⭐ 解锁，允许下次发送
      isSendingMessageRef.current = false

    }

  }, [chatMessage, selectedImage, chatMessages, user, selectedDate, agentInstance, isAgentRunning, decomposingTaskTitle, handleTaskDecomposition, viewMode, handleCasualChat, isReflectionMode, currentReflectionRound])



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

        
        
        // ⭐ 清空反思相关状态

        setReflectionSessionId(null)

        setIsReflectionMode(false)

        setCurrentReflectionRound(null)

        setReflectionScanResult(null)

        setReflectionTasks([])

        setAskedQuestions([])

        
        
        // ⭐ 清空拆解相关状态

        setIsDecompositionPhase(false)

        setDecomposableTasks([])

        setDecompositionQueue([])

        setDecomposingTaskTitle(null)

        setTaskContextInput('')

        
        
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



  // 🆕 刷新聊天中的任务列表卡片（事件驱动更新）

  const refreshTaskListInChat = useCallback(async () => {

    if (!user || !lastTaskQueryFilters) {

      logger.debug('⏭️ 跳过刷新：用户未登录或无查询条件')

      return

    }

    
    
    // 检查是否有任务列表卡片

    const hasTaskList = chatMessages.some(msg => 

      msg.content.some((c: any) => c.type === 'task-list')

    )

    
    
    if (!hasTaskList) {

      logger.debug('⏭️ 跳过刷新：聊天中没有任务列表卡片')

      return

    }

    
    
    try {

      setIsRefreshingTaskList(true)

      logger.debug('🔄 开始刷新任务列表...')

      
      
      // 调用 GetTasksTool 获取最新任务

      const getTasksTool = new GetTasksTool()

      
      
      // 组合完整的查询参数（合并 userId 和保存的查询条件）

      const fullParams = {

        ...lastTaskQueryFilters,

        userId: user.id

      }

      
      
      const result = await getTasksTool.execute(fullParams)

      
      
      if (result.type === 'success' && result.data?.tasks) {

        const latestTasks = result.data.tasks

        const totalCount = result.data.count

        
        
        logger.debug('✅ 获取到最新任务:', { count: totalCount })

        
        
        // 更新 chatMessages 中的任务列表卡片

        setChatMessages(prev => {

          return prev.map(msg => {

            const updatedContent = msg.content.map((content: any) => {

              if (content.type === 'task-list' && content.taskList) {

                return {

                  ...content,

                  taskList: {

                    tasks: latestTasks,

                    totalCount: totalCount,

                    showAll: content.taskList.showAll // 保持展开/折叠状态

                  }

                }

              }

              return content

            })

            
            
            return { ...msg, content: updatedContent }

          })

        })

        
        
        logger.success('✅ 任务列表卡片已刷新')

      } else {

        logger.warn('⚠️ 刷新失败：未获取到任务数据')

      }

    } catch (error) {

      logger.error('❌ 刷新任务列表失败:', error)

    } finally {

      setIsRefreshingTaskList(false)

    }

  }, [user, lastTaskQueryFilters, chatMessages])



  // 🆕 处理从任务列表卡片触发的任务完成状态切换

  const handleTaskToggleFromList = useCallback(async (taskId: string, noteId: string, newCompletedState: boolean) => {

    if (!user) return

    
    
    // 🚀 乐观更新：立即更新UI

    setChatMessages(prevMessages => {

      return prevMessages.map(msg => {

        const updatedContent = msg.content.map((content: any) => {

          if (content.type === 'task-list' && content.taskList) {

            const updatedTasks = content.taskList.tasks.map((task: any) => {

              if (task.id === taskId && task.noteId === noteId) {

                return { ...task, isCompleted: newCompletedState }

              }

              return task

            })

            
            
            return {

              ...content,

              taskList: {

                ...content.taskList,

                tasks: updatedTasks

              }

            }

          }

          return content

        })

        
        
        return { ...msg, content: updatedContent }

      })

    })

    logger.debug('🚀 乐观更新：UI已立即刷新')

    
    
    // 后台异步更新数据库

    try {

      logger.debug('🔄 从任务列表切换任务状态:', { taskId, noteId, newCompletedState })

      
      
      // 1. 提取任务索引 (taskId 格式: noteId-task-index)

      const taskIndexMatch = taskId.match(/-task-(\d+)$/)

      if (!taskIndexMatch) {

        logger.error('❌ 无效的 taskId 格式:', taskId)

        return

      }

      const taskIndex = parseInt(taskIndexMatch[1])

      
      
      // 2. 从 notesCache 中查找笔记（noteId 是笔记的 UUID）

      let note: Note | null = null

      for (const [dateKey, cachedNote] of notesCache) {

        if (cachedNote.id === noteId) {

          note = cachedNote

          break

        }

      }

      
      
      // 如果缓存中没有，尝试从数据库加载（通过遍历最近的笔记）

      if (!note) {

        logger.debug('⚠️ 缓存中未找到笔记，尝试从数据库加载...')

        const { getNotesByDateRange } = await import('@/lib/notes')

        const startDate = new Date()

        startDate.setMonth(startDate.getMonth() - 1) // 查询最近一个月

        const endDate = new Date()

        endDate.setMonth(endDate.getMonth() + 1) // 查询未来一个月

        
        
        const recentNotes = await getNotesByDateRange(user.id, startDate, endDate)

        note = recentNotes.find(n => n.id === noteId) || null

      }

      
      
      if (!note || !note.content) {

        logger.error('❌ 未找到笔记:', noteId)

        return

      }

      
      
      // 3. ⭐ 修复：遍历笔记内容，找到并更新对应任务项的 checked 状态

      let currentTaskIndex = 0

      let taskFound = false

      
      
      const updateTaskInContent = (node: any): any => {

        // 如果已经找到并更新了任务，直接返回原节点（避免继续递增索引）

        if (taskFound) {

          return node

        }

        
        
        if (node.type === 'taskItem') {

          if (currentTaskIndex === taskIndex) {

            // 找到目标任务，更新 checked 状态

            taskFound = true

            const updatedNode = {

              ...node,

              attrs: {

                ...node.attrs,

                checked: newCompletedState

              }

            }

            logger.debug(`✅ 找到并更新任务 #${taskIndex}:`, node.content?.[0]?.content?.[0]?.text || '(无标题)')

            return updatedNode

          }

          currentTaskIndex++

        }

        
        
        // 递归处理子节点

        if (node.content && Array.isArray(node.content)) {

          return {

            ...node,

            content: node.content.map((child: any) => updateTaskInContent(child))

          }

        }

        
        
        return node

      }

      
      
      const updatedContent = updateTaskInContent(note.content)

      
      
      if (!taskFound) {

        logger.error('❌ 未找到任务索引:', taskIndex)

        return

      }

      
      
      // 4. 保存更新后的笔记

      const noteDate = new Date(note.note_date)

      await saveNote(user.id, noteDate, updatedContent)

      logger.success('✅ 笔记已更新')

      
      
      // 5. 同步到 daily_tasks 表

      const dateKey = formatNoteDate(noteDate)

      await syncTasksFromNote(user.id, dateKey, updatedContent)

      logger.success('✅ 任务已同步到数据库')

      
      
      // 6. 如果修改的是当前选中日期的笔记，更新编辑器显示

      const selectedDateStr = formatNoteDate(selectedDate)

      const noteDateStr = formatNoteDate(noteDate)

      logger.debug('📅 日期比较:', { selectedDateStr, noteDateStr, match: selectedDateStr === noteDateStr })

      
      
      if (selectedDateStr === noteDateStr) {

        // 使用深拷贝确保 React 检测到状态变化

        const newContent = JSON.parse(JSON.stringify(updatedContent))

        // 🔧 直接通过编辑器实例更新内容（绕过 isInitializedRef 限制）
        if (editorRef.current) {
          // ⚠️ 输入法(IME)拼字期间不要 setContent，否则可能造成重复/乱码
          if (!editorRef.current.view?.composing) {
            editorRef.current.commands.setContent(newContent)
          }
        }
        setCurrentNote(newContent)

        logger.debug('✅ 编辑器内容已刷新')

      } else {

        logger.debug('⏭️ 跳过编辑器刷新：日期不匹配')

      }

      
      
      // 7. 刷新矩阵视图（如果在矩阵模式）

      if (viewMode === 'matrix') {

        await loadTaskMatrix(user.id, selectedDate)

      }

      
      
      logger.success('✅ 任务状态已同步到数据库')

      
      
      // ⚠️ 不要调用 refreshTaskListInChat()！

      // 因为刷新会重新查询任务，而查询默认排除已完成任务，

      // 这会导致刚勾选完成的任务从列表中消失。

      // 乐观更新已经在前面处理了 UI 显示（任务显示为划掉状态）。
      
      

    } catch (error) {

      logger.error('❌ 切换任务状态失败:', error)

      // 如果后台更新失败，回滚UI（重新加载消息）

      alert('操作失败，请重试')

      // TODO: 可以实现更优雅的错误回滚机制

    }

  }, [user, selectedDate, viewMode, notesCache, refreshTaskListInChat])



  // 🆕 处理任务移动到今天

  const handleMoveTaskToToday = useCallback(async (taskId: string, noteId: string, noteDate: string) => {

    if (!user) return



    logger.debug('🚀 开始移动任务到今天:', { taskId, noteId, noteDate })



    // 🚀 乐观更新：立即从任务列表卡片中移除该任务

    setChatMessages(prevMessages => {

      return prevMessages.map(msg => {

        const updatedContent = msg.content.map((content: any) => {

          if (content.type === 'task-list' && content.taskList) {

            const updatedTasks = content.taskList.tasks.filter((task: any) => 

              !(task.id === taskId && task.noteId === noteId)

            )



            return {

              ...content,

              taskList: {

                ...content.taskList,

                tasks: updatedTasks,

                totalCount: updatedTasks.length

              }

            }

          }

          return content

        })



        return { ...msg, content: updatedContent }

      })

    })

    logger.debug('🚀 乐观更新：任务已从UI中移除')



    // 后台异步处理

    try {

      // 1. 提取任务索引 (taskId 格式: noteId-task-index)

      const taskIndexMatch = taskId.match(/-task-(\d+)$/)

      if (!taskIndexMatch) {

        logger.error('❌ 无效的 taskId 格式:', taskId)

        alert('任务ID格式错误')

        return

      }

      const taskIndex = parseInt(taskIndexMatch[1])



      // 2. 从缓存或数据库中加载原笔记

      let originalNote: Note | null = null

      for (const [dateKey, cachedNote] of notesCache) {

        if (cachedNote.id === noteId) {

          originalNote = cachedNote

          break

        }

      }



      if (!originalNote) {

        logger.debug('⚠️ 缓存中未找到原笔记，尝试从数据库加载...')

        const originalDate = new Date(noteDate)

        originalNote = await getNoteByDate(user.id, originalDate)

      }



      if (!originalNote || !originalNote.content) {

        logger.error('❌ 未找到原笔记:', noteId)

        alert('未找到原任务所在的笔记')

        return

      }



      // 3. 从原笔记中提取目标任务的信息

      let currentTaskIndex = 0

      let targetTask: any = null



      const findTask = (node: any): any => {

        if (node.type === 'taskItem') {

          if (currentTaskIndex === taskIndex) {

            targetTask = node

            return true

          }

          currentTaskIndex++

        }



        if (node.content && Array.isArray(node.content)) {

          for (const child of node.content) {

            if (findTask(child)) return true

          }

        }



        return false

      }



      findTask(originalNote.content)



      if (!targetTask) {

        logger.error('❌ 未找到目标任务:', taskIndex)

        alert('未找到目标任务')

        return

      }



      logger.debug('✅ 找到目标任务:', targetTask)



      // 4. 加载今天的笔记

      const today = new Date()

      let todayNote = await getNoteByDate(user.id, today)



      // 如果今天的笔记不存在，创建一个空笔记结构

      if (!todayNote || !todayNote.content) {

        logger.debug('⚠️ 今天的笔记不存在，创建新笔记')

        todayNote = {

          id: '',

          user_id: user.id,

          note_date: formatNoteDate(today),

          content: {

            type: 'doc',

            content: [

              {

                type: 'taskList',

                content: []

              }

            ]

          },

          plain_text: '',

          created_at: new Date().toISOString(),

          updated_at: new Date().toISOString(),

          tags: [],

          has_pending_tasks: true,

          pending_tasks_count: 0,

          completed_tasks_count: 0

        }

      }



      // 5. 将任务添加到今天的笔记中

      if (!todayNote || !todayNote.content) {

        logger.error('❌ 无法创建今天的笔记')

        alert('无法创建今天的笔记')

        return

      }

      
      
      const todayContent = todayNote.content as JSONContent



      // 查找或创建 taskList 节点

      let taskListNode = todayContent.content?.find((node: any) => node.type === 'taskList')

      
      
      if (!taskListNode) {

        // 如果没有 taskList，创建一个

        taskListNode = {

          type: 'taskList',

          content: []

        }

        if (!todayContent.content) {

          todayContent.content = []

        }

        todayContent.content.push(taskListNode)

      }



      // 将目标任务添加到今天的 taskList 末尾

      if (!taskListNode.content) {

        taskListNode.content = []

      }

      taskListNode.content.push({ ...targetTask })



      logger.debug('✅ 任务已添加到今天的笔记')



      // 6. 保存今天的笔记

      await saveNote(user.id, today, todayContent)

      logger.success('✅ 今天的笔记已保存')



      // 7. 从原笔记中删除任务

      currentTaskIndex = 0

      let taskRemoved = false



      const removeTask = (node: any): any => {

        if (taskRemoved) return node



        if (node.type === 'taskList' && node.content && Array.isArray(node.content)) {

          const newContent = node.content.filter((child: any) => {

            if (child.type === 'taskItem') {

              if (currentTaskIndex === taskIndex) {

                taskRemoved = true

                logger.debug(`✅ 从原笔记中删除任务 #${taskIndex}`)

                return false // 删除此任务

              }

              currentTaskIndex++

            }

            return true

          })



          return { ...node, content: newContent }

        }



        if (node.content && Array.isArray(node.content)) {

          return {

            ...node,

            content: node.content.map((child: any) => removeTask(child))

          }

        }



        return node

      }



      const updatedOriginalContent = removeTask(originalNote.content)



      // 8. 检查原笔记中的任务列表是否为空，如果为空则删除整个笔记

      const hasAnyContent = (content: JSONContent): boolean => {

        if (!content.content || content.content.length === 0) return false



        // 检查是否有非空的 taskList 或非空的 paragraph

        return content.content.some((node: any) => {

          if (node.type === 'taskList') {

            return node.content && node.content.length > 0

          }

          if (node.type === 'paragraph') {

            return node.content && node.content.length > 0

          }

          return false

        })

      }



      if (!hasAnyContent(updatedOriginalContent)) {

        logger.debug('🗑️ 原笔记为空，删除笔记')

        await deleteNote(user.id, new Date(noteDate))

        notesCache.delete(noteDate)

      } else {

        // 保存更新后的原笔记

        await saveNote(user.id, new Date(noteDate), updatedOriginalContent)

        // ⭐ 更新缓存中的笔记

        const cachedNote = Array.from(notesCache.values()).find(note => note.id === noteId)

        if (cachedNote) {

          cachedNote.content = updatedOriginalContent

          notesCache.set(noteDate, cachedNote)

          logger.debug('✅ 缓存中的笔记已更新')

        }

        logger.success('✅ 原笔记已更新')

      }



      // 9. 同步到 daily_tasks 表

      await syncTasksFromNote(user.id, formatNoteDate(today), todayContent)

      await syncTasksFromNote(user.id, noteDate, hasAnyContent(updatedOriginalContent) ? updatedOriginalContent : { type: 'doc', content: [] })

      logger.success('✅ 任务已同步到数据库')



      // 10. 刷新UI

      // 更新缓存

      setLastLoadedRange(null)

      await loadNotesInRange(user.id, 'month', selectedDate, true)



      // 如果当前选中的是今天或原日期，刷新编辑器

      const todayStr = formatNoteDate(today)

      const selectedDateStr = formatNoteDate(selectedDate)

      
      
      if (selectedDateStr === todayStr || selectedDateStr === noteDate) {

        await loadNote(user.id, selectedDate)

      }



      // 如果在矩阵模式，刷新矩阵

      if (viewMode === 'matrix') {

        await loadTaskMatrix(user.id, selectedDate)

      }



      logger.success('✅ 任务移动成功')

      
      
      // 🆕 刷新任务列表卡片

      await refreshTaskListInChat()



    } catch (error) {

      logger.error('❌ 移动任务失败:', error)

      // 如果失败，提示用户（但不回滚UI，因为用户可能已经看到任务消失了）

      alert('移动任务失败，请刷新页面重试')

    }

  }, [user, selectedDate, viewMode, notesCache, loadNotesInRange, loadNote, loadTaskMatrix, refreshTaskListInChat])



  // 处理任务完成状态切换（矩阵模式）- 乐观更新
  const handleTaskComplete = useCallback(async (taskId: string) => {

    if (!user) return
    
    

      console.log('🔄 切换任务完成状态:', taskId)
      
      

    // 1. 收集所有任务（扁平化），判断是否需要同时更新子任务
    let childTaskIds: string[] = []
    let clickedTask: any = null
    let currentCompleted = false
    
    // 从矩阵状态中查找任务信息
    for (const quadrant in tasksByQuadrant) {
      for (const task of tasksByQuadrant[quadrant as QuadrantType]) {
        if (task.id === taskId) {
          clickedTask = task
          currentCompleted = task.completed
        }
      }
    }
    
    // 如果点击的是父任务（depth=0），找出所有子任务
    if (clickedTask && (clickedTask.depth ?? 0) === 0) {
      for (const quadrant in tasksByQuadrant) {
        for (const task of tasksByQuadrant[quadrant as QuadrantType]) {
          if ((task as any).parentTaskId === taskId) {
            childTaskIds.push(task.id)
          }
        }
      }
      if (childTaskIds.length > 0) {
        console.log(`📦 父任务包含 ${childTaskIds.length} 个子任务，将一起更新`)
      }
    }
    
    // 🚀 2. 乐观更新：立即更新UI（不等待数据库）
    const newCompleted = !currentCompleted
    const allTaskIdsToUpdate = [taskId, ...childTaskIds]
      setTasksByQuadrant(prev => {

        const newState = { ...prev }
        
        for (const quadrant in newState) {

          const tasks = newState[quadrant as QuadrantType]

          if (tasks) {

          for (let i = 0; i < tasks.length; i++) {
            if (allTaskIdsToUpdate.includes(tasks[i].id)) {
              tasks[i] = { ...tasks[i], completed: newCompleted }
            }
          }
        }
      }
        return newState

      })

    console.log('✅ 矩阵UI已即时更新')
    
    // 3. 后台异步更新数据库（不阻塞UI）
    try {
      const updatedTask = await toggleDailyTaskComplete(taskId)
      console.log('✅ 父任务数据库已更新:', updatedTask)
      
      // 如果是父任务且有子任务，同步更新子任务状态
      if (childTaskIds.length > 0) {
        console.log(`🔄 同步更新 ${childTaskIds.length} 个子任务状态为: ${newCompleted}`)
        Promise.all(
          childTaskIds.map(async (childId) => {
            const { updateDailyTaskComplete } = await import('@/lib/dailyTasks')
            await updateDailyTaskComplete(childId, newCompleted)
          })
        ).then(() => {
          console.log('✅ 所有子任务数据库已更新')
        })
      }
      
      // 4. 后台同步更新笔记内容
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

          let newContent = note.content
          
          // 更新父任务
          newContent = updateTaskInNote(
            newContent,
            updatedTask.notePosition,

            { checked: updatedTask.completed }

          )

          
          // 如果有子任务，也需要更新子任务在笔记中的状态
          // 注：这里简化处理，通过重新解析同步来更新
          // 实际上子任务的 notePosition 需要单独获取
          
          
          // 保存到数据库

          await saveNote(user.id, taskNoteDate, newContent)

          console.log('✅ 笔记已保存到数据库')

          
          
          // 如果是当前日期，更新本地编辑器状态

          if (updatedTask.noteDate === formatNoteDate(selectedDate)) {

            console.log('📝 更新本地编辑器状态（因为是当前日期）')

            // 🔧 直接通过编辑器实例更新内容（绕过 isInitializedRef 限制）
            if (editorRef.current) {
              // ⚠️ 输入法(IME)拼字期间不要 setContent，否则可能造成重复/乱码
              if (!editorRef.current.view?.composing) {
                editorRef.current.commands.setContent(newContent)
              }
            }
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

  }, [user, selectedDate, calculateTaskStats, tasksByQuadrant])


  // 处理任务拖拽放置（乐观更新策略）

  const handleTaskDrop = useCallback(async (taskId: string, targetQuadrant: QuadrantType) => {

    if (!user) return

    
    
    console.log('🎯 拖拽任务:', { taskId, targetQuadrant })

    
    
    // 保存旧状态（用于回滚）

    let previousState: TasksByQuadrant | null = null

    // 需要移动的所有任务ID（包括子任务）
    let taskIdsToMove: string[] = []
    
    
    try {

      // 【乐观更新】立即更新本地状态，不等待 API

      setTasksByQuadrant(prev => {

        previousState = prev // 保存旧状态
        
        

        // 1. 收集所有任务（扁平化）
        const allTasks: any[] = []
        for (const quadrant in prev) {
          allTasks.push(...prev[quadrant as QuadrantType])
        }
        
        // 2. 找到被拖拽的任务
        const draggedTask = allTasks.find(t => t.id === taskId)
        if (!draggedTask) {
          console.warn('⚠️ 找不到被拖拽的任务')
          return prev
        }
        
        // 3. 判断是否是父任务（depth=0），如果是则找出所有子任务
        const isParentTask = (draggedTask.depth ?? 0) === 0
        const childTasks = isParentTask 
          ? allTasks.filter(t => t.parentTaskId === taskId)
          : []
        
        // 4. 收集需要移动的任务（父任务+子任务，或仅子任务本身）
        const tasksToMove = [draggedTask, ...childTasks]
        taskIdsToMove = tasksToMove.map(t => t.id)
        
        console.log(`📦 移动任务: ${draggedTask.title}${childTasks.length > 0 ? ` (包含 ${childTasks.length} 个子任务)` : ''}`)
        
        // 5. 构建新状态
        const newState: TasksByQuadrant = {

          'unclassified': [],

          'urgent-important': [],

          'not-urgent-important': [],

          'urgent-not-important': [],

          'not-urgent-not-important': [],

        }
        
        

        // 6. 遍历所有任务，分配到正确的象限
        for (const quadrant in prev) {

          for (const task of prev[quadrant as QuadrantType]) {

            if (taskIdsToMove.includes(task.id)) {
              // 需要移动的任务 → 目标象限
              newState[targetQuadrant].push(task)
            } else {

              // 其他任务保持原位

                newState[quadrant as QuadrantType].push(task)

              }

        }
        
        }

        
        
        return newState

      })

      

      // 【后台更新】异步更新数据库（所有需要移动的任务）
      console.log(`🔄 更新数据库: ${taskIdsToMove.length} 个任务`)
      await Promise.all(
        taskIdsToMove.map(id => updateTaskQuadrant(id, targetQuadrant))
      )
      
      
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



      // 📌 检查是否有完整的任务节点（包含上下文信息和子任务）

      const taskWithNode = task as any  // 类型断言，因为 rawNode 是动态添加的

      

      if (taskWithNode.rawNode) {

        // ✅ 使用完整的任务节点（保留上下文信息和子任务）

        console.log('📦 使用完整任务节点添加（包含上下文和子任务）')

        console.log('📦 rawNode 内容:', JSON.stringify(taskWithNode.rawNode, null, 2))

        console.log('📦 rawNode 子节点类型:', taskWithNode.rawNode.content?.map((c: any) => c.type))

        await appendTaskNodeToNote(user.id, today, taskWithNode.rawNode)

        console.log('✅ 完整任务已添加到笔记:', task.title)

      } else {

        // 降级：使用简单的标题添加（兼容旧数据）

        console.log('📝 使用简单标题添加（无完整节点）')

        

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

      }



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

              <h1 className="text-xl font-bold text-gray-900">📝 TaskFlow</h1>
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

              {/* 开启今日回顾按钮 */}
              <button
                onClick={async () => {
                  // 如果侧边栏未打开，先打开但不触发任务规划
                  if (!isChatSidebarOpen) {
                    setIsChatSidebarOpen(true)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('chatSidebarOpen', JSON.stringify(true))
                    }
                    // 等待状态更新
                    await new Promise(resolve => setTimeout(resolve, 100))
                  }
                  // 调用每日回顾函数（而不是任务规划）
                  startDailyReflection()
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm"
                title="开启今日回顾"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>开启今日回顾</span>
              </button>
              
              {/* 历史回顾按钮 - 已隐藏 */}
              {false && (
              <button
                onClick={async () => {
                  // 如果侧边栏未打开，先打开
                  if (!isChatSidebarOpen) {
                    setIsChatSidebarOpen(true)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('chatSidebarOpen', JSON.stringify(true))
                    }
                    await new Promise(resolve => setTimeout(resolve, 100))
                  }
                  // 调用查看历史回顾函数
                  viewReflectionHistory()
                }}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
                title="查看历史回顾"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>历史回顾</span>
              </button>
              )}
              
              {/* 🧪 测试按钮（仅开发环境） */}
              {process.env.NODE_ENV === 'development' && (
                <>
                  {/* 清空每日回顾 */}
                  <button
                    onClick={async () => {
                      if (!user) return
                      
                      const confirm = window.confirm('确定要清空今天的回顾记录和相关消息吗？')
                      if (!confirm) return
                      
                      try {
                        // 1. 先重置状态（不管数据库操作是否成功）
                        setIsDailyReflectionMode(false)
                        setCurrentReflectionId(null)
                        setDailyReflectionQuestions(null)
                        setDailyReflectionAnswers([null, null, null])
                        setCurrentDailyQuestionIndex(0)
                        
                        // 2. 清空相关消息
                        setChatMessages(prev => 
                          prev.filter(msg => 
                            !msg.content?.some((c: MessageContent) => 
                              c.type === 'interactive' && 
                              (c.interactive?.type === 'daily-reflection-question' ||
                               c.interactive?.type === 'daily-reflection-complete' ||
                               c.interactive?.type === 'daily-reflection-already-done' ||
                               c.interactive?.type === 'daily-reflection-resume')
                            ) &&
                            !msg.content?.some((c: MessageContent) => 
                              c.type === 'text' && 
                              (c.text?.includes('让我们一起回顾今天的任务吧') ||
                               c.text?.includes('正在生成你的反思总结'))
                            )
                          )
                        )
                        
                        // 3. 尝试删除数据库记录（可能失败，不阻止流程）
                        try {
                          const today = new Date().toISOString().split('T')[0]
                          const { getTodayReflection, deleteReflection } = await import('@/lib/dailyReflections')
                          const reflection = await getTodayReflection(user.id, today)
                          
                          if (reflection) {
                            await deleteReflection(reflection.id)
                            console.log('✅ 已清空今日数据库回顾记录')
                          } else {
                            console.log('⚠️ 今天数据库中没有回顾记录')
                          }
                        } catch (dbError: any) {
                          console.warn('⚠️ 数据库清空失败（但状态已重置）:', dbError.message)
                        }
                        
                        alert('✅ 每日回顾已重置')
                        
                      } catch (error: any) {
                        console.error('❌ 清空反思失败:', error)
                        alert(`❌ 清空失败: ${error.message}`)
                      }
                    }}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm"
                    title="清空今日回顾（测试用）"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>清空每日回顾</span>
                  </button>
                  
                  {/* 清空任务规划会话 */}
                  <button
                    onClick={async () => {
                      if (!user || !selectedDate) return
                      
                      const confirm = window.confirm('确定要清空任务规划会话吗？这将清空今天的所有规划记录。')
                      if (!confirm) return
                      
                      try {
                        const noteDate = format(selectedDate, 'yyyy-MM-dd')
                        const { createClient } = await import('@/lib/supabase-client')
                        const supabase = createClient()
                        const now = new Date().toISOString()
                        
                        // 1. 查找该日期的所有快照（只查未删除的）
                        const { data: snapshots } = await supabase
                          .from('plan_snapshots')
                          .select('id')
                          .eq('user_id', user.id)
                          .eq('note_date', noteDate)
                          .is('deleted_at', null)
                        
                        if (snapshots && snapshots.length > 0) {
                          const snapshotIds = snapshots.map((s: any) => s.id)
                          
                          // 2. ✅ 软删除所有相关的反思会话
                          const { error: softDeleteSessionError } = await supabase
                            .from('reflection_sessions')
                            .update({ deleted_at: now })
                            .eq('user_id', user.id)
                            .in('plan_snapshot_id', snapshotIds)
                            .is('deleted_at', null)
                          
                          if (softDeleteSessionError) {
                            console.error('❌ 软删除反思会话失败:', softDeleteSessionError)
                          } else {
                            console.log('✅ 已软删除今天的回顾会话（数据保留在数据库）')
                          }
                          
                          // 3. ✅ 软删除快照
                          const { error: softDeleteSnapshotError } = await supabase
                            .from('plan_snapshots')
                            .update({ deleted_at: now })
                            .eq('user_id', user.id)
                            .eq('note_date', noteDate)
                            .is('deleted_at', null)
                          
                          if (softDeleteSnapshotError) {
                            console.error('❌ 软删除计划快照失败:', softDeleteSnapshotError)
                          } else {
                            console.log('✅ 已软删除今天的计划快照（数据保留在数据库）')
                          }
                        }
                        
                        // 4. 重置本地状态
                        setReflectionSessionId(null)
                        setIsReflectionMode(false)
                        setCurrentReflectionRound(null)
                        setReflectionScanResult(null)
                        setReflectionTasks([])
                        setAskedQuestions([])
                        setIsDecompositionPhase(false)
                        setDecomposableTasks([])
                        setDecompositionQueue([])
                        
                        // 5. 清空聊天消息（也会软删除）
                        setChatMessages([])
                        
                        alert('✅ 已清空任务规划，你可以重新开始了')
                      } catch (error: any) {
                        console.error('❌ 清空任务规划会话失败:', error)
                        alert(`❌ 清空失败: ${error.message}`)
                      }
                    }}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 text-sm"
                    title="清空任务规划会话（测试用）"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>清空任务规划</span>
                  </button>
                </>
              )}
              
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

      <main className="pt-20 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* flex布局容器：在主内容区域内部分左右 */}

          <div className="flex gap-6 h-[calc(100vh-6.5rem)]">
            {/* 左侧：笔记管理区域 - 使用 overflow-hidden 和 min-h-0 确保子元素滚动条生效 */}
            <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out relative overflow-hidden min-h-0">
              
              
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



              {/* 笔记编辑器 / 任务矩阵 切换区域（占满剩余空间）- h-0 flex-1 确保高度正确计算 */}
              <div className="h-0 flex-1 flex flex-col min-h-0 mt-4 relative overflow-hidden">
                {viewMode === 'editor' ? (

                  /* 笔记编辑器模式 */

                  <div 

                    className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-fadeIn relative"

                    style={{

                      animation: 'fadeIn 0.3s ease-in-out'

                    }}

                  >

                {/* 🆕 加载状态：切换日期时显示加载占位符 */}
                {isLoadingNote ? (
                  <div className="flex-1 flex items-center justify-center bg-white">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm text-gray-500">加载笔记中...</span>
                    </div>
                  </div>
                ) : (
                <NoteEditor

                    key={formatNoteDate(selectedDate)}  // 🔧 切换日期时重新创建编辑器实例
                  initialContent={currentNote ?? undefined}

                  onUpdate={handleNoteUpdate}

                  onSave={handleNoteSave}

                  onDecompose={handleDecomposeFromNoteEditor}

                  placeholder="开始记录... (按 ? 查看快捷键)"

                    editorRef={editorRef}
                />

                )}
                    
                    
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

                        className="absolute right-6 bottom-16 z-40 w-20 h-20 hover:scale-110 transition-all duration-300 flex items-center justify-center group animate-float"

                        title="展开AI助手 (Ctrl+B)"

                      >

                        <img src="/ai-avatar-nobg.svg" alt="AI助手" className="w-20 h-20 drop-shadow-lg" />

                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">

                          AI助手

                        </span>

                      </button>

                    )}
                    
                    

                  </div>

                ) : (

                  /* 任务矩阵模式 - 使用 h-full overflow-hidden 确保滚动条生效 */
                  <div 

                    className="flex-1 h-full min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-fadeIn relative"
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

                      collapsedTasks={matrixCollapsedTasks}
                      onToggleCollapse={handleToggleMatrixCollapse}
                    />

                    
                    
                    {/* 浮动AI助手按钮 - 矩阵右下角 */}

                    {!isChatSidebarOpen && (

                      <button

                        onClick={toggleChatSidebar}

                        className="absolute right-6 bottom-6 z-40 w-20 h-20 hover:scale-110 transition-all duration-300 flex items-center justify-center group animate-float"

                        title="展开AI助手 (Ctrl+B)"

                      >

                        <img src="/ai-avatar-nobg.svg" alt="AI助手" className="w-20 h-20 drop-shadow-lg" />

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

              viewMode={viewMode}

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

              onButtonClick={handleDecomposeSuggestionButton}

              onDecompositionContextSubmit={handleDecompositionContextSubmit}

              onDecompositionContextSkip={handleDecompositionContextSkip}

              onDecompositionConfirm={handleDecompositionConfirm}

              onDecompositionCancel={handleDecompositionCancel}

              onTaskToggleFromList={handleTaskToggleFromList}

              onMoveTaskToToday={handleMoveTaskToToday}

              isRefreshingTaskList={isRefreshingTaskList}

              reflectionSessionId={reflectionSessionId}

              isReflectionMode={isReflectionMode}

              currentReflectionRound={currentReflectionRound}

              onSkipReflectionRound={handleNextStep}

              onMoreQuestions={requestMoreQuestions}

              onEndReflection={endReflection}

              isGeneratingQuestions={isGeneratingQuestions}

              isDecompositionPhase={isDecompositionPhase}

              decomposableTasks={decomposableTasks}

              onDecomposeTaskSelect={handleDecomposeTaskSelect}

              onSkipDecomposition={handleSkipDecomposition}

              onContinueDecompose={handleContinueDecompose}

              onSkipContinueDecompose={handleSkipContinueDecompose}

              // ⭐ 优先级矩阵建议 props
              onSwitchToMatrix={handleSwitchToMatrix}
              onSkipMatrixSwitch={handleSkipMatrixSwitch}
              // ⭐ 底部快捷反思按钮 props
              currentReflectionType={currentReflectionType}
              onReflectionQuickStart={handleReflectionQuickStart}
              isDailyReflectionMode={isDailyReflectionMode}
              isReflectionLoading={isReflectionLoading}
              loadingReflectionType={loadingReflectionType}
              // ⭐ 反思流程优化 props

              onOverviewButtonClick={handleOverviewButtonClick}

              onRoundCompleteButtonClick={handleRoundCompleteButtonClick}

              onTaskSelectionConfirm={handleTaskSelectionConfirm}

              onTaskSelectionBack={handleTaskSelectionBack}

              completedRounds={completedRounds}

              availableTasksForSelection={reflectionTasks}

              pendingRound={pendingRound}

              isAnsweringQuestions={isAnsweringQuestions}

              currentQuestionIndex={currentQuestionIndex}

              totalQuestionsCount={totalQuestions.length}

              // ⭐ 任务选择界面：折叠状态
              collapsedTasks={collapsedTasks}
              onToggleTaskCollapse={toggleTaskCollapse}
              // ⭐ 上下文信息回调
              onContextInfoAdded={handleContextInfoAdded}
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

