'use client'

import { useState } from 'react'
import { microsoftAuth } from '@/lib/microsoftAuth'
import { outlookImport, ImportResult } from '@/lib/outlookImport'
import type { Task, TaskInput } from '@/types'

interface OutlookImportProps {
  existingTasks: Task[]
  onTasksImported: (count: number) => void
  createTask: (taskData: TaskInput) => Promise<{ task?: Task; error?: string }>
}

export default function OutlookImport({ existingTasks, onTasksImported, createTask }: OutlookImportProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, taskTitle: '' })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewTasks, setPreviewTasks] = useState<TaskInput[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 连接到 Microsoft 账户
  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const account = await microsoftAuth.login()
      if (account) {
        setIsConnected(true)
        console.log('✅ 已连接到 Microsoft 账户:', account.username)
      }
    } catch (error) {
      console.error('❌ 连接 Microsoft 账户失败:', error)
      alert('连接失败，请检查网络连接或稍后重试')
    } finally {
      setIsConnecting(false)
    }
  }

  // 断开连接
  const handleDisconnect = async () => {
    try {
      await microsoftAuth.logout()
      setIsConnected(false)
      setPreviewTasks([])
      setShowPreview(false)
      setImportResult(null)
      console.log('✅ 已断开 Microsoft 账户连接')
    } catch (error) {
      console.error('❌ 断开连接失败:', error)
    }
  }

  // 预览要导入的任务
  const handlePreview = async () => {
    if (!isConnected) {
      await handleConnect()
      if (!isConnected) return
    }

    setIsImporting(true)
    try {
      const tasks = await outlookImport.previewImportTasks()
      setPreviewTasks(tasks)
      setShowPreview(true)
      setSelectedTasks(new Set()) // 重置选择
      setSelectAll(false)
      console.log(`📋 预览到 ${tasks.length} 个任务`)
    } catch (error) {
      console.error('❌ 预览任务失败:', error)
      alert('获取任务失败，请确保已授权访问 Outlook 任务')
    } finally {
      setIsImporting(false)
    }
  }

  // 切换任务选择状态
  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTasks(newSelected)
    setSelectAll(newSelected.size === previewTasks.length)
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTasks(new Set())
      setSelectAll(false)
    } else {
      setSelectedTasks(new Set(previewTasks.map((_, index) => index)))
      setSelectAll(true)
    }
  }

  // 开始导入任务
  const handleImport = async () => {
    if (!isConnected) {
      await handleConnect()
      if (!isConnected) return
    }

    if (selectedTasks.size === 0) {
      alert('请至少选择一个任务进行导入')
      return
    }

    setIsImporting(true)
    setImportResult(null)
    
    try {
      // 获取选中的任务
      const selectedTasksArray = Array.from(selectedTasks).map(index => previewTasks[index])
      
      const result = await outlookImport.importSelectedTasks(
        selectedTasksArray,
        existingTasks,
        (current, total, taskTitle) => {
          setImportProgress({ current, total, taskTitle })
        },
        createTask
      )
      
      setImportResult(result)
      
      if (result.imported > 0) {
        onTasksImported(result.imported)
      }
      
      // 显示结果摘要
      if (result.imported > 0) {
        alert(`🎉 成功导入 ${result.imported} 个任务！\n跳过重复任务 ${result.skipped} 个\n${result.errors > 0 ? `失败 ${result.errors} 个` : ''}`)
      } else if (result.skipped > 0) {
        alert(`📭 所有选中的任务都已存在，跳过了 ${result.skipped} 个重复任务`)
      } else {
        alert('📭 没有可导入的任务')
      }
      
    } catch (error) {
      console.error('❌ 导入任务失败:', error)
      alert('导入失败：' + error)
    } finally {
      setIsImporting(false)
      setImportProgress({ current: 0, total: 0, taskTitle: '' })
    }
  }

  // 检查连接状态
  const checkConnection = () => {
    const connected = microsoftAuth.isLoggedIn()
    setIsConnected(connected)
    return connected
  }

  // 组件挂载时检查连接状态
  useState(() => {
    checkConnection()
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">📧</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Outlook 任务导入</h3>
            <p className="text-sm text-gray-600">从 Microsoft Outlook 导入你的任务</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isConnected && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ 已连接
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">连接你的 Microsoft 账户以开始导入任务</p>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
            >
              {isConnecting ? '连接中...' : '🔗 连接 Microsoft 账户'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 已连接状态的操作按钮 */}
            <div className="flex space-x-3">
              <button
                onClick={handlePreview}
                disabled={isImporting}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
              >
                {isImporting ? '获取中...' : '👀 预览任务'}
              </button>
              
              <button
                onClick={handleImport}
                disabled={isImporting || (showPreview && selectedTasks.size === 0)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
              >
                {isImporting ? '导入中...' : 
                 showPreview && selectedTasks.size > 0 ? `📥 导入选中的 ${selectedTasks.size} 个任务` :
                 '📥 开始导入'}
              </button>
              
              <button
                onClick={handleDisconnect}
                disabled={isImporting}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none disabled:opacity-50"
              >
                断开连接
              </button>
            </div>

            {/* 导入进度 */}
            {isImporting && importProgress.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    正在导入任务... ({importProgress.current}/{importProgress.total})
                  </span>
                  <span className="text-sm text-blue-600">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                {importProgress.taskTitle && (
                  <p className="text-xs text-blue-700 mt-2 truncate">
                    当前：{importProgress.taskTitle}
                  </p>
                )}
              </div>
            )}

            {/* 预览任务列表 */}
            {showPreview && previewTasks.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    预览任务 ({previewTasks.length} 个)
                  </h4>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      已选择 {selectedTasks.size} 个
                    </span>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">全选</span>
                    </label>
                  </div>
                </div>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {previewTasks.map((task, index) => (
                    <div key={index} className={`bg-white border rounded p-3 text-sm transition-all ${
                      selectedTasks.has(index) 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(index)}
                          onChange={() => toggleTaskSelection(index)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{task.title}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}优先级
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-gray-600 mt-1 text-xs line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center mt-2 space-x-4">
                            {task.deadline_time && (
                              <span className="text-gray-500 text-xs">{task.deadline_time}</span>
                            )}
                            {task.completed && (
                              <span className="text-green-600 text-xs">✅ 已完成</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 选择操作按钮 */}
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    💡 勾选你想要导入的任务，然后点击"开始导入"
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedTasks(new Set())}
                      disabled={selectedTasks.size === 0}
                      className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                    >
                      清空选择
                    </button>
                    <button
                      onClick={() => {
                        // 智能选择：选择未完成的任务
                        const uncompletedIndexes = previewTasks
                          .map((task, index) => ({ task, index }))
                          .filter(({ task }) => !task.completed)
                          .map(({ index }) => index)
                        setSelectedTasks(new Set(uncompletedIndexes))
                        setSelectAll(uncompletedIndexes.length === previewTasks.length)
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      选择未完成
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 导入结果 */}
            {importResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">导入完成</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">总任务数：</span>
                    <span className="font-medium">{importResult.total}</span>
                  </div>
                  <div>
                    <span className="text-green-700">成功导入：</span>
                    <span className="font-medium text-green-800">{importResult.imported}</span>
                  </div>
                  <div>
                    <span className="text-yellow-700">跳过重复：</span>
                    <span className="font-medium text-yellow-800">{importResult.skipped}</span>
                  </div>
                  <div>
                    <span className="text-red-700">导入失败：</span>
                    <span className="font-medium text-red-800">{importResult.errors}</span>
                  </div>
                </div>
                
                {importResult.errorDetails.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-red-700 font-medium mb-1">错误详情：</p>
                    <div className="max-h-24 overflow-y-auto text-xs text-red-600">
                      {importResult.errorDetails.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="mt-6 text-xs text-gray-500 space-y-1">
        <p><strong>💡 使用说明：</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>点击"连接 Microsoft 账户"授权访问你的 Outlook 任务</li>
          <li>使用"预览任务"查看将要导入的任务</li>
          <li>点击"开始导入"将任务添加到你的任务列表</li>
          <li>重复的任务会被自动跳过</li>
        </ul>
      </div>
    </div>
  )
}
