'use client'

import React, { useState } from 'react'
import { canvasImportService } from '@/lib/canvasImport'
import type { CanvasEvent } from '@/types/canvas'
import type { Task } from '@/types'

interface CanvasImportProps {
  existingTasks: Task[]
  onTasksImported: (tasks: Task[]) => void
  createTask: (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<{ task?: Task; error?: string }>
}

export default function CanvasImport({ existingTasks, onTasksImported, createTask }: CanvasImportProps) {
  // 状态管理
  const [currentStep, setCurrentStep] = useState<'url' | 'preview' | 'importing' | 'complete'>('url')
  const [iCalUrl, setICalUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFileUpload, setShowFileUpload] = useState(false)
  
  // 解析结果
  const [canvasEvents, setCanvasEvents] = useState<CanvasEvent[]>([])
  const [previewTasks, setPreviewTasks] = useState<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  
  // 导入进度
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null)

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith('.ics') && !file.type.includes('calendar')) {
      setError('请选择.ics格式的日历文件')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('开始解析上传的iCal文件:', file.name)
      
      // 读取文件内容
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsText(file)
      })

      console.log('文件读取完成，长度:', fileContent.length)

      // 直接解析文件内容
      const events = await canvasImportService.parseICalFromFileContent(fileContent)
      console.log('解析到的事件:', events)

      if (events.length === 0) {
        setError('未在该文件中找到任何事件，请检查文件是否正确')
        return
      }

      // 转换为任务格式
      const tasks = canvasImportService.convertEventsToTasks(events)
      
      // 检测重复任务
      const { unique, duplicates } = canvasImportService.detectDuplicateTasks(tasks, existingTasks)
      
      setCanvasEvents(events)
      setPreviewTasks(unique)
      
      // 默认选中所有非重复任务
      setSelectedTasks(new Set(unique.map((_, index) => index)))
      
      setCurrentStep('preview')
      
      if (duplicates.length > 0) {
        console.log(`检测到 ${duplicates.length} 个重复任务，已自动排除`)
      }

    } catch (error) {
      console.error('解析iCal文件失败:', error)
      setError(error instanceof Error ? error.message : '文件解析失败，请检查文件格式是否正确')
    } finally {
      setIsLoading(false)
      // 清空文件输入
      event.target.value = ''
    }
  }

  /**
   * 解析iCal URL
   */
  const handleParseUrl = async () => {
    if (!iCalUrl.trim()) {
      setError('请输入Canvas日历的iCal链接')
      return
    }

    if (!canvasImportService.validateICalUrl(iCalUrl)) {
      setError('请输入有效的URL链接')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('开始解析Canvas iCal:', iCalUrl)
      const events = await canvasImportService.parseICalFromUrl(iCalUrl)
      console.log('解析到的事件:', events)

      if (events.length === 0) {
        setError('未在该日历中找到任何事件，请检查链接是否正确')
        return
      }

      // 转换为任务格式
      const tasks = canvasImportService.convertEventsToTasks(events)
      
      // 检测重复任务
      const { unique, duplicates } = canvasImportService.detectDuplicateTasks(tasks, existingTasks)
      
      setCanvasEvents(events)
      setPreviewTasks(unique)
      
      // 默认选中所有非重复任务
      setSelectedTasks(new Set(unique.map((_, index) => index)))
      
      setCurrentStep('preview')
      
      if (duplicates.length > 0) {
        console.log(`检测到 ${duplicates.length} 个重复任务，已自动排除`)
      }

    } catch (error) {
      console.error('解析Canvas日历失败:', error)
      let errorMessage = '解析失败，请检查链接是否正确'
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // 提供更具体的错误提示
        if (error.message.includes('CORS')) {
          errorMessage = 'Canvas日历链接访问被阻止，请确保使用的是公开的iCal订阅链接'
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          errorMessage = 'Canvas日历链接不存在，请检查链接是否正确'
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage = 'Canvas日历链接需要认证，请确保使用的是公开的订阅链接'
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请检查网络连接或稍后重试'
        }
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 切换任务选择状态
   */
  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTasks(newSelected)
  }

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    if (selectedTasks.size === previewTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(previewTasks.map((_, index) => index)))
    }
  }

  /**
   * 开始导入任务
   */
  const handleImportTasks = async () => {
    if (selectedTasks.size === 0) {
      setError('请至少选择一个任务进行导入')
      return
    }

    setCurrentStep('importing')
    setError(null)
    setImportProgress({ current: 0, total: selectedTasks.size })

    let imported = 0
    let errors = 0
    const importedTasks: Task[] = []

    try {
      const selectedTasksArray = Array.from(selectedTasks).map(index => previewTasks[index])

      for (let i = 0; i < selectedTasksArray.length; i++) {
        const task = selectedTasksArray[i]
        setImportProgress({ current: i + 1, total: selectedTasksArray.length })

        try {
          const result = await createTask(task)
          if (result.task) {
            imported++
            importedTasks.push(result.task)
          } else {
            errors++
            console.error('创建任务失败:', result.error)
          }
        } catch (error) {
          errors++
          console.error('创建任务异常:', error)
        }

        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setImportResult({
        imported,
        skipped: 0, // Canvas导入中重复任务已在预览阶段过滤
        errors
      })

      setCurrentStep('complete')
      
      if (importedTasks.length > 0) {
        onTasksImported(importedTasks)
      }

    } catch (error) {
      console.error('批量导入失败:', error)
      setError('导入过程中发生错误，请重试')
      setCurrentStep('preview')
    }
  }

  /**
   * 重新开始
   */
  const handleRestart = () => {
    setCurrentStep('url')
    setICalUrl('')
    setCanvasEvents([])
    setPreviewTasks([])
    setSelectedTasks(new Set())
    setError(null)
    setImportResult(null)
    setImportProgress({ current: 0, total: 0 })
  }

  /**
   * 格式化事件类型显示
   */
  const formatEventType = (type: 'assignment' | 'exam' | 'event') => {
    switch (type) {
      case 'assignment': return { text: '作业', color: 'bg-blue-100 text-blue-800' }
      case 'exam': return { text: '考试', color: 'bg-red-100 text-red-800' }
      case 'event': return { text: '事件', color: 'bg-gray-100 text-gray-800' }
    }
  }

  /**
   * 格式化优先级显示
   */
  const formatPriority = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return { text: '高', color: 'bg-red-100 text-red-800' }
      case 'medium': return { text: '中', color: 'bg-yellow-100 text-yellow-800' }
      case 'low': return { text: '低', color: 'bg-green-100 text-green-800' }
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Canvas 日历导入</h2>
            <p className="text-sm text-gray-500">从Canvas日历订阅链接导入作业和课程事件</p>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {/* 步骤1: URL输入 */}
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'url' ? 'bg-blue-600 text-white' : 
              ['preview', 'importing', 'complete'].includes(currentStep) ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <span className={`ml-2 text-sm font-medium ${
              currentStep === 'url' ? 'text-blue-600' : 
              ['preview', 'importing', 'complete'].includes(currentStep) ? 'text-green-600' : 'text-gray-500'
            }`}>
              输入链接
            </span>
          </div>

          <div className="w-12 h-px bg-gray-300"></div>

          {/* 步骤2: 预览 */}
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'preview' ? 'bg-blue-600 text-white' : 
              ['importing', 'complete'].includes(currentStep) ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <span className={`ml-2 text-sm font-medium ${
              currentStep === 'preview' ? 'text-blue-600' : 
              ['importing', 'complete'].includes(currentStep) ? 'text-green-600' : 'text-gray-500'
            }`}>
              预览任务
            </span>
          </div>

          <div className="w-12 h-px bg-gray-300"></div>

          {/* 步骤3: 导入 */}
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              ['importing', 'complete'].includes(currentStep) ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              3
            </div>
            <span className={`ml-2 text-sm font-medium ${
              ['importing', 'complete'].includes(currentStep) ? 'text-blue-600' : 'text-gray-500'
            }`}>
              导入完成
            </span>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* 步骤1: URL输入 */}
      {currentStep === 'url' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Canvas日历iCal链接
            </label>
            <div className="space-y-3">
              <input
                type="url"
                value={iCalUrl}
                onChange={(e) => setICalUrl(e.target.value)}
                placeholder="https://canvas.example.com/feeds/calendars/user_..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-600">
                在Canvas中进入日历页面，点击"日历订阅"获取iCal链接
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">方法一：获取Canvas日历订阅链接</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside mb-3">
                <li>登录你的Canvas账户</li>
                <li>进入"日历"页面</li>
                <li>点击右侧的"日历订阅"或"Calendar Feed"按钮</li>
                <li>复制显示的iCal链接（通常以.ics结尾）</li>
                <li>将链接粘贴到上方输入框中</li>
              </ol>
              <div className="p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-green-800">
                  <strong>推荐：</strong>这种方法通常包含认证信息，成功率最高。
                </p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-orange-900 mb-2">方法二：手动下载iCal文件</h4>
              <p className="text-sm text-orange-800 mb-2">如果上述方法失败，可以尝试：</p>
              <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside mb-3">
                <li>在Canvas日历页面，选择要导出的日期范围</li>
                <li>点击"导出"或"Export"按钮</li>
                <li>下载.ics文件到本地</li>
                <li>使用下方的文件上传功能</li>
              </ol>
              <button
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="text-sm text-orange-600 hover:text-orange-800 underline"
              >
                {showFileUpload ? '隐藏' : '显示'}文件上传选项
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-2">常见问题解决</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li><strong>认证失败：</strong>确保使用完整的订阅链接，包含所有参数</li>
                <li><strong>链接过期：</strong>重新生成日历订阅链接</li>
                <li><strong>权限问题：</strong>检查Canvas账户是否有日历访问权限</li>
                <li><strong>网络问题：</strong>尝试使用文件上传方式</li>
              </ul>
            </div>
          </div>

          {/* 文件上传选项 */}
          {showFileUpload && (
            <div className="border-t border-gray-200 pt-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">上传iCal文件</h4>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">点击上传</span> 或拖拽文件到此处
                      </p>
                      <p className="text-xs text-gray-500">支持 .ics 格式的日历文件</p>
                    </div>
                    <input
                      type="file"
                      accept=".ics,.ical,text/calendar"
                      onChange={handleFileUpload}
                      disabled={isLoading}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  从Canvas导出的.ics文件通常包含所有必要的事件信息，无需网络连接即可解析。
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            {showFileUpload && (
              <button
                onClick={() => setShowFileUpload(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                隐藏文件上传
              </button>
            )}
            <button
              onClick={handleParseUrl}
              disabled={isLoading || !iCalUrl.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{isLoading ? '解析中...' : '解析链接'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 步骤2: 任务预览 */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              找到 {previewTasks.length} 个任务
            </h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedTasks.size === previewTasks.length ? '取消全选' : '全选'}
              </button>
              <span className="text-sm text-gray-500">
                已选择 {selectedTasks.size} / {previewTasks.length}
              </span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {previewTasks.map((task, index) => {
              const event = canvasEvents[index]
              const isSelected = selectedTasks.has(index)
              const eventType = formatEventType(event?.type || 'event')
              const priority = formatPriority(task.priority)

              return (
                <div
                  key={index}
                  className={`p-4 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => toggleTaskSelection(index)}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTaskSelection(index)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${eventType.color}`}>
                          {eventType.text}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${priority.color}`}>
                          {priority.text}
                        </span>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      
                      {task.deadline_datetime && (
                        <p className="text-sm text-gray-500">
                          截止时间: {new Date(task.deadline_datetime).toLocaleString('zh-CN')}
                        </p>
                      )}
                      
                      {event?.courseName && (
                        <p className="text-sm text-blue-600">
                          课程: {event.courseName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleRestart}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              重新开始
            </button>
            <button
              onClick={handleImportTasks}
              disabled={selectedTasks.size === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              导入选中任务 ({selectedTasks.size})
            </button>
          </div>
        </div>
      )}

      {/* 步骤3: 导入进度 */}
      {currentStep === 'importing' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">正在导入任务...</h3>
            <p className="text-sm text-gray-600">
              正在导入第 {importProgress.current} / {importProgress.total} 个任务
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
              style={{
                width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* 步骤4: 导入完成 */}
      {currentStep === 'complete' && importResult && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">导入完成！</h3>
            <p className="text-sm text-gray-600">Canvas任务已成功导入到你的任务列表中</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">导入结果</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-gray-600">成功导入</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-500">{importResult.skipped}</div>
                <div className="text-sm text-gray-600">跳过重复</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{importResult.errors}</div>
                <div className="text-sm text-gray-600">导入失败</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleRestart}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              导入更多任务
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
