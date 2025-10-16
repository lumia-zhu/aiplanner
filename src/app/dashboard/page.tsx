'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getUserTasks, createTask, updateTask, deleteTask, toggleTaskComplete, getUserTasksWithSubtasks, createSubtasks, toggleTaskExpansion, promoteSubtasksToTasks } from '@/lib/tasks'
import type { Task, SubtaskSuggestion } from '@/types'
import DraggableTaskItem from '@/components/DraggableTaskItem'
import TaskForm from '@/components/TaskForm'
import OutlookImport from '@/components/OutlookImport'
import ImportSelector from '@/components/ImportSelector'
import GoogleCalendarImport from '@/components/GoogleCalendarImport'
import CanvasImport from '@/components/CanvasImport'
import CalendarView from '@/components/CalendarView'
import ChatSidebar from '@/components/ChatSidebar'
import TaskDecompositionModal from '@/components/TaskDecompositionModal'
import QuickAddTask from '@/components/QuickAddTask'
import EisenhowerMatrix from '@/components/EisenhowerMatrix'
import { taskOperations } from '@/utils/taskUtils'
import { doubaoService, type ChatMessage } from '@/lib/doubaoService'
import { compressImage, fileToBase64, isFileSizeExceeded, formatFileSize } from '@/utils/imageUtils'
import { saveChatMessage, getChatMessages, clearChatMessages } from '@/lib/chatMessages'
import UserProfileModal from '@/components/UserProfileModal'
import { getUserProfile, upsertUserProfile, addCustomTaskTag } from '@/lib/userProfile'
import type { UserProfile, UserProfileInput } from '@/types'
import { useWorkflowAssistant } from '@/hooks/useWorkflowAssistant'

