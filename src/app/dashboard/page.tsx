'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, clearUserFromStorage, AuthUser } from '@/lib/auth'
import { getUserTasks, createTask, updateTask, deleteTask, toggleTaskComplete } from '@/lib/tasks'
import type { Task } from '@/types'
import TaskItem from '@/components/TaskItem'
import TaskForm from '@/components/TaskForm'

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
    deadline?: string
    priority: 'low' | 'medium' | 'high'
  }) => {
    if (!user) return
    
    setIsFormLoading(true)
    const result = await createTask(user.id, taskData)
    
    if (result.error) {
      throw new Error(result.error)
    } else {
      await loadTasks(user.id) // 重新加载任务列表
      setShowTaskForm(false)
    }
    setIsFormLoading(false)
  }

  const handleUpdateTask = async (taskData: {
    title: string
    description?: string
    deadline?: string
    priority: 'low' | 'medium' | 'high'
  }) => {
    if (!editingTask) return
    
    setIsFormLoading(true)
    const result = await updateTask(editingTask.id, taskData)
    
    if (result.error) {
      throw new Error(result.error)
    } else {
      await loadTasks(user!.id) // 重新加载任务列表
      setEditingTask(null)
    }
    setIsFormLoading(false)
  }

  const handleDeleteTask = async (taskId: string) => {
    const result = await deleteTask(taskId)
    
    if (result.error) {
      alert('删除失败：' + result.error)
    } else {
      await loadTasks(user!.id) // 重新加载任务列表
    }
  }

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const result = await toggleTaskComplete(taskId, completed)
    
    if (result.error) {
      alert('更新失败：' + result.error)
    } else {
      await loadTasks(user!.id) // 重新加载任务列表
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
  }

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
          <button
            onClick={() => setShowTaskForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ➕ 新建任务
          </button>
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
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                创建第一个任务
              </button>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            ))
          )}
        </div>
      </main>

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
