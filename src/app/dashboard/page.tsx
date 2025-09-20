'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getUserTasks, createTask, updateTask, deleteTask, toggleTaskComplete } from '@/lib/tasks'
import type { Task } from '@/types'
import DraggableTaskItem from '@/components/DraggableTaskItem'
import TaskForm from '@/components/TaskForm'
import OutlookImport from '@/components/OutlookImport'
import { taskOperations } from '@/utils/taskUtils'
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

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
  }

  const handleTasksImported = (count: number) => {
    // 导入完成后重新加载任务列表
    if (user) {
      loadTasks(user.id)
    }
    setShowImport(false)
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
              onClick={() => setShowImport(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <span className="text-white text-lg">📥</span>
              导入任务
            </button>
            <button
              onClick={() => setShowTaskForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <span className="text-white text-lg">+</span>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
        />
      )}

      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
          isLoading={isFormLoading}
        />
      )}
    </div>
  )
}
