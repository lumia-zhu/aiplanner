'use client'

import React, { memo, useRef } from 'react'
import { doubaoService, type ChatMessage } from '@/lib/doubaoService'

// 任务识别相关类型
interface RecognizedTask {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  deadline_time?: string
  isSelected: boolean
}

interface ChatSidebarProps {
  // 聊天相关状态
  chatMessage: string
  setChatMessage: (message: string) => void
  selectedImage: File | null
  setSelectedImage: (image: File | null) => void
  chatMessages: ChatMessage[]
  setChatMessages: (messages: ChatMessage[]) => void
  isSending: boolean
  streamingMessage: string
  isDragOver: boolean
  
  // 任务识别相关状态
  isTaskRecognitionMode: boolean
  setIsTaskRecognitionMode: (mode: boolean) => void
  recognizedTasks: RecognizedTask[]
  showTaskPreview: boolean
  setShowTaskPreview: (show: boolean) => void
  
  // 事件处理函数
  handleSendMessage: () => void
  handleDragEnter: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleAddSelectedTasks: () => void
  handleToggleAllTasks: (checked: boolean) => void
  handleToggleTask: (taskId: string, checked: boolean) => void
  
  // Refs
  chatScrollRef: React.RefObject<HTMLDivElement | null>
}

const ChatSidebar = memo<ChatSidebarProps>(({
  chatMessage,
  setChatMessage,
  selectedImage,
  setSelectedImage,
  chatMessages,
  setChatMessages,
  isSending,
  streamingMessage,
  isDragOver,
  isTaskRecognitionMode,
  setIsTaskRecognitionMode,
  recognizedTasks,
  showTaskPreview,
  setShowTaskPreview,
  handleSendMessage,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleAddSelectedTasks,
  handleToggleAllTasks,
  handleToggleTask,
  chatScrollRef
}) => {
  return (
    <aside 
      className="w-[450px] bg-white border border-gray-200 rounded-lg flex flex-col h-full flex-shrink-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 聊天头部 */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${doubaoService.hasApiKey() ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm font-medium" style={{ color: '#3f3f3f' }}>
              AI 助手 {!doubaoService.hasApiKey() && '(需要配置API Key)'}
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
      <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto bg-gray-50 relative">
        {/* 拖拽提示覆盖层 */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-90 flex items-center justify-center z-10 rounded">
            <div className="text-center">
              <svg className="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
              </svg>
              <p className="text-blue-700 font-medium text-sm">拖拽图片到这里</p>
              <p className="text-blue-600 text-xs">支持 JPG, PNG, GIF 等格式</p>
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
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm flex-1">
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
                <div className={`rounded-lg px-3 py-2 shadow-sm flex-1 ${
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
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-xs text-gray-500 ml-2">AI正在思考...</span>
                </div>
              </div>
            </div>
          )}
          
          {streamingMessage && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">AI</span>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm flex-1">
                <p className="text-sm whitespace-pre-wrap" style={{ color: '#3f3f3f' }}>
                  {streamingMessage}
                  <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 任务识别结果预览 */}
      {showTaskPreview && recognizedTasks.length > 0 && (
        <div className="border-t border-gray-200 bg-green-50 max-h-60 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-green-100 bg-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-medium text-green-800">识别到 {recognizedTasks.length} 个任务</h3>
              </div>
              <button
                onClick={() => setShowTaskPreview(false)}
                className="text-green-600 hover:text-green-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-3">
            {/* 全选控制 */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={recognizedTasks.every(t => t.isSelected)}
                  onChange={(e) => handleToggleAllTasks(e.target.checked)}
                  className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">全选</span>
              </label>
              <button
                onClick={handleAddSelectedTasks}
                disabled={recognizedTasks.filter(t => t.isSelected).length === 0}
                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                添加选中 ({recognizedTasks.filter(t => t.isSelected).length})
              </button>
            </div>

            {/* 任务列表 */}
            <div className="space-y-2">
              {recognizedTasks.map((task) => (
                <div key={task.id} className="border border-gray-200 rounded p-2 hover:border-green-300 transition-colors">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={task.isSelected}
                      onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                      className="mt-0.5 h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <h4 className="text-xs font-medium text-gray-900">{task.title}</h4>
                        <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                          task.priority === 'high' ? 'bg-red-100 text-red-700' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                        </span>
                        {task.deadline_time ? (
                          <span className="text-xs text-gray-500 bg-blue-100 px-1 py-0.5 rounded">
                            {task.deadline_time.includes('T') ? 
                              new Date(task.deadline_time).toLocaleString('zh-CN') : 
                              task.deadline_time
                            }
                          </span>
                        ) : (
                          <span className="text-xs text-orange-600 bg-orange-100 px-1 py-0.5 rounded">
                            需要指定日期
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">{task.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <div className="relative">
              <textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={doubaoService.hasApiKey() ? "输入消息或粘贴图片(Ctrl+V)..." : "请先配置API Key"}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                rows={2}
                disabled={!doubaoService.hasApiKey() || isSending}
              />
              {selectedImage && (
                <div className="absolute top-1 right-1 bg-white rounded shadow-md p-1">
                  <div className="relative">
                    <img 
                      src={URL.createObjectURL(selectedImage)} 
                      alt="待发送的图片" 
                      className="w-12 h-12 object-cover rounded"
                    />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={(!chatMessage.trim() && !selectedImage) || !doubaoService.hasApiKey() || isSending}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
          >
            {isSending ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                发送中
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                发送
              </>
            )}
          </button>
        </div>
        
        {/* 任务识别开关 */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">智能任务识别</span>
              <span className="text-xs text-gray-500">
                {isTaskRecognitionMode ? '已启用' : '已关闭'}
              </span>
            </div>

            <button
              onClick={() => setIsTaskRecognitionMode(!isTaskRecognitionMode)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                isTaskRecognitionMode ? 'bg-green-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isTaskRecognitionMode ? 'translate-x-4' : 'translate-x-0'
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
    </aside>
  )
})

ChatSidebar.displayName = 'ChatSidebar'

export default ChatSidebar
