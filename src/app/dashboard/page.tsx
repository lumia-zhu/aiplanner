'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getUserTasks, createTask, updateTask, deleteTask, toggleTaskComplete } from '@/lib/tasks'
import type { Task } from '@/types'
import DraggableTaskItem from '@/components/DraggableTaskItem'
import TaskForm from '@/components/TaskForm'
import OutlookImport from '@/components/OutlookImport'
import { taskOperations } from '@/utils/taskUtils'
import { doubaoService, type ChatMessage } from '@/lib/doubaoService'
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
  
  // 聊天相关状态
  const [chatMessage, setChatMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)
  
  // 动画相关状态
  const [animationOrigin, setAnimationOrigin] = useState<{ x: number; y: number } | null>(null)
  const importButtonRef = useRef<HTMLButtonElement>(null)
  const newTaskButtonRef = useRef<HTMLButtonElement>(null)
  
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const currentUser = getUserFromStorage()
    if (!currentUser) {
      router.push('/auth/login')
    } else {
      setUser(currentUser)
      loadTasks(currentUser.id)
    }
  }, [router])

  const loadTasks = async (userId: string) => {
    setIsLoading(true)
    const result = await getUserTasks(userId)
    
    if (result.error) {
      setError(result.error)
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
    priority: 'low' | 'medium' | 'high'
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
    priority: 'low' | 'medium' | 'high'
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
    // 立即更新UI状态，提供即时反馈
    setTasks(prevTasks => taskOperations.toggleComplete(prevTasks, taskId, completed))

    try {
      // 然后更新数据库
      const result = await toggleTaskComplete(taskId, completed)
      
      if (result.error) {
        // 如果失败，回滚UI状态
        setTasks(prevTasks => taskOperations.toggleComplete(prevTasks, taskId, !completed))
        console.error('更新任务状态失败:', result.error)
      }
    } catch (error) {
      // 网络错误或其他异常，回滚UI状态
      setTasks(prevTasks => taskOperations.toggleComplete(prevTasks, taskId, !completed))
      console.error('更新任务异常:', error)
    }
  }, [])

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

  const handleTasksImported = (count: number) => {
    // 导入完成后重新加载任务列表
    if (user) {
      loadTasks(user.id)
    }
    setShowImport(false)
  }

  // 处理图片选择
  const handleImageSelect = (file: File) => {
    if (file) {
      setSelectedImage(file)
      console.log('选择的图片:', file.name, file.size)
    }
  }

  // 处理语音功能
  const handleVoiceClick = () => {
    alert('语音转文字功能即将推出，敬请期待！')
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
      // 添加用户消息到聊天历史
      const userMessage: ChatMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: chatMessage || '请分析这张图片'
          }
        ]
      }

      if (selectedImage) {
        const reader = new FileReader()
        const base64Image = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(selectedImage)
        })
        
        userMessage.content.push({
          type: 'image_url',
          image_url: {
            url: base64Image
          }
        })
      }

      const newMessages = [...chatMessages, userMessage]
      setChatMessages(newMessages)

      // 发送到豆包 API（使用流式输出）
      const response = await doubaoService.sendMessage(
        chatMessage || '请分析这张图片',
        selectedImage || undefined,
        chatMessages,
        (chunk: string) => {
          // 流式输出回调
          setStreamingMessage(prev => prev + chunk)
        }
      )

      if (response.success && response.message) {
        // 添加完整的 AI 回复
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: response.message
            }
          ]
        }
        setChatMessages([...newMessages, aiMessage])
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
  }

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
          <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* AI 聊天框 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${doubaoService.hasApiKey() ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-sm font-medium" style={{ color: '#3f3f3f' }}>
                      豆包 AI 助手 {!doubaoService.hasApiKey() && '(需要配置API Key)'}
                    </span>
                  </div>
                  {chatMessages.length > 0 && (
                    <button
                      onClick={() => setChatMessages([])}
                      className="text-xs text-gray-500 hover:text-red-600 underline"
                    >
                      清空对话
                    </button>
                  )}
                </div>
              </div>
              
              {/* 聊天消息区域 */}
              <div ref={chatScrollRef} className="h-48 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    /* 欢迎消息 */
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">AI</span>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-xs">
                        <p className="text-sm" style={{ color: '#3f3f3f' }}>
                          你好！我是豆包AI助手，可以帮你管理任务、分析图片。{!doubaoService.hasApiKey() ? '请先配置API Key。' : '有什么可以帮助你的吗？'}
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
                    placeholder="输入消息..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        发送中
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        发送
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              我的任务
            </h2>
            <p className="text-gray-600">
              共 {tasks.length} 个任务，{tasks.filter(t => !t.completed).length} 个待完成
            </p>
          </div>
          <div className="flex items-center space-x-3">
                <button
                  ref={importButtonRef}
                  onClick={handleShowImport}
                  className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg h-10 hover:scale-105 active:scale-95"
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* 任务列表 */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">加载任务中...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                还没有任务
              </h3>
              <p className="text-gray-600 mb-6">
                创建您的第一个任务开始管理待办事项
              </p>
              <button
                onClick={() => setShowTaskForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 mx-auto"
              >
                <span className="text-white text-lg">+</span>
                创建第一个任务
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
                {tasks.map((task) => (
                  <DraggableTaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
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
                      isOverlay={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {/* 导入任务弹窗 */}
      {showImport && (
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
                <h2 className="text-xl font-semibold text-gray-900">导入任务</h2>
                <button
                  onClick={() => setShowImport(false)}
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
                onTasksImported={handleTasksImported}
                createTask={(taskData) => createTask(user!.id, taskData)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 任务表单弹窗 */}
      {showTaskForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowTaskForm(false)}
          isLoading={isFormLoading}
          animationOrigin={animationOrigin}
        />
      )}

      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
          isLoading={isFormLoading}
          animationOrigin={animationOrigin}
        />
      )}
    </div>
  )
}
