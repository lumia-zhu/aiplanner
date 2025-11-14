'use client'

import React, { memo, useRef, useState, useEffect } from 'react'
import { doubaoService, type ChatMessage } from '@/lib/doubaoService'
import type { Task, WorkflowMode, PrioritySortFeeling, SingleTaskAction, SubtaskSuggestion } from '@/types'
import { getAgentConfig } from '@/lib/agent/AgentConfig'
import WorkflowOptions from './WorkflowOptions'
import FeelingOptions from './FeelingOptions'
import SingleTaskActionOptions from './SingleTaskActionOptions'
import TaskSelectionOptions from './TaskSelectionOptions'
import TaskDecompositionCard from './TaskDecompositionCard'
import DecompositionContextInput from './DecompositionContextInput'
import ClarificationConfirmOptions from './ClarificationConfirmOptions'
import TimeEstimationInput from './TimeEstimationInput'
import EstimationConfirmOptions from './EstimationConfirmOptions'
import InteractiveButtons from './InteractiveButtons'
import AgentThoughtCard from './AgentThoughtCard'
import AgentActionCard from './AgentActionCard'
import AgentObservationCard from './AgentObservationCard'
import AgentNeedInputCard from './AgentNeedInputCard'
import AgentLoadingIndicator from './AgentLoadingIndicator'
import TaskListCard from './TaskListCard'
import type { TaskForDisplay } from './TaskListCard'

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

interface ChatSidebarProps {
  // 侧边栏状态
  isOpen: boolean
  onToggle: () => void
  
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
  isImageProcessing: boolean
  
  // 任务识别相关状态
  isTaskRecognitionMode: boolean
  setIsTaskRecognitionMode: (mode: boolean) => void
  recognizedTasks: RecognizedTask[]
  showTaskPreview: boolean
  setShowTaskPreview: (show: boolean) => void
  
  // 工作流辅助相关状态
  workflowMode?: WorkflowMode
  currentTasks?: Task[]
  onWorkflowOptionSelect?: (optionId: 'A' | 'B' | 'C') => void
  onFeelingSelect?: (feeling: PrioritySortFeeling) => void
  onActionSelect?: (action: SingleTaskAction) => void
  onTaskSelect?: (task: Task | null) => void
  onContextSubmit?: (context: string) => void
  isWorkflowAnalyzing?: boolean
  
  // 任务拆解相关回调
  onDecompositionConfirm?: (parentTask: Task, subtasks: SubtaskSuggestion[]) => void
  onDecompositionCancel?: (parentTask: Task) => void
  onDecompositionContextSubmit?: (userInput: string) => void  // ⭐ 拆解上下文提交
  onDecompositionContextSkip?: () => void  // ⭐ 跳过拆解问题
  
  // 任务澄清相关回调
  onClarificationSubmit?: (answer: string) => void
  onClarificationSkip?: () => void  // ⭐ 跳过澄清问题
  onClarificationCancel?: () => void  // ⭐ 取消任务澄清
  onClarificationConfirm?: () => void
  onClarificationReject?: () => void
  hasStructuredContext?: boolean  // 是否有结构化上下文（用于显示确认/修正按钮）
  editableText?: string  // ⭐ 可编辑的澄清文本
  setEditableText?: (text: string) => void  // ⭐ 设置可编辑文本
  handleConfirmEdit?: () => void  // ⭐ 确认编辑
  handleCancelEdit?: () => void  // ⭐ 取消编辑
  
  // 任务拆解上下文相关回调
  onContextSkip?: () => void  // ⭐ 跳过任务上下文输入
  onContextCancel?: () => void  // ⭐ 取消任务拆解
  
  // ⭐ 时间估算相关回调
  onEstimationSubmit?: (minutes: number) => void
  onEstimationResubmit?: (minutes: number) => void  // 反思后重新提交
  onEstimationConfirm?: (withBuffer: boolean) => void
  onEstimationCancel?: () => void
  estimationInitial?: number | null  // 初始估计分钟数（用于显示确认按钮）
  