// 任务识别相关类型
interface RecognizedTask {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  deadline_date?: string // 日期，格式：YYYY-MM-DD
  deadline_time?: string // 时间，格式：HH:MM
  isSelected: boolean
}
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [selectedImportPlatform, setSelectedImportPlatform] = useState<'outlook' | 'google' | 'canvas' | null>(null)
  
  // 聊天相关状态
  const [chatMessage, setChatMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false) // 加载对话记录的状态
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  
  // 侧边栏展开/收起状态（从localStorage读取，默认收起）
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSidebarOpen')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  
  // 图片预处理缓存
  const imageCache = useRef<Map<string, string>>(new Map())
  const [isImageProcessing, setIsImageProcessing] = useState(false)
  
  // 任务识别相关状态
  const [isTaskRecognitionMode, setIsTaskRecognitionMode] = useState(false)
  const [recognizedTasks, setRecognizedTasks] = useState<RecognizedTask[]>([])
  const [showTaskPreview, setShowTaskPreview] = useState(false)
  
  // 任务拆解相关状态
  const [showDecompositionModal, setShowDecompositionModal] = useState(false)
  const [decomposingTask, setDecomposingTask] = useState<Task | null>(null)
  
  // 艾森豪威尔矩阵状态
  const [showMatrix, setShowMatrix] = useState(false)
  
  // 用户个人资料状态
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showProfileSaveSuccess, setShowProfileSaveSuccess] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false) // 是否首次登录用户
  
  // 工作流辅助Hook
  const {
    workflowMode,
    aiRecommendation,
    isAnalyzing: isWorkflowAnalyzing,
    startWorkflow,
    selectOption: selectWorkflowOption,
    resetWorkflow
  } = useWorkflowAssistant({
    tasks,
    userProfile,
    setChatMessages
  })
  
  // 动画相关状态
  const [animationOrigin, setAnimationOrigin] = useState<{ x: number; y: number } | null>(null)
  
  // 日历选中日期状态
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const importButtonRef = useRef<HTMLButtonElement>(null)
  const newTaskButtonRef = useRef<HTMLButtonElement>(null)
  
  const router = useRouter()
  // 高级工具开关（默认关闭），用于控制：排列优先级按钮、拆解入口、AI侧边栏展开
  const [advancedToolsEnabled, setAdvancedToolsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('advancedToolsEnabled')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })

  const enableAdvancedTools = useCallback(() => {
    setAdvancedToolsEnabled(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('advancedToolsEnabled', 'true')
    }
    // 同时展开AI侧边栏
    setIsChatSidebarOpen(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatSidebarOpen', 'true')
    }
  }, [])


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 加载某天的对话记录
  const loadChatMessages = useCallback(async (date: Date) => {
    if (!user) return
    
    setIsChatLoading(true)
    console.log('📖 开始加载对话记录...')
    
    try {
      // 格式化日期为 YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const chatDate = `${year}-${month}-${day}`
      
      const result = await getChatMessages(user.id, chatDate)
      
      if (result.success) {
        setChatMessages(result.messages)
        console.log(`✅ 加载了 ${result.messages.length} 条对话记录`)
      } else {
        console.error('❌ 加载对话失败:', result.error)
      }
    } catch (error) {
      console.error('❌ 加载对话异常:', error)
    } finally {
      setIsChatLoading(false)
    }
  }, [user])

  useEffect(() => {
    const currentUser = getUserFromStorage()
    if (!currentUser) {
      router.push('/auth/login')
    } else {
      setUser(currentUser)
      loadTasks(currentUser.id)
      // 加载用户个人资料
      loadUserProfile(currentUser.id)
    }
  }, [router])
  
  // 加载用户个人资料
  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId)
      setUserProfile(profile)
      
      // 如果用户没有个人资料,标记为首次用户并自动打开弹窗
      if (!profile) {
        setIsFirstTimeUser(true)
        setShowProfileModal(true)
      }
    } catch (error) {
      console.error('加载用户个人资料失败:', error)
    }
  }
  
  // 保存用户个人资料
  const handleSaveProfile = async (profileData: UserProfileInput) => {
    if (!user) return
    
    try {
      const result = await upsertUserProfile(user.id, profileData)
      if (result.success && result.data) {
        setUserProfile(result.data)
        console.log('✅ 个人资料保存成功')
        
        // 如果是首次用户,取消首次标记
        if (isFirstTimeUser) {
          setIsFirstTimeUser(false)
        }
        
        // 显示成功通知
        setShowProfileSaveSuccess(true)
        
        // 3秒后自动隐藏通知
        setTimeout(() => {
          setShowProfileSaveSuccess(false)
        }, 3000)
      } else {
        throw new Error(result.error || '保存失败')
      }
    } catch (error) {
      console.error('❌ 保存个人资料失败:', error)
      throw error
    }
  }

  // ⭐ 新增: 添加自定义任务标签到用户标签池
  const handleAddCustomTag = async (tag: string) => {
    if (!user) return
    
    try {
      const result = await addCustomTaskTag(user.id, tag)
      if (result.success && result.tags) {
        // 更新本地用户资料中的标签池
        if (userProfile) {
          setUserProfile({
            ...userProfile,
            custom_task_tags: result.tags
          })
        }
        console.log('✅ 添加自定义标签成功:', tag)
      }
    } catch (error) {
      console.error('添加自定义标签失败:', error)
    }
  }

  // 监听日期变化，自动加载该日期的对话记录
  useEffect(() => {
    if (user) {
      loadChatMessages(selectedDate)
    }
  }, [selectedDate, user, loadChatMessages])

  const loadTasks = async (userId: string) => {
    setIsLoading(true)
    // 使用新的带子任务的API
    const result = await getUserTasksWithSubtasks(userId)
    
    if (result.error) {
      setError(result.error)
      // 降级到旧API
      const fallbackResult = await getUserTasks(userId)
      if (!fallbackResult.error) {
        setTasks(fallbackResult.tasks || [])
        setError('')
      }
    } else {
      setTasks(result.tasks || [])
      setError('')
    }
    setIsLoading(false)
  }

  const handleCreateTask = async (taskData: {
    title: string
    description?: string
    deadline_time?: string
    priority?: 'low' | 'medium' | 'high' // ⭐ 修改: 优先级可选
    tags?: string[] // ⭐ 新增
  }) => {
    if (!user) return
    
    setIsFormLoading(true)
    setError('')
    
    try {
      const result = await createTask(user.id, taskData)
      
      if (result.error) {
        setError(result.error)
      } else if (result.task) {
        // 直接添加新任务到列表，避免重新加载
        setTasks(prevTasks => taskOperations.addTask(prevTasks, result.task!))
        setShowTaskForm(false)
      }
    } catch (error) {
      setError('创建任务时发生错误')
      console.error('创建任务异常:', error)
    }
    
    setIsFormLoading(false)
  }

  const handleUpdateTask = async (taskData: {
    title: string
    description?: string
    deadline_time?: string
    priority?: 'low' | 'medium' | 'high' // ⭐ 修改: 优先级可选
    tags?: string[] // ⭐ 新增
  }) => {
    if (!editingTask) return
    
    setIsFormLoading(true)
    setError('')
    
    try {
      const result = await updateTask(editingTask.id, taskData)
      
      if (result.error) {
        setError(result.error)
      } else if (result.task) {
        // 直接更新任务列表中的对应项，避免重新加载
        setTasks(prevTasks => taskOperations.updateTask(prevTasks, result.task!))
        setEditingTask(null)
      }
    } catch (error) {
      setError('更新任务时发生错误')
      console.error('更新任务异常:', error)
    }
    
    setIsFormLoading(false)
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      // 先从UI中移除，提供即时反馈
      const taskToDelete = tasks.find(task => task.id === taskId)
      setTasks(prevTasks => taskOperations.removeTask(prevTasks, taskId))
      
      const result = await deleteTask(taskId)
      
      if (result.error) {
        // 如果删除失败，恢复任务到列表中
        if (taskToDelete) {
          setTasks(prevTasks => taskOperations.addTask(prevTasks, taskToDelete))
        }
        console.error('删除失败:', result.error)
      }
    } catch (error) {
      console.error('删除任务异常:', error)
    }
  }

  const handleToggleComplete = useCallback(async (taskId: string, completed: boolean) => {
    // 获取需要更新的任务ID列表（包括父任务和所有子任务）
    const getAffectedTaskIds = (tasks: Task[], targetId: string): string[] => {
      const affectedIds: string[] = []
      
      for (const task of tasks) {
        if (task.id === targetId) {
          // 找到目标任务
          affectedIds.push(task.id)
          // 如果是父任务，添加所有子任务ID
          if (task.subtasks && task.subtasks.length > 0) {
            affectedIds.push(...task.subtasks.map(st => st.id))
          }
          break
        }
        
        // 检查是否是某个任务的子任务
        if (task.subtasks && task.subtasks.length > 0) {
          const foundInSubtasks = task.subtasks.find(st => st.id === targetId)
          if (foundInSubtasks) {
            // 目标是子任务，添加子任务ID和父任务ID
            affectedIds.push(targetId)
            affectedIds.push(task.id)
            // 添加其他所有子任务ID（用于检查父任务状态）
            affectedIds.push(...task.subtasks.filter(st => st.id !== targetId).map(st => st.id))
            break
          }
        }
      }
      
      return affectedIds
    }

    // 立即更新UI状态，提供即时反馈
    const affectedIds = getAffectedTaskIds(tasks, taskId)
    const oldTasks = tasks
    setTasks(prevTasks => taskOperations.toggleComplete(prevTasks, taskId, completed))

    try {
      // 更新数据库中的所有受影响任务
      const updatePromises = affectedIds.map(id => {
        // 计算该任务的新完成状态
        const updatedTasks = taskOperations.toggleComplete(oldTasks, taskId, completed)
        const taskToUpdate = updatedTasks.flatMap(t => [t, ...(t.subtasks || [])]).find(t => t.id === id)
        return taskToUpdate ? toggleTaskComplete(id, taskToUpdate.completed) : Promise.resolve({ error: 'Task not found' })
      })
      
      const results = await Promise.all(updatePromises)
      
      // 检查是否有失败
      const hasError = results.some(r => r.error)
      if (hasError) {
        // 如果失败，回滚UI状态
        setTasks(oldTasks)
        console.error('更新任务状态失败')
      }
    } catch (error) {
      // 网络错误或其他异常，回滚UI状态
      setTasks(oldTasks)
      console.error('更新任务异常:', error)
    }
  }, [tasks])

  const handleEditTask = (task: Task, buttonElement?: HTMLElement) => {
    // 计算编辑按钮位置作为动画起点（相对于视口）
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      setAnimationOrigin({
        x: centerX,
        y: centerY
      })
    }
    setEditingTask(task)
  }

  const handleDecomposeTask = (task: Task) => {
    // 打开任务拆解弹窗
    setDecomposingTask(task)
    setShowDecompositionModal(true)
  }

  // 快速添加任务（使用选中的日期）
  const handleQuickAddTask = async (taskData: {
    title: string
    description?: string
    priority: 'high' | 'medium' | 'low'
    deadline_time?: string
  }) => {
    if (!user) return

    try {
      // 将选中日期和时间组合成deadline_datetime
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      
      let deadline_datetime = `${year}-${month}-${day}`
      if (taskData.deadline_time) {
        deadline_datetime += ` ${taskData.deadline_time}:00`
      } else {
        deadline_datetime += ' 23:59:00'
      }

      const result = await createTask(user.id, {
        ...taskData,
        deadline_time: deadline_datetime
      })

      if (result.error) {
        setError(result.error)
        return
      } else if (result.task) {
        // 直接添加新任务到列表
        setTasks(prevTasks => taskOperations.addTask(prevTasks, result.task!))
        // 返回任务ID
        return { id: result.task.id }
      }
    } catch (error) {
      setError('创建任务时发生错误')
      console.error('快速添加任务异常:', error)
    }
  }

  // 批量撤销任务
  const handleBatchUndo = async (taskIds: string[]) => {
    if (!user) return

    try {
      // 批量删除任务
      await Promise.all(taskIds.map(taskId => deleteTask(taskId)))
      
      // 从列表中移除任务
      setTasks(prevTasks => prevTasks.filter(task => !taskIds.includes(task.id)))
    } catch (error) {
      console.error('批量撤销失败:', error)
      throw error
    }
  }

  // 处理子任务确认创建
  const handleSubtasksConfirm = async (selectedSubtasks: SubtaskSuggestion[]) => {
    if (!user || !decomposingTask) {
      setError('用户信息或任务信息缺失')
      return
    }

    console.log('🚀 开始创建子任务流程:', {
      parentTaskId: decomposingTask.id,
      userId: user.id,
      selectedCount: selectedSubtasks.filter(t => t.is_selected).length
    })

    try {
      // 创建子任务
      const result = await createSubtasks(decomposingTask.id, user.id, selectedSubtasks)
      
      if (result.error) {
        console.error('创建子任务API错误:', result.error)
        setError(`创建失败: ${result.error}`)
      } else {
        console.log('✅ 子任务创建成功，局部更新任务列表')
        
        // 🎯 优化：局部更新父任务，添加子任务（无需重新加载整个列表）
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === decomposingTask.id 
              ? { 
                  ...task, 
                  subtasks: result.tasks || [],  // 使用API返回的真实子任务数据
                  is_expanded: true               // 自动展开显示子任务
                }
              : task
          )
        )
        
        // 显示成功消息
        const createdCount = selectedSubtasks.filter(t => t.is_selected).length
        alert(`✅ 成功创建了 ${createdCount} 个子任务！`)
        
        // 关闭弹窗
        setShowDecompositionModal(false)
        setDecomposingTask(null)
      }
    } catch (error) {
      console.error('创建子任务异常:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setError(`创建子任务时发生错误: ${errorMessage}`)
    }
  }

  // 处理任务展开/收起
  const handleToggleExpansion = async (taskId: string, isExpanded: boolean) => {
    try {
      const result = await toggleTaskExpansion(taskId, isExpanded)
      
      if (result.error) {
        setError(result.error)
      } else {
        // 更新本地状态
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, is_expanded: isExpanded }
              : task
          )
        )
      }
    } catch (error) {
      console.error('切换任务展开状态失败:', error)
      setError('切换任务展开状态时发生错误')
    }
  }

  // 处理提升子任务为独立任务
  const handlePromoteSubtasks = async (parentId: string) => {
    if (!user) {
      setError('用户未登录')
      return
    }

    console.log('🚀 开始提升子任务流程:', { parentId, userId: user.id })

    try {
      // 调用后端API
      const result = await promoteSubtasksToTasks(parentId, user.id)
      
      if (result.error) {
        console.error('提升子任务失败:', result.error)
        setError(result.error)
        alert(`❌ ${result.error}`)
      } else {
        console.log('✅ 子任务提升成功，提升了', result.count, '个任务，局部更新任务列表')
        
        // 🎯 优化：局部更新任务列表（无需重新加载整个列表）
        setTasks(prevTasks => {
          // 1. 直接移除父任务（后端已删除父任务）
          const tasksWithoutParent = prevTasks.filter(task => task.id !== parentId)
          
          // 2. 将提升后的任务添加到列表中
          return [...tasksWithoutParent, ...(result.tasks || [])]
        })
        
        // 显示成功消息
        alert(`✅ 成功将 ${result.count} 个子任务提升为独立任务，父任务已删除！`)
      }
    } catch (error) {
      console.error('提升子任务异常:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setError(`提升子任务时发生错误: ${errorMessage}`)
      alert(`❌ 提升失败: ${errorMessage}`)
    }
  }

  // 艾森豪威尔矩阵保存处理
  const handleMatrixSave = async (updatedTasks: { id: string; description: string }[]) => {
    if (!user) return
    
    try {
      console.log('保存矩阵分类，更新任务数量:', updatedTasks.length)
      
      // 批量更新任务
      await Promise.all(
        updatedTasks.map(({ id, description }) =>
          updateTask(id, { description })
        )
      )
      
      // 刷新任务列表
      await loadTasks(user.id)
      
      // 关闭模态框
      setShowMatrix(false)
      
      alert('✅ 任务优先级分类已保存！')
    } catch (error) {
      console.error('保存矩阵分类失败:', error)
      alert('❌ 保存失败，请重试')
    }
  }
  
  // 已移除 handleStuckHelp（对应按钮已删除）

  const handleTasksImported = (importedTasks: Task[]) => {
    // 将导入的任务添加到当前任务列表
    setTasks(prevTasks => [...prevTasks, ...importedTasks])
    setShowImport(false)
  }

  const handleOutlookTasksImported = (count: number) => {
    // Outlook导入完成后重新加载任务列表
    if (user) {
      loadTasks(user.id)
    }
    setShowImport(false)
  }

  // 生成文件缓存key
  const generateCacheKey = (file: File): string => {
    return `${file.name}-${file.size}-${file.lastModified}`
  }

  // 预处理图片（带缓存）
  const preprocessImage = useCallback(async (file: File): Promise<string> => {
    const cacheKey = generateCacheKey(file)
    
    // 检查缓存
    if (imageCache.current.has(cacheKey)) {
      console.log('使用缓存的图片:', file.name)
      return imageCache.current.get(cacheKey)!
    }

    console.log(`开始处理图片: ${file.name}, 大小: ${formatFileSize(file.size)}`)
    
    // 压缩图片
    const compressedFile = await compressImage(file, 800, 800, 0.8)
    console.log(`压缩后图片: ${compressedFile.name}, 大小: ${formatFileSize(compressedFile.size)}`)
    
    // 转换为base64
    const base64 = await fileToBase64(compressedFile)
    
    // 存入缓存（限制缓存大小）
    if (imageCache.current.size >= 10) {
      // 删除最老的缓存项
      const firstKey = imageCache.current.keys().next().value
      if (firstKey) {
        imageCache.current.delete(firstKey)
      }
    }
    imageCache.current.set(cacheKey, base64)
    
    return base64
  }, [])

  // 处理图片选择
  const handleImageSelect = async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      // 检查文件大小
      if (isFileSizeExceeded(file, 10)) { // 限制10MB
        alert(`图片文件过大 (${formatFileSize(file.size)})，请选择小于10MB的图片`)
        return
      }

      try {
        setIsImageProcessing(true)
        
        // 预处理图片（包含缓存）
        await preprocessImage(file)
        setSelectedImage(file)
        
        console.log('图片选择完成')
      } catch (error) {
        console.error('图片处理失败:', error)
        alert('图片处理失败，请重试')
      } finally {
        setIsImageProcessing(false)
      }
    }
  }

  // 处理拖拽进入
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  // 处理拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有当拖拽完全离开聊天区域时才设置为false
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // 处理文件拖拽放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      handleImageSelect(imageFile)
    }
  }

  // 处理粘贴事件
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    
    if (imageItem) {
      const file = imageItem.getAsFile()
      if (file) {
        handleImageSelect(file)
        e.preventDefault()
      }
    }
  }

  // 处理语音功能
  const handleVoiceClick = () => {
    alert('语音转文字功能即将推出，敬请期待！')
  }

  // 解析AI返回的任务识别结果
  const parseTaskRecognitionResponse = (response: string): RecognizedTask[] => {
    try {
      console.log('AI响应原文:', response);
      
      // 清理响应文本，移除可能的markdown格式
      let cleanResponse = response.trim();
      
      // 移除可能的代码块标记
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // 尝试从响应中提取JSON（支持多种格式）
      let jsonStr = '';
      
      // 方法1: 如果整个响应就是JSON
      if (cleanResponse.startsWith('{') && cleanResponse.endsWith('}')) {
        jsonStr = cleanResponse;
      } else {
        // 方法2: 寻找完整的JSON对象（更宽松的匹配）
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          // 找到最大的JSON对象
          let maxJson = '';
          for (const match of cleanResponse.matchAll(/\{[\s\S]*?\}/g)) {
            if (match[0].length > maxJson.length && match[0].includes('tasks')) {
              maxJson = match[0];
            }
          }
          jsonStr = maxJson || jsonMatch[0];
        } else {
          // 方法3: 寻找tasks数组部分
          const tasksMatch = cleanResponse.match(/"tasks"\s*:\s*\[[\s\S]*?\]/);
          if (tasksMatch) {
            jsonStr = `{${tasksMatch[0]}}`;
          } else {
            console.warn('未找到JSON格式的响应，AI返回了说明文字');
            console.warn('响应内容:', cleanResponse);
            
            // 尝试从说明文字中提取关键信息
            const extractedTasks = extractTasksFromText(cleanResponse);
            if (extractedTasks.length > 0) {
              console.log('从文本中提取到任务:', extractedTasks);
              return extractedTasks;
            }
            
            alert('AI返回了详细说明而不是任务列表。正在尝试从文本中提取任务信息...');
            return [];
          }
        }
      }

      console.log('提取的JSON:', jsonStr);
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        console.warn('响应格式不正确，缺少tasks数组');
        return [];
      }

      if (parsed.tasks.length === 0) {
        console.log('AI未识别到任何任务');
        alert('AI未能从内容中识别到具体的任务项目。请尝试更明确的描述或手动创建任务。');
        return [];
      }

      // 转换为RecognizedTask格式
      const recognizedTasks = parsed.tasks.map((task: any, index: number) => ({
        id: `recognized-${Date.now()}-${index}`,
        title: task.title || '未知任务',
        description: task.description || '',
        priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
        deadline_date: task.deadline_date === 'null' || !task.deadline_date || task.deadline_date === null ? undefined : task.deadline_date,
        deadline_time: task.deadline_time === 'null' || !task.deadline_time || task.deadline_time === null ? undefined : task.deadline_time,
        isSelected: true // 默认选中
      }));

      console.log('解析出的任务:', recognizedTasks);
      return recognizedTasks;
      
    } catch (error) {
      console.error('解析任务识别响应失败:', error, '原始响应:', response);
      
      // 尝试从文本中提取任务
      const extractedTasks = extractTasksFromText(response);
      if (extractedTasks.length > 0) {
        console.log('从错误响应中提取到任务:', extractedTasks);
        return extractedTasks;
      }
      
      alert('任务解析失败，AI可能没有按照要求返回JSON格式。请重新尝试。');
      return [];
    }
  }

  // 从文本中提取任务信息的备用方法
  const extractTasksFromText = (text: string): RecognizedTask[] => {
    const tasks: RecognizedTask[] = [];
    
    // 简单的文本解析，寻找关键词
    const lines = text.split('\n');
    let currentTask: Partial<RecognizedTask> | null = null;
    
    for (const line of lines) {
      // 寻找可能的任务标题
      if (line.includes('报名') || line.includes('参加') || line.includes('讲座') || line.includes('任务')) {
        if (currentTask) {
          tasks.push({
            id: `extracted-${Date.now()}-${tasks.length}`,
            title: currentTask.title || '提取的任务',
            description: currentTask.description || '',
            priority: currentTask.priority || 'medium',
            deadline_date: currentTask.deadline_date,
            deadline_time: currentTask.deadline_time,
            isSelected: true
          });
        }
        
        currentTask = {
          title: line.trim().replace(/[*#-]/g, '').trim(),
          priority: 'medium'
        };
      }
      
      // 寻找日期时间信息
      const dateMatch = line.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})/);
      if (dateMatch && currentTask) {
        currentTask.deadline_date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
      
      const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch && currentTask) {
        currentTask.deadline_time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      }
    }
    
    // 添加最后一个任务
    if (currentTask) {
      tasks.push({
        id: `extracted-${Date.now()}-${tasks.length}`,
        title: currentTask.title || '提取的任务',
        description: currentTask.description || '',
        priority: currentTask.priority || 'medium',
        deadline_date: currentTask.deadline_date,
        deadline_time: currentTask.deadline_time,
        isSelected: true
      });
    }
    
    return tasks;
  }

  // 添加识别的任务到系统
  const handleAddRecognizedTasks = async () => {
    if (!user) return;
    
    const selectedTasks = recognizedTasks.filter(t => t.isSelected);
    if (selectedTasks.length === 0) return;

    try {
      let successCount = 0;
      
      for (const recognizedTask of selectedTasks) {
        // 组合日期和时间为完整的deadline_time
        let deadlineTime: string | undefined = undefined;
        
        if (recognizedTask.deadline_date && recognizedTask.deadline_time) {
          // 有日期和时间，组合成完整格式
          deadlineTime = `${recognizedTask.deadline_date}T${recognizedTask.deadline_time}:00`;
        } else if (recognizedTask.deadline_time) {
          // 只有时间，使用当前选中日期
          const dateStr = selectedDate.toISOString().split('T')[0];
          deadlineTime = `${dateStr}T${recognizedTask.deadline_time}:00`;
        } else if (recognizedTask.deadline_date) {
          // 只有日期，设置为当天23:59
          deadlineTime = `${recognizedTask.deadline_date}T23:59:00`;
        }

        // 转换为系统任务格式
        const taskData = {
          title: recognizedTask.title,
          description: recognizedTask.description,
          deadline_time: deadlineTime,
          priority: recognizedTask.priority
        };

        const result = await createTask(user.id, taskData);
        
        if (result.error) {
          console.error('创建任务失败:', result.error);
        } else if (result.task) {
          // 直接添加到任务列表
          setTasks(prevTasks => taskOperations.addTask(prevTasks, result.task!));
          successCount++;
        }
      }

      // 显示结果
      if (successCount > 0) {
        alert(`成功添加 ${successCount} 个任务！`);
        // 清理识别结果
        setRecognizedTasks([]);
        setShowTaskPreview(false);
        // 关闭任务识别模式
        setIsTaskRecognitionMode(false);
      } else {
        alert('添加任务失败，请稍后重试');
      }
    } catch (error) {
      console.error('批量添加任务异常:', error);
      alert('添加任务时发生错误');
    }
  }

  // 处理任务识别的全选/取消全选
  const handleToggleAllTasks = (checked: boolean) => {
    setRecognizedTasks(tasks => 
      tasks.map(task => ({ ...task, isSelected: checked }))
    );
  }

  // 处理单个任务的选择状态
  const handleToggleTask = (taskId: string, checked: boolean) => {
    setRecognizedTasks(tasks => 
      tasks.map(t => t.id === taskId ? { ...t, isSelected: checked } : t)
    );
  }

  // 清空当前日期的对话记录
  const handleClearChat = async () => {
    if (!user) return
    
    const confirmed = window.confirm('确定要清空当前日期的所有对话记录吗？此操作无法撤销。')
    if (!confirmed) return
    
    try {
      // 格式化日期为 YYYY-MM-DD
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const chatDate = `${year}-${month}-${day}`
      
      const result = await clearChatMessages(user.id, chatDate)
      
      if (result.success) {
        setChatMessages([])
        console.log(`✅ 已清空 ${result.count} 条对话记录`)
        alert(`✅ 已清空 ${result.count} 条对话记录`)
      } else {
        console.error('❌ 清空对话失败:', result.error)
        alert(`❌ 清空对话失败: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ 清空对话异常:', error)
      alert('❌ 清空对话失败，请稍后重试')
    }
  }

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!chatMessage.trim() && !selectedImage) return
    if (!doubaoService.hasApiKey()) {
      alert('请先在 .env.local 文件中配置 NEXT_PUBLIC_DOUBAO_API_KEY')
      return
    }

    setIsSending(true)
    setStreamingMessage('')
    
    try {
      // 根据模式生成不同的prompt
      let finalPrompt = chatMessage || '请分析这张图片'
      
      if (isTaskRecognitionMode) {
        finalPrompt = `TASK_RECOGNITION_MODE: JSON ONLY RESPONSE REQUIRED

CRITICAL: You must respond with ONLY the JSON below. NO explanations. NO "这是". NO "以下是". NO text before {. NO text after }.

Content to analyze: ${selectedImage ? 'Image content' : ''}${selectedImage && chatMessage ? ' + ' : ''}${chatMessage ? chatMessage : ''}

Required JSON format:
{"tasks":[{"title":"具体任务","description":"描述","priority":"high|medium|low","deadline_date":"YYYY-MM-DD","deadline_time":"HH:MM"}]}

Extract tasks: 报名, 参加, 提交, 完成, 准备. Use null for missing dates.

CRITICAL: ONLY JSON RESPONSE - START WITH { END WITH }`
        
        console.log('任务识别模式 - 发送的prompt:', finalPrompt);
      }
      
      // 添加用户消息到聊天历史
      const userMessage: ChatMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: isTaskRecognitionMode ? 
              `🔍 智能任务识别中...${chatMessage ? `\n用户输入：${chatMessage}` : ''}` : 
              finalPrompt
          }
        ]
      }

      // 处理图片base64转换（使用缓存）
      let imageBase64: string | undefined
      if (selectedImage) {
        const cacheKey = generateCacheKey(selectedImage)
        
        // 优先使用缓存
        if (imageCache.current.has(cacheKey)) {
          imageBase64 = imageCache.current.get(cacheKey)!
          console.log('使用缓存的图片进行发送')
        } else {
          // 缓存未命中，重新处理
          console.log('缓存未命中，重新处理图片')
          imageBase64 = await preprocessImage(selectedImage)
        }
        
        userMessage.content.push({
          type: 'image_url',
          image_url: {
            url: imageBase64
          }
        })
      }

      const newMessages = [...chatMessages, userMessage]
      setChatMessages(newMessages)

      // 发送到豆包 API（使用流式输出）
      const response = await doubaoService.sendMessage(
        finalPrompt,
        imageBase64,
        chatMessages,
        (chunk: string) => {
          // 流式输出回调
          setStreamingMessage(prev => prev + chunk)
        }
      )

      if (response.success && response.message) {
        // 如果是任务识别模式，解析识别结果但不显示JSON响应
        if (isTaskRecognitionMode) {
          const tasks = parseTaskRecognitionResponse(response.message);
          if (tasks.length > 0) {
            setRecognizedTasks(tasks);
            setShowTaskPreview(true);
            console.log('识别到的任务:', tasks);
            
            // 添加友好的任务识别结果消息
            const aiMessage: ChatMessage = {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: `✅ 任务识别完成！从内容中识别到 ${tasks.length} 个任务，请在下方预览区域查看并选择需要添加的任务。`
                }
              ]
            }
            setIsSending(false)  // 立即停止"正在思考"的显示
            setChatMessages([...newMessages, aiMessage])
            
            // 保存用户消息和AI回复到数据库
            if (user) {
              const chatDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
              await saveChatMessage(user.id, chatDate, 'user', userMessage.content)
              await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content)
            }
          } else {
            console.log('未识别到任何任务');
            // 添加未识别到任务的消息
            const aiMessage: ChatMessage = {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: `🤔 未能从内容中识别到具体的任务项目。请尝试更明确的描述，或者手动创建任务。`
                }
              ]
            }
            setIsSending(false)  // 立即停止"正在思考"的显示
            setChatMessages([...newMessages, aiMessage])
            
            // 保存用户消息和AI回复到数据库
            if (user) {
              const chatDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
              await saveChatMessage(user.id, chatDate, 'user', userMessage.content)
              await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content)
            }
          }
        } else {
          // 普通聊天模式，正常显示AI回复
          const aiMessage: ChatMessage = {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: response.message
              }
            ]
          }
          
          // 注意：不要立即 setChatMessages，因为 streamingMessage 还在显示
          // 我们在 finally 块中清空 streamingMessage 后，这条消息才会被添加
          // 为了避免重复，我们先清空 streamingMessage 和 isSending，再添加完整消息
          setStreamingMessage('')
          setIsSending(false)  // 立即停止"正在思考"的显示
          setChatMessages([...newMessages, aiMessage])
          
          // 保存用户消息和AI回复到数据库（这个过程可能需要时间）
          if (user) {
            const chatDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
            await saveChatMessage(user.id, chatDate, 'user', userMessage.content)
            await saveChatMessage(user.id, chatDate, 'assistant', aiMessage.content)
          }
        }
      } else {
        // 显示错误消息
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
  }

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [])

  // 当消息更新或流式消息更新时自动滚动
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, streamingMessage, scrollToBottom])

  // 切换AI助手侧边栏
  const toggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen((prev: boolean) => {
      const newValue = !prev
      localStorage.setItem('chatSidebarOpen', JSON.stringify(newValue))
      return newValue
    })
  }, [])

  // 快捷键支持：Ctrl/Cmd + B 切换侧边栏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggleChatSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleChatSidebar])

  // 处理显示导入任务弹窗
  const handleShowImport = () => {
    // 计算按钮位置作为动画起点（相对于视口）
    if (importButtonRef.current) {
      const rect = importButtonRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      setAnimationOrigin({
        x: centerX,
        y: centerY
      })
    }
    setShowImport(true)
    setSelectedImportPlatform(null) // 重置平台选择
  }

  // 处理选择导入平台
  const handleSelectImportPlatform = (platform: 'outlook' | 'google' | 'canvas') => {
    setSelectedImportPlatform(platform)
  }

  // 处理关闭导入弹窗
  const handleCloseImport = () => {
    setShowImport(false)
    setSelectedImportPlatform(null)
  }

  // 处理返回平台选择
  const handleBackToSelector = () => {
    setSelectedImportPlatform(null)
  }

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    console.log('Selected date:', date)
  }

  // 获取选中日期的任务
  const getTasksForSelectedDate = () => {
    return tasks.filter(task => {
      // 如果任务没有截止时间，显示在今天的任务列表中
      if (!task.deadline_datetime) {
        return selectedDate.toDateString() === new Date().toDateString()
      }
      
      // 如果有截止时间，按日期过滤
      const taskDate = new Date(task.deadline_datetime)
      return taskDate.toDateString() === selectedDate.toDateString()
    })
  }

  // 获取要显示的任务（严格按选中日期筛选）
  const displayTasks = getTasksForSelectedDate()

  // 处理显示新建任务表单
  const handleShowTaskForm = () => {
    // 计算按钮位置作为动画起点（相对于视口）
    if (newTaskButtonRef.current) {
      const rect = newTaskButtonRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      setAnimationOrigin({
        x: centerX,
        y: centerY
      })
    }
    setShowTaskForm(true)
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find(task => task.id === active.id)
    setActiveTask(task || null)
  }, [tasks])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
    
    setActiveTask(null)
  }, [])

  const handleLogout = () => {
    clearUserFromStorage()
    router.push('/')
  }

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // 重定向中
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                📋 任务管理器
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                欢迎，<span className="font-medium">{user.username}</span>
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
                {/* 如果有个人资料，显示小圆点提示 */}
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
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* flex布局容器：在主内容区域内部分左右 */}
          <div className="flex gap-6 h-[calc(100vh-8rem)]">
            {/* 左侧：任务管理区域 */}
            <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out relative">
              {/* AI 聊天框 - 临时隐藏 */}
            <div 
              className={`bg-white rounded-lg shadow-sm border mb-6 transition-all duration-200 hidden ${
                isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${doubaoService.hasApiKey() ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-sm font-medium" style={{ color: '#3f3f3f' }}>
                       AI 助手 {!doubaoService.hasApiKey() && '(需要配置API Key)'}
                    </span>
                  </div>
                  {chatMessages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      className="text-xs text-gray-500 hover:text-red-600 underline"
                    >
                      清空对话
                    </button>
                  )}
                </div>
              </div>
              
              {/* 聊天消息区域 */}
              <div ref={chatScrollRef} className="h-48 p-4 overflow-y-auto bg-gray-50 relative">
                {/* 拖拽提示覆盖层 */}
                {isDragOver && (
                  <div className="absolute inset-0 bg-blue-100 bg-opacity-90 flex items-center justify-center z-10 rounded">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-blue-700 font-medium">拖拽图片到这里</p>
                      <p className="text-blue-600 text-sm">支持 JPG, PNG, GIF 等格式</p>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    /* 欢迎消息 */
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">AI</span>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-xs">
                        <p className="text-sm" style={{ color: '#3f3f3f' }}>
                          你好！我是AI助手，可以帮你管理任务、分析图片。{!doubaoService.hasApiKey() ? '请先配置API Key。' : '你可以直接粘贴图片(Ctrl+V)或拖拽图片到这里，有什么可以帮助你的吗？'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* 聊天消息 */
                    chatMessages.map((message, index) => (
                      <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          <span className="text-white text-sm font-medium">
                            {message.role === 'user' ? '我' : 'AI'}
                          </span>
                        </div>
                        <div className={`rounded-lg px-3 py-2 shadow-sm max-w-xs ${
                          message.role === 'user' ? 'bg-green-100' : 'bg-white'
                        }`}>
                          {message.content.map((content, contentIndex) => (
                            <div key={contentIndex}>
                              {content.type === 'text' && content.text && (
                                <p className="text-sm whitespace-pre-wrap" style={{ color: '#3f3f3f' }}>
                                  {content.text}
                                </p>
                              )}
                              {content.type === 'image_url' && content.image_url && (
                                <img 
                                  src={content.image_url.url} 
                                  alt="上传的图片" 
                                  className="max-w-full h-auto rounded mt-2"
                                  style={{ maxHeight: '150px' }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* 流式输出和发送中指示器 */}
                  {isSending && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">AI</span>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-xs">
                        {streamingMessage ? (
                          <div>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: '#3f3f3f' }}>
                              {streamingMessage}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full"></div>
                              <span className="text-xs text-gray-500">正在输入...</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-500">思考中...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 输入框区域 */}
              <div className="p-4 border-t border-gray-100">
                {/* 选中的图片预览 */}
                {selectedImage && (
                  <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img 
                          src={URL.createObjectURL(selectedImage)} 
                          alt="预览" 
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-blue-700">{selectedImage.name}</p>
                          <p className="text-xs text-blue-600">
                            {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedImage(null)}
                        className="text-blue-600 hover:text-red-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* 图片上传按钮 */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleImageSelect(file)
                        }
                      }}
                    />
                    <button className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* 输入框 */}
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onPaste={handlePaste}
                    placeholder={isTaskRecognitionMode 
                      ? "描述任务内容或上传包含任务的图片..." 
                      : "输入消息或粘贴图片(Ctrl+V)..."
                    }
                    className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all duration-200 ${
                      isTaskRecognitionMode 
                        ? 'border-green-300 focus:ring-green-500 bg-green-50' 
                        : 'border-gray-300 focus:ring-blue-500 bg-white'
                    }`}
                    style={{ color: '#3f3f3f' }}
                  />

                  {/* 语音按钮 */}
                  <button 
                    onClick={handleVoiceClick}
                    className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>

                  {/* 发送按钮 */}
                  <button 
                    onClick={handleSendMessage}
                    disabled={isSending || (!chatMessage.trim() && !selectedImage)}
                    className={`px-4 py-2 text-white rounded-lg transition-all duration-200 font-medium text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isTaskRecognitionMode 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {isTaskRecognitionMode ? '识别中...' : '发送中'}
                      </>
                    ) : (
                      <>
                        {isTaskRecognitionMode ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        {isTaskRecognitionMode ? '识别任务' : '发送'}
                      </>
                    )}
                  </button>
                </div>
                
                {/* 任务识别开关 */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">智能任务识别</span>
                      <span className="text-xs text-gray-500">
                        {isTaskRecognitionMode ? '已启用' : '已关闭'}
                      </span>
                    </div>
                    
                    {/* 开关按钮 */}
                    <button
                      onClick={() => setIsTaskRecognitionMode(!isTaskRecognitionMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                        isTaskRecognitionMode ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isTaskRecognitionMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* 模式提示 */}
                  {isTaskRecognitionMode && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                      💡 任务识别模式已启用：在上方输入框中描述任务或上传图片，点击发送后AI将识别并提取任务信息
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 任务识别结果预览 - 临时隐藏 */}
            {showTaskPreview && recognizedTasks.length > 0 && (
              <div className="mt-4 bg-white rounded-lg shadow-sm border border-green-200 hidden">
                <div className="p-4 border-b border-green-100 bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="font-medium text-green-800">识别到 {recognizedTasks.length} 个任务</h3>
                    </div>
                    <button
                      onClick={() => setShowTaskPreview(false)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* 批量操作 */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recognizedTasks.every(task => task.isSelected)}
                        onChange={(e) => {
                          const allSelected = e.target.checked;
                          setRecognizedTasks(tasks => 
                            tasks.map(task => ({ ...task, isSelected: allSelected }))
                          );
                        }}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">
                        全选 ({recognizedTasks.filter(t => t.isSelected).length}/{recognizedTasks.length})
                      </span>
                    </div>
                    <button
                      onClick={handleAddRecognizedTasks}
                      disabled={recognizedTasks.filter(t => t.isSelected).length === 0}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      添加选中任务 ({recognizedTasks.filter(t => t.isSelected).length})
                    </button>
                  </div>

                  {/* 任务列表 */}
                  {recognizedTasks.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-3 hover:border-green-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.isSelected}
                          onChange={(e) => {
                            setRecognizedTasks(tasks => 
                              tasks.map(t => t.id === task.id ? { ...t, isSelected: e.target.checked } : t)
                            );
                          }}
                          className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}优先级
                            </span>
                            {task.deadline_time && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {task.deadline_time}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

        {/* 日历视图 */}
        <CalendarView 
          tasks={tasks}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日的任务
            </h2>
            <p className="text-gray-600">
              共 {displayTasks.length} 个任务，{displayTasks.filter(t => !t.completed).length} 个待完成
            </p>
          </div>
          <div className="flex items-center space-x-3">
                {/* 暂时隐藏排列优先级按钮 */}
                {/* advancedToolsEnabled && (
                <button
                  onClick={() => setShowMatrix(true)}
                  className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#FF6B6B' }}
                  title="AI帮助排列任务优先级"
                >
                  <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 20 20">
                    <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"/>
                  </svg>
                  排列优先级
                </button>
                ) */}
                {/* 移除“卡住啦”按钮 */}
                <button
                  ref={importButtonRef}
                  onClick={handleShowImport}
                  className="hidden text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#4ECDC4' }}
                >
                  <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 20 20">
                    <path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z"/>
                  </svg>
                  导入任务
                </button>
                <button
                  ref={newTaskButtonRef}
                  onClick={handleShowTaskForm}
                  className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#4A90E2' }}
                >
                  <span className="text-white text-lg font-bold flex-shrink-0 w-4 h-4 flex items-center justify-center">+</span>
                  新建任务
                </button>
          </div>
        </div>

        {/* 任务进度条 */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">任务进度</span>
            <span className="text-sm text-gray-600">
              {displayTasks.filter(t => t.completed).length}/{displayTasks.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
              style={{
                width: displayTasks.length > 0 ? `${(displayTasks.filter(t => t.completed).length / displayTasks.length) * 100}%` : '0%'
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {displayTasks.length > 0 ? Math.round((displayTasks.filter(t => t.completed).length / displayTasks.length) * 100) : 0}% 完成
            </span>
            {displayTasks.length > 0 && displayTasks.filter(t => t.completed).length === displayTasks.length && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                全部完成！
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* 暂时注释掉快速添加任务组件 */}
        {/* <QuickAddTask 
          selectedDate={selectedDate}
          onTaskCreate={handleQuickAddTask}
          onBatchUndo={handleBatchUndo}
        /> */}

        {/* 任务列表 */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">加载任务中...</p>
            </div>
          ) : displayTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedDate.toDateString() === new Date().toDateString() 
                  ? '今天还没有任务' 
                  : `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日没有任务`
                }
              </h3>
              <p className="text-gray-600 mb-6">
                点击上方输入框添加新的任务
              </p>
              <div className="flex gap-3 justify-center">
                {selectedDate.toDateString() !== new Date().toDateString() && (
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    回到今天
                  </button>
                )}
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={displayTasks} strategy={verticalListSortingStrategy}>
                {displayTasks.map((task) => (
                  <DraggableTaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onDecompose={handleDecomposeTask}
                    onToggleExpansion={handleToggleExpansion}
                    onPromoteSubtasks={handlePromoteSubtasks}
                    decomposeEnabled={advancedToolsEnabled}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeTask ? (
                  <div className="transform scale-105 shadow-2xl">
                    <DraggableTaskItem
                      task={activeTask}
                      onToggleComplete={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onDecompose={() => {}}
                      isOverlay={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* AI完善计划按钮 - 在所有任务下方 */}
          {displayTasks.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={async () => {
                  // 解锁高级功能并展开侧边栏
                  enableAdvancedTools()
                  setIsChatSidebarOpen(true) // 展开右侧聊天侧边栏
                  
                  // 启动工作流分析
                  await startWorkflow()
                }}
                disabled={isWorkflowAnalyzing}
                className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-2 border-purple-200 hover:border-purple-300 text-purple-700 rounded-xl transition-all font-medium shadow-sm hover:shadow-md ${
                  isWorkflowAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isWorkflowAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></div>
                    <span>分析中...</span>
                  </>
                ) : (
                  <span>✨ 下一步，AI辅助完善计划</span>
                )}
              </button>
            </div>
          )}
        </div>

              {/* 浮动AI助手按钮 - 仅在侧边栏收起时显示 */}
              {!isChatSidebarOpen && (
                <button
                  onClick={toggleChatSidebar}
                  className="absolute right-4 bottom-4 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
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
              workflowMode={workflowMode}
              currentTasks={tasks}
              onWorkflowOptionSelect={selectWorkflowOption}
              isWorkflowAnalyzing={isWorkflowAnalyzing}
              handleSendMessage={handleSendMessage}
              handleClearChat={handleClearChat}
              handleDragEnter={handleDragEnter}
              handleDragLeave={handleDragLeave}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleAddSelectedTasks={handleAddRecognizedTasks}
              handleToggleAllTasks={handleToggleAllTasks}
              handleToggleTask={handleToggleTask}
              handleImageSelect={handleImageSelect}
              handleVoiceClick={handleVoiceClick}
              handlePaste={handlePaste}
              chatScrollRef={chatScrollRef}
            />
          </div>
        </div>
      </main>

      {/* 导入任务弹窗 */}
      {showImport && (
        <>
          {!selectedImportPlatform ? (
            // 显示平台选择器
            <ImportSelector
              onSelectPlatform={handleSelectImportPlatform}
              onClose={handleCloseImport}
            />
          ) : selectedImportPlatform === 'outlook' ? (
            // 显示Outlook导入
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div 
                className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-modal-scale"
                style={{
                  transformOrigin: animationOrigin 
                    ? `${((animationOrigin.x / window.innerWidth) * 100)}% ${((animationOrigin.y / window.innerHeight) * 100)}%`
                    : 'center center'
                }}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleBackToSelector}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h2 className="text-xl font-semibold text-gray-900">Outlook 任务导入</h2>
                    </div>
                    <button
                      onClick={handleCloseImport}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="sr-only">关闭</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <OutlookImport
                    existingTasks={tasks}
                    onTasksImported={handleOutlookTasksImported}
                    createTask={(taskData) => createTask(user!.id, taskData)}
                  />
                </div>
              </div>
            </div>
          ) : selectedImportPlatform === 'google' ? (
            // Google Calendar导入
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div 
                className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-modal-scale"
                style={{
                  transformOrigin: animationOrigin 
                    ? `${((animationOrigin.x / window.innerWidth) * 100)}% ${((animationOrigin.y / window.innerHeight) * 100)}%`
                    : 'center center'
                }}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleBackToSelector}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h2 className="text-xl font-semibold text-gray-900">Google Calendar 导入</h2>
                    </div>
                    <button
                      onClick={handleCloseImport}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="sr-only">关闭</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <GoogleCalendarImport
                    existingTasks={tasks}
                    onTasksImported={handleTasksImported}
                    createTask={(taskData) => createTask(user!.id, taskData)}
                  />
                </div>
              </div>
            </div>
          ) : (
            // Canvas导入
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div 
                className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-modal-scale"
                style={{
                  transformOrigin: animationOrigin 
                    ? `${((animationOrigin.x / window.innerWidth) * 100)}% ${((animationOrigin.y / window.innerHeight) * 100)}%`
                    : 'center center'
                }}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleBackToSelector}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h2 className="text-xl font-semibold text-gray-900">Canvas 日历导入</h2>
                    </div>
                    <button
                      onClick={handleCloseImport}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="sr-only">关闭</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <CanvasImport
                    existingTasks={tasks}
                    onTasksImported={handleTasksImported}
                    createTask={(taskData) => createTask(user!.id, taskData)}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 任务表单弹窗 */}
      {showTaskForm && (
        <TaskForm
          defaultDate={selectedDate}
          customTags={userProfile?.custom_task_tags || []}
          onSubmit={handleCreateTask}
          onCancel={() => setShowTaskForm(false)}
          onAddCustomTag={handleAddCustomTag}
          isLoading={isFormLoading}
          animationOrigin={animationOrigin}
        />
      )}

      {editingTask && (
        <TaskForm
          task={editingTask}
          defaultDate={selectedDate}
          customTags={userProfile?.custom_task_tags || []}
          onSubmit={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
          onAddCustomTag={handleAddCustomTag}
          isLoading={isFormLoading}
          animationOrigin={animationOrigin}
        />
      )}

      {/* 任务拆解弹窗 */}
      {showDecompositionModal && decomposingTask && (
        <TaskDecompositionModal
          isOpen={showDecompositionModal}
          onClose={() => {
            setShowDecompositionModal(false)
            setDecomposingTask(null)
          }}
          parentTask={decomposingTask}
          onConfirm={handleSubtasksConfirm}
        />
      )}

      {/* 艾森豪威尔矩阵 */}
      {showMatrix && (
        <EisenhowerMatrix
          tasks={displayTasks}
          onClose={() => setShowMatrix(false)}
          onSave={handleMatrixSave}
        />
      )}

      {/* 用户个人资料弹窗 */}
      {user && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userId={user.id}
          initialProfile={userProfile}
          onSave={handleSaveProfile}
        />
      )}

      {/* 个人资料保存成功通知 */}
      {showProfileSaveSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-base">个人资料保存成功!</span>
          </div>
        </div>
      )}
    </div>
  )
}
