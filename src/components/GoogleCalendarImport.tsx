'use client'

import React, { useState, useEffect } from 'react'
import { googleAuthService, type GoogleUser } from '@/lib/googleAuth'
import { googleCalendarImportService, type GoogleCalendar, type GoogleCalendarEvent, type ImportFilter } from '@/lib/googleCalendarImport'
import type { Task } from '@/types'

interface GoogleCalendarImportProps {
  existingTasks: Task[]
  onTasksImported: (tasks: Task[]) => void
  createTask: (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<{ task?: Task; error?: string }>
}

export default function GoogleCalendarImport({ existingTasks, onTasksImported, createTask }: GoogleCalendarImportProps) {
  // 认证状态
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // 日历和事件数据
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [previewTasks, setPreviewTasks] = useState<Task[]>([])
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])

  // UI状态
  const [currentStep, setCurrentStep] = useState<'connect' | 'calendars' | 'filter' | 'preview' | 'importing'>('connect')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })

  // 过滤设置
  const [timeRange, setTimeRange] = useState('past_future_7days')
  const [includeAllDayEvents, setIncludeAllDayEvents] = useState(true)
  const [includeDeclinedEvents, setIncludeDeclinedEvents] = useState(false)

  // 检查初始连接状态
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const checkConnectionStatus = async () => {
    try {
      if (googleAuthService.isSignedIn()) {
        const user = googleAuthService.getCurrentUser()
        if (user) {
          setCurrentUser(user)
          setIsConnected(true)
          setCurrentStep('calendars')
          await loadCalendars()
        }
      }
    } catch (error) {
      console.error('检查连接状态失败:', error)
    }
  }

  const handleConnect = async () => {
    console.log('Google配置信息:', googleAuthService.getConfigInfo())
    
    if (!googleAuthService.isConfigured()) {
      const error = googleAuthService.getConfigError()
      console.error('配置错误:', error)
      setConnectionError(error)
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      console.log('开始Google登录...')
      const user = await googleAuthService.signIn()
      console.log('Google登录成功:', user)
      setCurrentUser(user)
      setIsConnected(true)
      setCurrentStep('calendars')
      await loadCalendars()
    } catch (error: any) {
      console.error('Google连接失败:', error)
      let errorMessage = 'Google连接失败，请重试'
      
      if (error.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setConnectionError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await googleAuthService.signOut()
      setCurrentUser(null)
      setIsConnected(false)
      setCurrentStep('connect')
      setCalendars([])
      setSelectedCalendarIds([])
      setEvents([])
      setPreviewTasks([])
      setSelectedTasks([])
    } catch (error) {
      console.error('断开连接失败:', error)
    }
  }

  const loadCalendars = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const calendarList = await googleCalendarImportService.getCalendars()
      setCalendars(calendarList)
      
      // 默认选择主日历
      const primaryCalendar = calendarList.find(cal => cal.primary)
      if (primaryCalendar) {
        setSelectedCalendarIds([primaryCalendar.id])
      }
    } catch (error: any) {
      console.error('加载日历失败:', error)
      setError(error.message || '加载日历失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCalendarSelection = (calendarId: string, selected: boolean) => {
    setSelectedCalendarIds(prev => 
      selected 
        ? [...prev, calendarId]
        : prev.filter(id => id !== calendarId)
    )
  }

  const handleSelectAllCalendars = () => {
    const allSelected = selectedCalendarIds.length === calendars.length
    setSelectedCalendarIds(allSelected ? [] : calendars.map(cal => cal.id))
  }

  const handleNextToFilter = () => {
    if (selectedCalendarIds.length === 0) {
      setError('请至少选择一个日历')
      return
    }
    setCurrentStep('filter')
    setError(null)
  }

  const handleLoadEvents = async () => {
    if (selectedCalendarIds.length === 0) {
      setError('请选择要导入的日历')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 构建过滤条件
      const timeRangeOptions = googleCalendarImportService.getTimeRangeOptions()
      const selectedTimeRange = timeRangeOptions.find(option => 
        option.label === getTimeRangeLabel(timeRange)
      )

      if (!selectedTimeRange) {
        throw new Error('无效的时间范围选择')
      }

      const filter: ImportFilter = {
        calendarIds: selectedCalendarIds,
        timeMin: selectedTimeRange.timeMin,
        timeMax: selectedTimeRange.timeMax,
        includeAllDayEvents,
        includeDeclinedEvents
      }

      // 获取事件
      const eventList = await googleCalendarImportService.getFilteredEvents(filter)
      setEvents(eventList)

      // 转换为任务
      const convertedTasks = googleCalendarImportService.convertEventsToTasks(eventList)
      
      // 检测重复任务
      const uniqueTasks = googleCalendarImportService.detectDuplicateTasks(convertedTasks, existingTasks)
      setPreviewTasks(uniqueTasks)
      
      // 默认全选
      setSelectedTasks(uniqueTasks.map(task => task.id))
      
      setCurrentStep('preview')
    } catch (error: any) {
      console.error('加载事件失败:', error)
      setError(error.message || '加载日历事件失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskSelection = (taskId: string, selected: boolean) => {
    setSelectedTasks(prev => 
      selected 
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    )
  }

  const handleSelectAllTasks = () => {
    const allSelected = selectedTasks.length === previewTasks.length
    setSelectedTasks(allSelected ? [] : previewTasks.map(task => task.id))
  }

  const handleImportTasks = async () => {
    const tasksToImport = previewTasks.filter(task => selectedTasks.includes(task.id))
    
    if (tasksToImport.length === 0) {
      setError('请选择要导入的任务')
      return
    }

    setCurrentStep('importing')
    setImportProgress({ current: 0, total: tasksToImport.length })

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < tasksToImport.length; i++) {
      const task = tasksToImport[i]
      setImportProgress({ current: i + 1, total: tasksToImport.length })

      try {
        const result = await createTask({
          title: task.title,
          description: task.description,
          deadline_time: task.deadline_time,
          priority: task.priority,
          completed: task.completed
        })

        if (result.error) {
          console.error(`导入任务失败: ${task.title}`, result.error)
          errorCount++
        } else {
          successCount++
        }
      } catch (error) {
        console.error(`导入任务异常: ${task.title}`, error)
        errorCount++
      }

      // 添加小延迟避免过快的请求
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 通知父组件任务已导入
    if (successCount > 0) {
      onTasksImported(tasksToImport.slice(0, successCount))
    }

    // 显示结果
    if (successCount > 0 && errorCount === 0) {
      alert(`成功导入 ${successCount} 个任务！`)
    } else if (successCount > 0 && errorCount > 0) {
      alert(`导入完成：${successCount} 个成功，${errorCount} 个失败`)
    } else {
      alert(`导入失败：${errorCount} 个任务导入失败`)
    }

    // 重置状态
    setCurrentStep('connect')
    setSelectedCalendarIds([])
    setEvents([])
    setPreviewTasks([])
    setSelectedTasks([])
  }

  const getTimeRangeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'past_3days': '过去3天',
      'past_7days': '过去7天',
      'future_7days': '未来7天',
      'past_future_7days': '过去和未来7天',
      'current_month': '本月'
    }
    return labels[value] || '过去和未来7天'
  }

  const handleBackToCalendars = () => {
    setCurrentStep('calendars')
    setError(null)
  }

  const handleBackToFilter = () => {
    setCurrentStep('filter')
    setError(null)
  }

  // 连接Google账户界面
  if (currentStep === 'connect') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
          </svg>
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">连接 Google Calendar</h3>
        <p className="text-gray-600 mb-6">连接你的Google账户以导入日历事件作为任务</p>
        
        {connectionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>连接错误：</strong>{connectionError}
            <details className="mt-2">
              <summary className="cursor-pointer">调试信息</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(googleAuthService.getConfigInfo(), null, 2)}
              </pre>
            </details>
          </div>
        )}
        
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {isConnecting ? '连接中...' : '连接 Google 账户'}
        </button>
      </div>
    )
  }

  // 日历选择界面
  if (currentStep === 'calendars') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">选择日历</h3>
            <p className="text-sm text-gray-600">选择要导入事件的日历</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">已连接: {currentUser?.name}</span>
            <button
              onClick={handleDisconnect}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              断开连接
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-gray-600 mt-2">加载日历中...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                共 {calendars.length} 个日历，已选择 {selectedCalendarIds.length} 个
              </span>
              <button
                onClick={handleSelectAllCalendars}
                className="text-sm text-green-600 hover:text-green-800"
              >
                {selectedCalendarIds.length === calendars.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {calendars.map((calendar) => (
                <div
                  key={calendar.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCalendarIds.includes(calendar.id)}
                    onChange={(e) => handleCalendarSelection(calendar.id, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                  ></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{calendar.summary}</span>
                      {calendar.primary && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          主日历
                        </span>
                      )}
                    </div>
                    {calendar.description && (
                      <p className="text-sm text-gray-600">{calendar.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleNextToFilter}
                disabled={selectedCalendarIds.length === 0}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步：设置过滤条件
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // 过滤设置界面
  if (currentStep === 'filter') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">设置过滤条件</h3>
            <p className="text-sm text-gray-600">选择要导入的事件范围和类型</p>
          </div>
          <button
            onClick={handleBackToCalendars}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 返回日历选择
          </button>
        </div>

        <div className="space-y-6">
          {/* 时间范围选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              时间范围
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            >
              <option value="past_3days">过去3天</option>
              <option value="past_7days">过去7天</option>
              <option value="future_7days">未来7天</option>
              <option value="past_future_7days">过去和未来7天</option>
              <option value="current_month">本月</option>
            </select>
          </div>

          {/* 事件类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              事件类型
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeAllDayEvents}
                  onChange={(e) => setIncludeAllDayEvents(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">包含全天事件</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeDeclinedEvents}
                  onChange={(e) => setIncludeDeclinedEvents(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">包含已拒绝的事件</span>
              </label>
            </div>
          </div>

          {/* 选中的日历信息 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">已选择的日历</h4>
            <div className="space-y-1">
              {calendars
                .filter(cal => selectedCalendarIds.includes(cal.id))
                .map(calendar => (
                  <div key={calendar.id} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                    ></div>
                    <span className="text-gray-700">{calendar.summary}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={handleBackToCalendars}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 返回
          </button>
          <button
            onClick={handleLoadEvents}
            disabled={isLoading}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                加载中...
              </>
            ) : (
              '加载事件'
            )}
          </button>
        </div>
      </div>
    )
  }

  // 任务预览界面
  if (currentStep === 'preview') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">预览任务</h3>
            <p className="text-sm text-gray-600">
              找到 {events.length} 个事件，转换为 {previewTasks.length} 个任务
            </p>
          </div>
          <button
            onClick={handleBackToFilter}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 返回过滤设置
          </button>
        </div>

        {previewTasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">没有找到可导入的任务</h4>
            <p className="text-gray-600 mb-4">在选定的时间范围内没有找到符合条件的事件，或者所有事件都已存在。</p>
            <button
              onClick={handleBackToFilter}
              className="text-green-600 hover:text-green-800"
            >
              调整过滤条件
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                共 {previewTasks.length} 个任务，已选择 {selectedTasks.length} 个
              </span>
              <button
                onClick={handleSelectAllTasks}
                className="text-sm text-green-600 hover:text-green-800"
              >
                {selectedTasks.length === previewTasks.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {previewTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    selectedTasks.includes(task.id)
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) => handleTaskSelection(task.id, e.target.checked)}
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
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={handleBackToFilter}
                className="text-gray-500 hover:text-gray-700"
              >
                ← 返回
              </button>
              <button
                onClick={handleImportTasks}
                disabled={selectedTasks.length === 0}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                导入选中的 {selectedTasks.length} 个任务
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // 导入进度界面
  if (currentStep === 'importing') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">正在导入任务</h3>
        <p className="text-gray-600 mb-4">
          正在导入任务 {importProgress.current} / {importProgress.total}
        </p>
        
        <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
          ></div>
        </div>
      </div>
    )
  }

  return null
}