  // ⭐ Agent 相关回调
  onAgentInputSubmit?: (userInput: string, context: any) => void  // Agent 交互式输入提交
  isAgentRunning?: boolean  // Agent 是否正在运行
  
  // ⭐ 通用按钮点击回调
  onButtonClick?: (buttonId: string, context: any) => void
  
  // 🆕 任务列表卡片的任务勾选回调
  onTaskToggleFromList?: (taskId: string, noteId: string, newCompletedState: boolean) => void  // 通用交互按钮点击
  
  // 事件处理函数
  handleSendMessage: () => void
  handleClearChat: () => void
  handleDragEnter: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleAddSelectedTasks: () => void
  handleToggleAllTasks: (checked: boolean) => void
  handleToggleTask: (taskId: string, checked: boolean) => void
  handleImageSelect: (file: File) => void
  handleVoiceClick: () => void
  handlePaste: (e: React.ClipboardEvent) => void
  
  // Refs
  chatScrollRef: React.RefObject<HTMLDivElement | null>
}

const ChatSidebar = memo<ChatSidebarProps>(({
  isOpen,
  onToggle,
  chatMessage,
  setChatMessage,
  selectedImage,
  setSelectedImage,
  chatMessages,
  setChatMessages,
  isSending,
  streamingMessage,
  isDragOver,
  isImageProcessing,
  isTaskRecognitionMode,
  setIsTaskRecognitionMode,
  recognizedTasks,
  showTaskPreview,
  setShowTaskPreview,
  workflowMode,
  currentTasks,
  onWorkflowOptionSelect,
  onFeelingSelect,
  onActionSelect,
  onTaskSelect,
  onContextSubmit,
  isWorkflowAnalyzing,
  onDecompositionConfirm,
  onDecompositionCancel,
  onDecompositionContextSubmit,
  onDecompositionContextSkip,
  onClarificationSubmit,
  onClarificationSkip,  // ⭐ 新增
  onClarificationCancel,  // ⭐ 新增
  onClarificationConfirm,
  onClarificationReject,
  hasStructuredContext,
  editableText,
  setEditableText,
  handleConfirmEdit,
  handleCancelEdit,
  onContextSkip,  // ⭐ 新增
  onContextCancel,  // ⭐ 新增
  onEstimationSubmit,
  onEstimationResubmit,
  onEstimationConfirm,
  onEstimationCancel,
  estimationInitial,
  onAgentInputSubmit,  // ⭐ Agent 交互式输入
  isAgentRunning,  // ⭐ Agent 运行状态
  onButtonClick,  // ⭐ 通用按钮点击
  onTaskToggleFromList,  // 🆕 任务列表勾选
  handleSendMessage,
  handleClearChat,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleAddSelectedTasks,
  handleToggleAllTasks,
  handleToggleTask,
  handleImageSelect,
  handleVoiceClick,
  handlePaste,
  chatScrollRef
}) => {
  
  // ⭐ Agent 模式状态管理
  const [isAgentMode, setIsAgentMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_assistant_mode')
      if (saved) {
        return saved === 'agent'
      }
    }
    return getAgentConfig().enabled
  })

  // 持久化 Agent 模式状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_assistant_mode', isAgentMode ? 'agent' : 'normal')
      console.log(`🔧 AI 助手模式切换为: ${isAgentMode ? 'Agent 模式' : '普通模式'}`)
    }
  }, [isAgentMode])
  
  // ⭐ 判断是否应该禁用输入框（引导用户使用按钮）
  const shouldDisableInput = (() => {
    // 特殊输入模式不禁用
    if (workflowMode === 'task-context-input' || workflowMode === 'task-clarification-input') {
      return false
    }
    
    // 以下模式需要禁用输入框，引导用户点击按钮
    const buttonGuidedModes: WorkflowMode[] = [
      'initial',                    // 初始选项（完善单个任务/排序/结束）
      'single-task-action',         // 单任务操作选项（澄清/拆解/估时）
      'task-selection',             // 任务选择（选择要操作的任务）
      'priority-feeling',           // ⭐ 优先级排序：询问感觉（截止日期临近/任务太多太乱/大脑一片空白）
      'clarification-edit',         // 澄清确认
      'task-estimation-buffer',     // 估时确认
    ]
    
    return workflowMode ? buttonGuidedModes.includes(workflowMode) : false
  })()
  
  return (
    <>

      {/* 侧边栏容器 */}
    <aside 
        className={`bg-white border border-gray-200 rounded-lg flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-[520px] opacity-100' : 'w-0 opacity-0 border-0'
        } overflow-hidden`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >

      {/* 展开状态的完整内容 */}
      {isOpen && (
        <>
      {/* 聊天头部 */}
      <div className="border-b border-gray-100 flex-shrink-0">
        {/* 第一行：折叠按钮 + 标题 + 清空对话 */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            {/* 折叠按钮 */}
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors -ml-1"
              title="收起AI助手"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2 flex-1 ml-2">
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
        
        {/* 第二行：Agent 模式切换开关 */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className={`text-xs font-medium ${
            isAgentMode ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {isAgentMode ? '🤖 Agent 模式' : '💬 普通模式'}
          </span>
          
          <button
            onClick={() => setIsAgentMode(!isAgentMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isAgentMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            title={isAgentMode ? '切换到普通模式' : '切换到 Agent 模式（开发中）'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isAgentMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      
      {/* 聊天消息区域 */}
      <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto bg-gray-50 relative min-h-0">
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
          {chatMessages.length === 0 ? null : (
            /* 聊天消息 */
            chatMessages.map((message, index) => (
              <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {message.role === 'user' ? (
                  <img src="/user-avatar.svg" alt="我" className="w-8 h-8 rounded-full flex-shrink-0" />
                ) : (
                  <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
                )}
                <div className={`rounded-lg px-3 py-2 shadow-sm max-w-[80%] ${
                  message.role === 'user' ? 'bg-green-100' : 'bg-white'
                }`}>
                  {message.content.map((content, contentIndex) => (
                    <div key={contentIndex}>
                      {content.type === 'text' && content.text && (
                        <div>
                          {content.text.startsWith('🔍 智能任务识别中...') ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">🔍</span>
                                <span className="text-sm font-medium text-green-700">智能任务识别</span>
                              </div>
                              {content.text.includes('\n用户输入：') && (
                                <div className="pl-6">
                                  <p className="text-xs text-gray-600">
                                    {content.text.split('\n用户输入：')[1]}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#3f3f3f' }}>
                          {content.text}
                        </p>
                          )}
                        </div>
                      )}
                      {content.type === 'image_url' && content.image_url && (
                        <div className="mt-2">
                        <img 
                          src={content.image_url.url} 
                          alt="上传的图片" 
                            className="max-w-full h-auto rounded border border-gray-200"
                          style={{ maxHeight: '150px' }}
                        />
                          <p className="text-xs text-gray-500 mt-1">📸 已上传图片</p>
                        </div>
                      )}
                      {/* 🆕 任务列表卡片 */}
                      {content.type === 'task-list' && content.taskList && (
                        <div className="mt-2">
                          <TaskListCard
                            tasks={content.taskList.tasks as TaskForDisplay[]}
                            totalCount={content.taskList.totalCount}
                            onTaskToggle={(taskId, noteId, newCompletedState) => {
                              if (onTaskToggleFromList) {
                                onTaskToggleFromList(taskId, noteId, newCompletedState)
                              }
                            }}
                          />
                        </div>
                      )}
                      {content.type === 'interactive' && content.interactive && (
                        <div className="mt-2">
                          {/* 任务拆解上下文输入卡片 */}
                          {content.interactive.type === 'decomposition-context-input' && (
                            <DecompositionContextInput
                              taskTitle={content.interactive.data.taskTitle}
                              questions={content.interactive.data.questions}
                              isActive={content.interactive.isActive !== false}
                              onSubmit={(userInput) => {
                                if (onDecompositionContextSubmit) {
                                  onDecompositionContextSubmit(userInput)
                                }
                              }}
                              onSkip={() => {
                                if (onDecompositionContextSkip) {
                                  onDecompositionContextSkip()
                                }
                              }}
                            />
                          )}
                          
                          {/* 任务拆解交互式卡片 */}
                          {content.interactive.type === 'task-decomposition' && (
                            <TaskDecompositionCard
                              parentTask={content.interactive.data.parentTask}
                              suggestions={content.interactive.data.suggestions}
                              isActive={content.interactive.isActive !== false}
                              onConfirm={(subtasks) => {
                                if (onDecompositionConfirm) {
                                  onDecompositionConfirm(content.interactive!.data.parentTask, subtasks)
                                }
                              }}
                              onCancel={() => {
                                if (onDecompositionCancel) {
                                  onDecompositionCancel(content.interactive!.data.parentTask)
                                }
                              }}
                            />
                          )}
                          
                          {/* ⭐ 通用按钮组 */}
                          {content.interactive.type === 'buttons' && content.interactive.data?.buttons && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {content.interactive.data.buttons.map((button: any) => (
                                <button
                                  key={button.id}
                                  onClick={() => {
                                    if (onButtonClick && content.interactive?.isActive !== false) {
                                      onButtonClick(button.id, content.interactive?.data?.context)
                                    }
                                  }}
                                  disabled={content.interactive?.isActive === false}
                                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    button.variant === 'secondary'
                                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                      : 'bg-blue-500 text-white hover:bg-blue-600'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {button.label}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* 通用交互按钮 */}
                          {['workflow-options', 'single-task-action', 'feeling-options', 
                            'task-selection', 'clarification-confirm', 'estimation-confirm'
                           ].includes(content.interactive.type) && (
                            <InteractiveButtons
                              interactive={content.interactive}
                              onWorkflowOptionSelect={onWorkflowOptionSelect}
                              onActionSelect={onActionSelect}
                              onFeelingSelect={onFeelingSelect}
                              onTaskSelect={onTaskSelect}
                              onClarificationConfirm={onClarificationConfirm}
                              onClarificationReject={onClarificationReject}
                              onEstimationConfirm={onEstimationConfirm}
                              currentTasks={currentTasks}
                            />
                          )}
                          
                          {/* ⭐ Agent 消息类型渲染 */}
                          {/* Agent Thought 卡片 */}
                          {content.interactive.type === 'agent-thought' && (
                            <AgentThoughtCard data={content.interactive.data} />
                          )}
                          
                          {/* Agent Action 卡片 */}
                          {content.interactive.type === 'agent-action' && (
                            <AgentActionCard data={content.interactive.data} />
                          )}
                          
                          {/* Agent Observation 卡片 */}
                          {content.interactive.type === 'agent-observation' && (
                            <AgentObservationCard data={content.interactive.data} />
                          )}
                          
                          {/* Agent Need Input 卡片 */}
                          {content.interactive.type === 'agent-need-input' && (
                            <AgentNeedInputCard 
                              data={content.interactive.data}
                              isActive={content.interactive.isActive !== false}
                              onSubmit={(userInput) => {
                                // ⭐ 修复：即使 context 为 null 也应该允许提交
                                if (onAgentInputSubmit) {
                                  onAgentInputSubmit(userInput, content.interactive?.data.context || null)
                                }
                              }}
                            />
                          )}
                          
                          {/* Agent Loading 指示器 */}
                          {content.interactive.type === 'agent-loading' && (
                            <AgentLoadingIndicator />
                          )}
                          
                          {/* Agent Error 卡片 */}
                          {content.interactive.type === 'agent-error' && (
                            <div className="my-2 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                              <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-red-700 mb-1">
                                    ❌ Agent 执行错误
                                  </p>
                                  <p className="text-sm text-red-600">
                                    {content.interactive.data.error || '未知错误'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          
          {/* 流式输出和发送中指示器（⭐ Agent模式下不显示） */}
          {isSending && !streamingMessage && !isAgentRunning && (
            <div className="flex items-start gap-3">
              <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-xs text-gray-500 ml-2">
                    {isTaskRecognitionMode ? '🔍 正在识别任务信息...' : 'AI正在思考...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {streamingMessage && !isTaskRecognitionMode && (
            <div className="flex items-start gap-3">
              <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[80%]">
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
                        {task.deadline_date || task.deadline_time ? (
                          <span className="text-xs text-gray-500 bg-blue-100 px-1 py-0.5 rounded">
                            {task.deadline_date && task.deadline_time ? 
                              `${task.deadline_date} ${task.deadline_time}` :
                              task.deadline_date ? 
                                `${task.deadline_date} 23:59` :
                                `今天 ${task.deadline_time}`
                            }
                          </span>
                        ) : (
                          <span className="text-xs text-orange-600 bg-orange-100 px-1 py-0.5 rounded">
                            无截止时间
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
      
      {/* ⭐ 时间估算输入区域（初始） */}
      {workflowMode === 'task-estimation-input' && onEstimationSubmit && onEstimationCancel && (
        <div className="border-t border-gray-200 bg-gradient-to-b from-blue-50 to-white flex-shrink-0">
          <div className="p-4">
            <TimeEstimationInput
              onSubmit={onEstimationSubmit}
              onCancel={onEstimationCancel}
            />
          </div>
        </div>
      )}
      
      {/* ⭐ 时间估算输入区域（反思后重新输入） */}
      {workflowMode === 'task-estimation-reflection' && onEstimationResubmit && onEstimationCancel && (
        <div className="border-t border-gray-200 bg-gradient-to-b from-purple-50 to-white flex-shrink-0">
          <div className="p-4">
            <TimeEstimationInput
              onSubmit={onEstimationResubmit}
              onCancel={onEstimationCancel}
              defaultValue={estimationInitial || 60}
            />
          </div>
        </div>
      )}
      
      {/* ⭐ 时间估算Buffer确认区域 */}
      {workflowMode === 'task-estimation-buffer' && estimationInitial && onEstimationConfirm && onEstimationCancel && (
        <div className="border-t border-gray-200 bg-gradient-to-b from-yellow-50 to-white flex-shrink-0">
          <div className="p-4">
            <EstimationConfirmOptions
              estimateMinutes={estimationInitial}
              onConfirmWithBuffer={() => onEstimationConfirm(true)}
              onConfirmWithoutBuffer={() => onEstimationConfirm(false)}
              onCancel={onEstimationCancel}
              disabled={isSending}
            />
          </div>
        </div>
      )}
      
      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        {/* 显示选中的图片 */}
              {selectedImage && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
                    <img 
                      src={URL.createObjectURL(selectedImage)} 
                      alt="待发送的图片" 
                      className="w-12 h-12 object-cover rounded"
                    />
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">{selectedImage.name}</p>
                <p className="text-xs text-blue-600">
                  {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
                    <button
                      onClick={() => setSelectedImage(null)}
                className="text-blue-600 hover:text-blue-800 p-1"
                    >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                    </button>
                  </div>
                </div>
        )}

        <div className="flex items-stretch gap-2">
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
              disabled={shouldDisableInput}
            />
            <div className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${
              shouldDisableInput
                ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                : isImageProcessing 
                  ? 'border-blue-500 text-blue-500 bg-white cursor-pointer' 
                  : 'border-gray-300 text-gray-500 hover:text-blue-500 hover:bg-blue-50 bg-white cursor-pointer'
            }`}
            title={shouldDisableInput ? "请先选择上方操作" : "上传图片"}
            >
              {isImageProcessing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>

          {/* 输入框 */}
          <textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // 根据模式处理发送
                if (workflowMode === 'task-context-input' && onContextSubmit) {
                  // 提交任务拆解上下文
                  if (chatMessage.trim()) {
                    onContextSubmit(chatMessage.trim())
                    setChatMessage('')
                  }
                } else if (workflowMode === 'task-clarification-input' && onClarificationSubmit) {
                  // 提交澄清回答
                  if (chatMessage.trim()) {
                    onClarificationSubmit(chatMessage.trim())
                    setChatMessage('')
                  }
                } else {
                  handleSendMessage()
                }
              }
            }}
            onPaste={handlePaste}
            disabled={shouldDisableInput || isSending || (isAgentRunning && !shouldDisableInput)}
            placeholder={
              isAgentRunning
                ? "🤖 Agent 正在思考，请稍候..."
                : shouldDisableInput
                  ? "💡 请点击上方按钮选择操作"
                  : workflowMode === 'task-context-input'
                    ? "请描述任务的背景信息..."
                    : workflowMode === 'task-clarification-input'
                      ? "请回答上面的问题..."
                      : isTaskRecognitionMode 
                        ? "描述任务内容或上传包含任务的图片..." 
                        : doubaoService.hasApiKey() ? "输入消息或粘贴图片(Ctrl+V)..." : "请先配置API Key"
            }
            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all duration-200 resize-none h-10 ${
              isAgentRunning && !shouldDisableInput
                ? 'bg-purple-50 border-purple-300 text-gray-400 placeholder-gray-500 cursor-not-allowed'
                : shouldDisableInput
                  ? 'bg-gray-100 border-gray-200 text-gray-400 placeholder-gray-400 cursor-not-allowed'
                  : workflowMode === 'task-context-input'
                    ? 'border-blue-500 focus:ring-blue-500 bg-blue-50 ring-4 ring-blue-300/50 shadow-lg animate-pulse text-gray-900 placeholder-gray-500'
                    : workflowMode === 'task-clarification-input'
                      ? 'border-purple-500 focus:ring-purple-500 bg-purple-50 ring-4 ring-purple-300/50 shadow-lg animate-pulse text-gray-900 placeholder-gray-500'
                      : isTaskRecognitionMode 
                        ? 'border-green-300 focus:ring-green-500 bg-green-50 text-gray-900 placeholder-gray-500' 
                        : 'border-gray-300 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500'
            }`}
            rows={1}
            style={{ 
              lineHeight: '1.2', 
              minHeight: '40px',
              maxHeight: '40px',
              verticalAlign: 'top'
            }}
          />

          {/* 语音按钮 */}
          <div className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${
            shouldDisableInput
              ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50 border-gray-300 bg-white cursor-pointer'
          }`}
            onClick={shouldDisableInput ? undefined : handleVoiceClick}
            title={shouldDisableInput ? "请先选择上方操作" : "语音输入"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>

          {/* 发送按钮 */}
          <div
            onClick={() => {
              // 如果禁用，不处理点击
              if (shouldDisableInput) return
              
              // 根据模式处理发送
              if (workflowMode === 'task-context-input' && onContextSubmit) {
                // 提交任务拆解上下文
                if (chatMessage.trim()) {
                  onContextSubmit(chatMessage.trim())
                  setChatMessage('')
                }
              } else if (workflowMode === 'task-clarification-input' && onClarificationSubmit) {
                // 提交澄清回答
                if (chatMessage.trim()) {
                  onClarificationSubmit(chatMessage.trim())
                  setChatMessage('')
                }
              } else {
                // 普通消息发送
                if ((chatMessage.trim() || selectedImage) && doubaoService.hasApiKey() && !isSending) {
                  handleSendMessage()
                }
              }
            }}
            className={`h-10 px-4 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 border ${
              shouldDisableInput
                ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
                : workflowMode === 'task-context-input'
                  ? (!chatMessage.trim() || isSending
                      ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 cursor-pointer')
                  : workflowMode === 'task-clarification-input'
                    ? (!chatMessage.trim() || isSending
                        ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                        : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 cursor-pointer')
                    : ((!chatMessage.trim() && !selectedImage) || !doubaoService.hasApiKey() || isSending
                        ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                        : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 cursor-pointer')
            }`}
          >
            {isSending ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>发送中</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>{workflowMode === 'task-context-input' || workflowMode === 'task-clarification-input' ? '提交' : '发送'}</span>
              </>
            )}
          </div>
        </div>

        {/* ⭐ 任务拆解上下文：跳过/取消按钮 */}
        {workflowMode === 'task-context-input' && (onContextSkip || onContextCancel) && (
          <div className="px-4 py-3 flex gap-3 bg-blue-50/30 border-t border-blue-200">
            {onContextSkip && (
              <button
                onClick={onContextSkip}
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                跳过
              </button>
            )}
            {onContextCancel && (
              <button
                onClick={onContextCancel}
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 border border-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
            )}
          </div>
        )}

        {/* ⭐ 任务澄清：取消按钮 */}
        {workflowMode === 'task-clarification-input' && onClarificationCancel && (
          <div className="px-4 py-3 flex justify-center bg-purple-50/30 border-t border-purple-200">
            <button
              onClick={onClarificationCancel}
              disabled={isSending}
              className="px-6 py-2.5 text-sm font-medium text-white bg-red-500 border border-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
          </div>
        )}

        {/* ⭐ 任务澄清编辑模式 */}
        {workflowMode === 'clarification-edit' && editableText !== undefined && (
          <div className="px-4 py-4 bg-yellow-50/30 border-t border-yellow-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💡 编辑任务信息（可修改任何内容）：
            </label>
            <textarea
              value={editableText}
              onChange={(e) => setEditableText?.(e.target.value)}
              onKeyDown={(e) => {
                // 按Enter键时，插入新的列表项（带点号）
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const textarea = e.currentTarget
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = editableText || ''
                  
                  // 检查当前行是否已经是列表项
                  const beforeCursor = text.substring(0, start)
                  const currentLineStart = beforeCursor.lastIndexOf('\n') + 1
                  const currentLine = text.substring(currentLineStart, start)
                  
                  // 如果当前行以 "• " 开头，在下一行也添加 "• "
                  if (currentLine.trim().startsWith('•')) {
                    const newText = text.substring(0, end) + '\n• ' + text.substring(end)
                    setEditableText?.(newText)
                    
                    // 设置光标位置到新列表项后面
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = end + 3
                    }, 0)
                  } else {
                    // 否则正常换行
                    const newText = text.substring(0, end) + '\n' + text.substring(end)
                    setEditableText?.(newText)
                    
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = end + 1
                    }, 0)
                  }
                }
              }}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900 placeholder-gray-400 resize-y"
              placeholder="编辑任务详情..."
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleConfirmEdit}
                disabled={!editableText?.trim() || isSending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? '解析中...' : '✅ 确认修改'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ❌ 取消
              </button>
            </div>
          </div>
        )}
        
        {/* 任务识别开关 - 暂时隐藏 */}
        {/* <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">智能任务识别</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isTaskRecognitionMode 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isTaskRecognitionMode ? '已启用' : '已关闭'}
              </span>
            </div>

            <button
              onClick={() => setIsTaskRecognitionMode(!isTaskRecognitionMode)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                isTaskRecognitionMode ? 'bg-green-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isTaskRecognitionMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          {/* 模式提示 */}
          {/* {isTaskRecognitionMode && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-green-600">💡</span>
                <span>任务识别模式已启用：在输入框中描述任务或上传图片，AI将自动识别并提取任务信息</span>
              </div>
            </div>
          )} */}
        {/* </div> */}
      </div>
      </>
      )}
    </aside>
    </>
  )
})

ChatSidebar.displayName = 'ChatSidebar'

export default ChatSidebar
