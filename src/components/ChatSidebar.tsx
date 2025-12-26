'use client'

import React, { memo, useRef, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
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
import { ReflectionQuickActions } from './ReflectionQuickActions'
import AddContextInfoModal from './AddContextInfoModal'
import type { QuestionAnswerPair } from '@/types/task-context'
import { AIThinkingIndicator, type ThinkingType } from './AIThinkingIndicator'

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

      // ⭐ 拆分步骤选择器组件
interface DecompositionSelectorProps {
  tasks: Array<{ id: string; title: string }>
  onSelect?: (taskIds: string[]) => void
  onSkip?: () => void
}

const DecompositionSelector: React.FC<DecompositionSelectorProps> = ({ tasks, onSelect, onSkip }) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  
  const toggleTask = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }
  
  const handleConfirm = () => {
    if (selectedIndices.size > 0 && onSelect) {
      const selectedTaskIds = Array.from(selectedIndices).map(i => tasks[i].id)
      onSelect(selectedTaskIds)
    }
  }
  
  return (
    <div className="border-t border-gray-200 bg-purple-50 p-3 flex-shrink-0">
      <div className="text-xs text-purple-600 mb-2 font-medium">✂️ 选择要拆解的任务</div>
      <div className="space-y-1.5 mb-3">
        {tasks.map((task, index) => {
          const isSelected = selectedIndices.has(index)
          const inputId = `decompose-task-${index}`
          return (
            <div
              key={inputId}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-purple-100 border border-purple-300' 
                  : 'bg-white border border-gray-200 hover:border-purple-200'
              }`}
              onClick={() => toggleTask(index)}
            >
              <input
                type="checkbox"
                id={inputId}
                checked={isSelected}
                onChange={() => toggleTask(index)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 flex-1 truncate">{task.title}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={selectedIndices.size === 0}
          className="flex-1 px-3 py-1.5 text-xs bg-purple-500 text-white hover:bg-purple-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          拆解选中的任务 ({selectedIndices.size})
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
        >
          跳过
        </button>
      </div>
    </div>
  )
}

// ⭐ 每日回顾 - 问题卡片组件
interface DailyReflectionQuestionCardProps {
  question: string
  questionNumber: number
  totalQuestions: number
  onAnswer: (answer: string) => void
  onSkip: () => void
  isActive: boolean
}

const DailyReflectionQuestionCard: React.FC<DailyReflectionQuestionCardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onSkip,
  isActive
}) => {
  const [answer, setAnswer] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // 自动聚焦输入框
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])
  
  const handleSubmit = () => {
    console.log('🔵 提交回答:', { answer, questionNumber, isActive })
    if (answer.trim() && isActive) {
      onAnswer(answer.trim())
      setAnswer('') // 立即清空输入框
    }
  }
  
  const handleSkipClick = () => {
    console.log('⏭️ 跳过问题:', { questionNumber, isActive })
    if (isActive) {
      onSkip()
      setAnswer('') // 清空输入框
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  // 如果卡片已禁用，显示已完成状态
  if (!isActive) {
    return (
      <div className="mt-3 p-4 bg-gray-100 rounded-lg border border-gray-200 opacity-70 min-h-[280px] w-full min-w-[320px] max-w-[400px]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500 font-medium">
            ✅ 每日回顾 · 问题 {questionNumber}/{totalQuestions}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-green-500"
              />
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-3 min-h-[60px]">
          {question}
        </div>
        <div className="text-xs text-gray-400 text-center py-2">
          已完成 ✨
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200 min-h-[280px] w-full min-w-[320px] max-w-[400px]">
      {/* 进度指示器 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-blue-600 font-medium">
          💭 每日回顾 · 问题 {questionNumber}/{totalQuestions}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < questionNumber - 1 
                  ? 'bg-blue-500' 
                  : i === questionNumber - 1 
                  ? 'bg-blue-300' 
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
      
      {/* 问题 */}
      <div className="text-sm font-medium text-gray-800 mb-3 min-h-[60px]">
        {question}
      </div>
      
      {/* 输入框 */}
      <textarea
        ref={textareaRef}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="在这里输入你的想法...（支持 Ctrl+Enter 提交）"
        disabled={!isActive}
        rows={4}
        className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
      />
      
      {/* 按钮 */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || !isActive}
          className="flex-1 px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          提交回答
        </button>
        <button
          onClick={handleSkipClick}
          disabled={!isActive}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          跳过
        </button>
      </div>
    </div>
  )
}

// ⭐ 每日回顾 - 完成卡片组件
interface DailyReflectionCompleteCardProps {
  summary: string
  onViewHistory?: () => void
  onClose: () => void
}

const DailyReflectionCompleteCard: React.FC<DailyReflectionCompleteCardProps> = ({
  summary,
  onViewHistory,
  onClose
}) => {
  return (
    <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200 w-full min-w-[320px] max-w-[400px]">
      <div className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
        <span className="text-2xl">🎉</span>
        <span>今日回顾已完成</span>
      </div>
      
      {/* AI 总结 */}
      <div className="bg-white rounded-lg p-3 mb-3">
        <div className="text-xs text-gray-500 mb-2 font-medium">AI 总结</div>
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {summary}
        </div>
      </div>
      
      {/* 按钮 */}
      <div className="flex gap-2">
        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="flex-1 px-4 py-2 text-sm font-medium text-green-700 hover:text-green-800 hover:bg-green-100 border border-green-300 rounded-lg transition-colors"
          >
            查看历史回顾
          </button>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

// ⭐ 每日回顾 - 已完成提示卡片
interface DailyReflectionAlreadyDoneCardProps {
  summary: string
  onViewHistory?: () => void
  onClear?: () => void  // 🆕 清空今日回顾
  onClose: () => void
}

const DailyReflectionAlreadyDoneCard: React.FC<DailyReflectionAlreadyDoneCardProps> = ({
  summary,
  onViewHistory,
  onClear,
  onClose
}) => {
  return (
    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200 w-full min-w-[320px] max-w-[400px]">
      <div className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
        <span className="text-2xl">✅</span>
        <span>今天已完成回顾</span>
      </div>
      
      <div className="text-xs text-gray-600 mb-3">
        你今天已经完成了每日回顾，明天再来吧！
      </div>
      
      {/* 显示今天的总结 */}
      {summary && (
        <div className="bg-white rounded-lg p-3 mb-3">
          <div className="text-xs text-gray-500 mb-2 font-medium">今日总结</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        </div>
      )}
      
      {/* 按钮 */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-100 border border-blue-300 rounded-lg transition-colors"
            >
              查看历史回顾
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
        {/* 🆕 清空今日回顾按钮 */}
        {onClear && (
          <button
            onClick={onClear}
            className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
          >
            清空今日回顾
          </button>
        )}
      </div>
    </div>
  )
}

// ⭐ 每日回顾 - 恢复提示卡片
interface DailyReflectionResumeCardProps {
  questionNumber: number
  totalQuestions: number
  onResume: () => void
  onRestart: () => void
}

const DailyReflectionResumeCard: React.FC<DailyReflectionResumeCardProps> = ({
  questionNumber,
  totalQuestions,
  onResume,
  onRestart
}) => {
  return (
    <div className="mt-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200 w-full min-w-[320px] max-w-[400px]">
      <div className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
        <span className="text-2xl">⏸️</span>
        <span>发现未完成的反思</span>
      </div>
      
      <div className="text-xs text-gray-600 mb-3">
        你还有未完成的每日回顾（已回答 {questionNumber}/{totalQuestions} 个问题），是否继续？
      </div>
      
      {/* 按钮 */}
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 px-4 py-2 text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 rounded-lg transition-colors"
        >
          继续反思
        </button>
        <button
          onClick={onRestart}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
        >
          重新开始
        </button>
      </div>
    </div>
  )
}

// ⭐ 每日回顾 - 历史记录卡片组件
interface DailyReflectionHistoryCardProps {
  reflections: Array<{
    id: string
    date: string
    question_1: string
    answer_1: string | null
    question_2: string
    answer_2: string | null
    question_3: string
    answer_3: string | null
    ai_summary: string | null
  }>
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  onClose: () => void
}

const DailyReflectionHistoryCard: React.FC<DailyReflectionHistoryCardProps> = ({
  reflections,
  hasMore,
  isLoading,
  onLoadMore,
  onClose
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]
    return `${month}月${day}日 ${weekday}`
  }
  
  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }
  
  return (
    <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200 w-full min-w-[320px] max-w-[400px]">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-purple-800 flex items-center gap-2">
          <span className="text-lg">📚</span>
          <span>历史回顾记录</span>
          <span className="text-xs text-purple-500">({reflections.length}条)</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* 反思列表 */}
      {reflections.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          暂无历史回顾记录
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {reflections.map((reflection) => (
            <div
              key={reflection.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* 折叠标题 */}
              <button
                onClick={() => toggleExpand(reflection.id)}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {formatDate(reflection.date)}
                  </div>
                  {reflection.ai_summary && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {reflection.ai_summary.slice(0, 50)}...
                    </div>
                  )}
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === reflection.id ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* 展开内容 */}
              {expandedId === reflection.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* AI 总结 */}
                  {reflection.ai_summary && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <div className="text-xs text-green-600 font-medium mb-1">✨ AI 总结</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {reflection.ai_summary}
                      </div>
                    </div>
                  )}
                  
                  {/* 问答内容 */}
                  <div className="mt-3 space-y-3">
                    {[1, 2, 3].map((num) => {
                      const question = reflection[`question_${num}` as keyof typeof reflection] as string
                      const answer = reflection[`answer_${num}` as keyof typeof reflection] as string | null
                      
                      return (
                        <div key={num} className="text-sm">
                          <div className="text-gray-600 font-medium mb-1">
                            Q{num}: {question}
                          </div>
                          <div className="text-gray-800 pl-4 border-l-2 border-purple-200">
                            {answer || <span className="text-gray-400 italic">（跳过）</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 加载更多 */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  )
}

// ⭐ 反思任务选择卡片组件
interface ReflectionTaskSelectionCardProps {
  tasks: Array<{ 
    id: string
    title: string
    isCompleted: boolean
    parent_task_id?: string | null
  }>
  roundType: 'clarity' | 'decomposition' | 'time' | 'priority'
  isActive: boolean
  onConfirm: (taskIds: string[]) => void
  onBack: () => void
  collapsedTasks?: Set<string>  // 被折叠的主任务ID集合
  onToggleCollapse?: (taskId: string) => void  // 切换折叠状态
}

const ReflectionTaskSelectionCard: React.FC<ReflectionTaskSelectionCardProps> = ({ 
  tasks, 
  roundType, 
  isActive,
  onConfirm, 
  onBack,
  collapsedTasks = new Set(),  // 默认空集合
  onToggleCollapse
}) => {
  // 🔧 根据轮次类型决定单选还是多选
  const isMultiSelect = roundType === 'priority'
  
  const [selectedId, setSelectedId] = useState<string | null>(null)  // 单选模式
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())  // 多选模式
  
  // 过滤掉已完成的任务
  const uncompletedTasks = tasks.filter(t => !t.isCompleted)
  
  // 🆕 构建层级结构：区分主任务和子任务
  const parentTasks = uncompletedTasks.filter(t => !t.parent_task_id)
  const childTasksMap = new Map<string, typeof uncompletedTasks>()
  
  // 将子任务按父任务分组
  uncompletedTasks.forEach(task => {
    if (task.parent_task_id) {
      if (!childTasksMap.has(task.parent_task_id)) {
        childTasksMap.set(task.parent_task_id, [])
      }
      childTasksMap.get(task.parent_task_id)!.push(task)
    }
  })
  
  // 🆕 构建显示列表（包含所有任务，用于动画）
  const visibleTasks: Array<typeof uncompletedTasks[0] & { 
    isChild?: boolean; 
    isLastChild?: boolean;
    parentId?: string;
  }> = []
  
  parentTasks.forEach(parent => {
    // 添加主任务
    visibleTasks.push({ ...parent, isChild: false })
    
    // 添加所有子任务（不管是否折叠，用CSS控制显示）
    const children = childTasksMap.get(parent.id) || []
    children.forEach((child, index) => {
      visibleTasks.push({ 
        ...child, 
        isChild: true, 
        isLastChild: index === children.length - 1,
        parentId: parent.id  // 记录父任务ID，用于判断是否应该隐藏
      })
    })
  })
  
  const selectTask = (taskId: string) => {
    if (!isActive) return
    
    if (isMultiSelect) {
      // 多选模式：切换选中状态
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(taskId)) {
          newSet.delete(taskId)
        } else {
          newSet.add(taskId)
        }
        return newSet
      })
    } else {
      // 单选模式：点击已选中的任务取消选择，否则选中新任务
      setSelectedId(prev => prev === taskId ? null : taskId)
    }
  }
  
  const handleConfirm = () => {
    if (!isActive) return
    
    if (isMultiSelect) {
      // 多选模式：优先级反思至少选择1个任务
      if (selectedIds.size >= 1) {
        onConfirm(Array.from(selectedIds))
      }
    } else {
      // 单选模式：选择1个任务
      if (selectedId) {
        onConfirm([selectedId])
      }
    }
  }
  
  // 判断确认按钮是否可用（无任务时也禁用）
  const isConfirmDisabled = !isActive || visibleTasks.length === 0 || (isMultiSelect ? selectedIds.size < 1 : !selectedId)
  
  const roundInfo = {
    clarity: { emoji: '📝', label: '明确任务', color: 'blue' },
    decomposition: { emoji: '✂️', label: '拆分步骤', color: 'purple' },
    time: { emoji: '⏱️', label: '估算时间', color: 'green' },
    priority: { emoji: '🎯', label: '安排优先级', color: 'orange' }
  }
  
  const info = roundInfo[roundType]
  
  return (
    <div className={`mt-3 p-3 bg-${info.color}-50 rounded-lg border border-${info.color}-200 w-full`}>
      {/* 标题和说明 */}
      {roundType === 'priority' ? (
        // 安排优先级的特殊文案
        <div className="mb-3">
      <div className="text-sm font-medium text-gray-700 mb-2">
            {info.emoji} 请选择需要反思优先级的任务：
      </div>
          <div className="text-xs text-gray-600 space-y-1 bg-white/50 rounded p-2">
            <div className="flex items-start gap-1.5">
              <span className="text-green-600">•</span>
              <span><span className="font-medium">已经清晰的任务</span> → 建议直接拖入矩阵对应的象限</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-orange-600">•</span>
              <span><span className="font-medium">还不清晰的任务</span> → 请在下面勾选，我会帮你思考优先级</span>
            </div>
            <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-gray-200">
              <span className="text-gray-500">💡</span>
              <span className="text-gray-500">至少选择1个任务（只显示未完成的任务）</span>
            </div>
          </div>
        </div>
      ) : (
        // 明确任务和估算时间的文案
        <div className="text-sm font-medium text-gray-700 mb-2">
          {info.emoji} 请选择要进行「{info.label}」的任务：
        </div>
      )}
      
      <div 
        className="space-y-1.5 mb-3 max-h-48 overflow-y-auto overflow-x-hidden w-full"
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* 🆕 空状态提示 */}
        {visibleTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm">暂无可选择的任务</p>
            <p className="text-xs text-gray-400 mt-1">请先在笔记中添加任务</p>
          </div>
        ) : visibleTasks.map((task, index) => {
          const isSelected = isMultiSelect ? selectedIds.has(task.id) : selectedId === task.id
          const isChild = task.isChild || false
          const isLastChild = task.isLastChild || false
          const hasChildren = !isChild && (childTasksMap.get(task.id)?.length || 0) > 0
          const isCollapsed = collapsedTasks.has(task.id)
          
          // 🆕 判断子任务是否应该隐藏（父任务被折叠）
          const isChildHidden = isChild && task.parentId && collapsedTasks.has(task.parentId)
          
          return (
            <div
              key={`task-selection-${task.id}-${index}`}
              className={`flex items-center gap-2 p-2 rounded-md w-full overflow-hidden
                ${isSelected 
                  ? `bg-${info.color}-100 border border-${info.color}-300` 
                  : 'bg-white border border-gray-200 hover:border-gray-300'
                }
                ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}
                ${isChild ? 'pl-8' : ''}
                ${isChildHidden 
                  ? 'max-h-0 opacity-0 py-0 my-0 border-0' 
                  : 'max-h-20 opacity-100 transition-all duration-150 ease-in-out'
                }
              `}
            >
              <input
                type={isMultiSelect ? 'checkbox' : 'radio'}
                name={isMultiSelect ? undefined : `task-select-${roundType}`}
                id={`task-select-${roundType}-${task.id}-${index}`}
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation()
                  if (isActive) {
                    selectTask(task.id)
                  }
                }}
                disabled={!isActive}
                className={`w-4 h-4 text-${info.color}-600 border-gray-300 focus:ring-${info.color}-500 cursor-pointer flex-shrink-0`}
              />
              <label
                htmlFor={`task-select-${roundType}-${task.id}-${index}`}
                className="text-sm text-gray-700 flex-1 cursor-pointer overflow-hidden min-w-0"
                title={task.title}
              >
                <span className="block truncate">{task.title}</span>
              </label>
              
              {/* 🆕 主任务折叠图标（右侧） */}
              {!isChild && hasChildren && onToggleCollapse && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isActive) {
                      onToggleCollapse(task.id)
                    }
                  }}
                  disabled={!isActive}
                  className="text-gray-500 hover:text-gray-700 transition-all duration-200 flex-shrink-0 w-4 h-4 flex items-center justify-center ml-1"
                  title={isCollapsed ? '点击展开子任务' : '点击折叠子任务'}
                >
                  <span className={`text-xs leading-none transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                    ▶
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
      
      {/* 提示文案 - 仅在有任务时显示 */}
      {uncompletedTasks.some(t => !t.parent_task_id && childTasksMap.get(t.id)?.length) && (
        <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
          <span>💡</span>
          <span>任务右侧的 ▶ 可展开查看子任务</span>
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
          className={`flex-1 px-4 py-2 text-sm font-medium bg-${info.color}-500 text-white hover:bg-${info.color}-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          确认选择{isMultiSelect && selectedIds.size > 0 && ` (${selectedIds.size})`}
        </button>
        <button
          onClick={onBack}
          disabled={!isActive}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          返回
        </button>
      </div>
    </div>
  )
}

// ⭐ 问答输入卡片组件
// ⭐ 反思问答总结卡片（带添加到任务按钮）
const ReflectionQASummaryCard: React.FC<{
  qaList: Array<{ question: string; answer: string }>
  taskId: string
  roundType: 'clarity' | 'decomposition' | 'time' | 'priority'
  onAddContext: (qa: QuestionAnswerPair, taskId: string, source: string) => void
  onAddAllContext?: (qaList: Array<{question: string, answer: string}>, taskId: string, source: string) => void  // 🆕 批量添加回调
}> = ({ qaList, taskId, roundType, onAddContext, onAddAllContext }) => {
  const sourceMap = {
    'clarity': 'clarity-reflection',
    'decomposition': 'decomposition-reflection',
    'time': 'time-reflection',
    'priority': 'priority-reflection'
  }
  
  const source = sourceMap[roundType]
  
  // 🆕 优先级排列不显示添加上下文功能
  const showAddContext = roundType !== 'priority'
  
  return (
    <div className="space-y-2 mt-3">
      <p className="text-sm font-medium text-gray-700 mb-2">**您的回答总结：**</p>
      {qaList.map((qa, index) => (
        <div
          key={index}
          className="bg-gray-50 border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors relative group"
        >
          {/* 添加按钮 - 右上角（优先级排列时隐藏） */}
          {showAddContext && (
            <button
              onClick={() => onAddContext(qa, taskId, source)}
              className="absolute top-2 right-2 p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors opacity-70 group-hover:opacity-100"
              title="添加到任务"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          
          <div className={showAddContext ? "pr-8" : ""}>
            {/* 问题 */}
            <div className="mb-1.5">
              <span className="text-xs text-gray-500">Q{index + 1}: </span>
              <span className="text-sm text-gray-700">{qa.question}</span>
            </div>
            {/* 答案 */}
            <div>
              <span className="text-xs text-gray-500">A: </span>
              <span className="text-sm text-gray-900">{qa.answer}</span>
            </div>
          </div>
        </div>
      ))}
      
      {/* 🆕 批量添加按钮（优先级排列时隐藏） */}
      {showAddContext && onAddAllContext && qaList.length > 0 && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => onAddAllContext(qaList, taskId, source)}
            className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 flex items-center gap-2 transition-all text-sm font-medium"
          >
            <span className="text-base">💡</span>
            <span>添加所有上下文</span>
          </button>
        </div>
      )}
    </div>
  )
}

const QuestionAnswerCard: React.FC<{
  question: string
  questionIndex: number
  totalQuestions: number
  taskTitle: string
  taskId: string
  roundType?: 'clarity' | 'decomposition' | 'time' | 'priority'
  isActive: boolean
  onNext: (answer: string) => void
  onBack: () => void
}> = ({ question, questionIndex, totalQuestions, taskTitle, taskId, roundType = 'clarity', isActive, onNext, onBack }) => {
  const [answer, setAnswer] = useState('')
  
  const handleNext = () => {
    if (isActive) {
      onNext(answer.trim())
      setAnswer('')  // 清空输入框
    }
  }
  
  const isLastQuestion = questionIndex === totalQuestions - 1
  
  // 根据轮次类型显示不同的提示文字
  const getPromptText = () => {
    switch (roundType) {
      case 'clarity':
        return `我注意到「${taskTitle}」可能比较复杂，想了解一些背景信息：`
      case 'decomposition':
        return `关于「${taskTitle}」，想了解一些信息：`
      case 'time':
        return `关于「${taskTitle}」的时间规划，想和你确认一下：`
      case 'priority':
        // Priority 轮的 taskTitle 是多个任务名用顿号连接，直接显示即可
        return `关于这几个任务（${taskTitle}）的优先级，想听听你的想法：`
      default:
        return `关于「${taskTitle}」，想了解一些信息：`
    }
  }
  
  // 根据轮次类型获取颜色主题
  const getColorTheme = () => {
    switch (roundType) {
      case 'clarity':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          label: 'text-blue-600',
          button: 'bg-blue-500 hover:bg-blue-600',
          focus: 'focus:ring-blue-500'
        }
      case 'decomposition':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          label: 'text-purple-600',
          button: 'bg-purple-500 hover:bg-purple-600',
          focus: 'focus:ring-purple-500'
        }
      case 'time':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          label: 'text-green-600',
          button: 'bg-green-500 hover:bg-green-600',
          focus: 'focus:ring-green-500'
        }
      case 'priority':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          label: 'text-orange-600',
          button: 'bg-orange-500 hover:bg-orange-600',
          focus: 'focus:ring-orange-500'
        }
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          label: 'text-blue-600',
          button: 'bg-blue-500 hover:bg-blue-600',
          focus: 'focus:ring-blue-500'
        }
    }
  }
  
  const theme = getColorTheme()
  
  return (
    <div className={`mt-3 p-4 ${theme.bg} rounded-lg border ${theme.border}`}>
      <div className="text-sm font-medium text-gray-700 mb-3">
        {getPromptText()}
      </div>
      
      <div className="mb-3">
        <div className={`text-xs font-semibold ${theme.label} mb-2`}>
          问题 {questionIndex + 1}/{totalQuestions}
        </div>
        <div className="text-sm text-gray-800 mb-3">
          {question || '⚠️ 问题加载失败，您可以跳过此问题或返回重试'}
        </div>
        
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={!isActive}
          placeholder="在这里输入你的回答（可选，也可以直接点「下一个问题」跳过）"
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${theme.focus} text-sm text-gray-900 placeholder-gray-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed`}
          rows={3}
        />
      </div>
      
      <div className="text-xs text-gray-500 mb-3">
        💡 你也可以在左侧编辑器中修改您的计划
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleNext}
          disabled={!isActive}
          className={`flex-1 px-4 py-2 text-sm font-medium ${theme.button} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLastQuestion ? '完成 ✓' : '下一个问题 →'}
        </button>
        <button
          onClick={onBack}
          disabled={!isActive}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← 返回
        </button>
      </div>
    </div>
  )
}

interface ChatSidebarProps {
  // 侧边栏状态
  isOpen: boolean
  onToggle: () => void
  
  // 🆕 视图模式（用于控制 Agent 开关显示）
  viewMode?: 'editor' | 'matrix'
  
  // 聊天相关状态
  chatMessage: string
  setChatMessage: (message: string) => void
  selectedImage: File | null
  setSelectedImage: (image: File | null) => void
  chatMessages: ChatMessage[]
  setChatMessages: (messages: ChatMessage[]) => void
  isSending: boolean
  streamingMessage: string
  aiThinkingPhase?: number // AI思考进度阶段 (1-3)
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
  onTaskToggleFromList?: (taskId: string, noteId: string, newCompletedState: boolean) => void
  // 🆕 任务列表卡片的任务移动到今天回调
  onMoveTaskToToday?: (taskId: string, noteId: string, noteDate: string) => void
  // 🆕 任务列表卡片刷新状态
  isRefreshingTaskList?: boolean  // 通用交互按钮点击
  
  // ⭐ 元认知反思相关
  reflectionSessionId?: string | null  // 当前反思会话 ID
  isReflectionMode?: boolean  // 是否处于反思模式
  currentReflectionRound?: string | null  // 当前反思轮次
  onSkipReflectionRound?: () => void  // 下一步（原跳过当前轮次）
  onMoreQuestions?: () => void  // 要更多问题
  onEndReflection?: () => void  // 结束反思
  isGeneratingQuestions?: boolean  // 是否正在生成问题
  
  // ⭐ Clarity 轮后的任务拆解选择
  isDecompositionPhase?: boolean  // 是否处于拆解选择阶段
  decomposableTasks?: Array<{ id: string; title: string }>  // 可拆解的任务列表
  onDecomposeTaskSelect?: (taskIds: string[]) => void  // 选择要拆解的任务
  onSkipDecomposition?: () => void  // 跳过拆解，进入下一步
  
  // ⭐ 继续拆解下一个任务
  onContinueDecompose?: () => void  // 继续拆解下一个任务
  onSkipContinueDecompose?: () => void  // 跳过继续拆解，进入下一步
  
  // ⭐ 优先级矩阵建议
  onSwitchToMatrix?: () => void  // 切换到矩阵模式
  onSkipMatrixSwitch?: () => void  // 跳过矩阵建议，继续优先级反思
  
  // ⭐ 底部快捷反思按钮
  currentReflectionType?: 'clarity' | 'decomposition' | 'time' | 'priority' | null  // 当前激活的反思类型
  onReflectionQuickStart?: (type: 'clarity' | 'decomposition' | 'time' | 'priority') => void  // 快捷启动反思
  isDailyReflectionMode?: boolean  // 是否处于每日回顾模式（用于隐藏底部按钮）
  isReflectionLoading?: boolean  // ⭐ 反思操作是否正在加载
  loadingReflectionType?: 'clarity' | 'decomposition' | 'time' | 'priority' | null  // ⭐ 正在加载的反思类型
  
  // ⭐ 反思流程优化 - 概述和任务选择
  onOverviewButtonClick?: (action: 'clarity' | 'decomposition' | 'time' | 'priority' | 'cancel') => void  // 概述页面按钮点击
  onRoundCompleteButtonClick?: (action: 'clarity' | 'decomposition' | 'time' | 'priority' | 'end') => void  // 轮次完成后按钮点击
  onTaskSelectionConfirm?: (taskIds: string[]) => void  // 任务选择确认
  onTaskSelectionBack?: () => void  // 任务选择返回
  completedRounds?: ('clarity' | 'decomposition' | 'time' | 'priority')[]  // 已完成的轮次
  availableTasksForSelection?: Array<{ id: string; title: string; isCompleted: boolean }>  // 可选择的任务列表
  pendingRound?: 'clarity' | 'decomposition' | 'time' | 'priority' | null  // 待选择任务的轮次
  
  // ⭐ 问答流程状态
  isAnsweringQuestions?: boolean  // 是否处于问答阶段
  currentQuestionIndex?: number  // 当前问题索引
  totalQuestionsCount?: number  // 总问题数
  
  // ⭐ 任务选择界面：折叠状态
  collapsedTasks?: Set<string>  // 被折叠的主任务ID集合
  onToggleTaskCollapse?: (taskId: string) => void  // 切换折叠状态
  
  // ⭐ 上下文信息回调
  onContextInfoAdded?: (taskTitle: string, contextContent: string, contextId: string) => void  // 上下文信息添加成功回调
  
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
  viewMode,
  chatMessage,
  setChatMessage,
  selectedImage,
  setSelectedImage,
  chatMessages,
  setChatMessages,
  isSending,
  streamingMessage,
  aiThinkingPhase = 2, // 默认阶段2
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
  onMoveTaskToToday,  // 🆕 任务移动到今天
  isRefreshingTaskList,  // 🆕 任务列表刷新状态
  reflectionSessionId,  // ⭐ 反思会话 ID
  isReflectionMode,  // ⭐ 反思模式
  currentReflectionRound,  // ⭐ 当前反思轮次
  onSkipReflectionRound,  // ⭐ 下一步
  onMoreQuestions,  // ⭐ 更多问题
  onEndReflection,  // ⭐ 结束反思
  isGeneratingQuestions,  // ⭐ 正在生成问题
  isDecompositionPhase,  // ⭐ 拆解选择阶段
  decomposableTasks,  // ⭐ 可拆解任务
  onDecomposeTaskSelect,  // ⭐ 选择拆解任务
  onSkipDecomposition,  // ⭐ 跳过拆解
  onContinueDecompose,  // ⭐ 继续拆解下一个
  onSkipContinueDecompose,  // ⭐ 跳过继续拆解
  // ⭐ 优先级矩阵建议
  onSwitchToMatrix,  // 切换到矩阵模式
  onSkipMatrixSwitch,  // 跳过矩阵建议
  // ⭐ 底部快捷反思按钮
  currentReflectionType,  // 当前激活的反思类型
  onReflectionQuickStart,  // 快捷启动反思
  isDailyReflectionMode,  // 是否处于每日回顾模式
  isReflectionLoading,  // ⭐ 反思操作是否正在加载
  loadingReflectionType,  // ⭐ 正在加载的反思类型
  // ⭐ 反思流程优化
  onOverviewButtonClick,  // 概述按钮点击
  onRoundCompleteButtonClick,  // 轮次完成按钮点击
  onTaskSelectionConfirm,  // 任务选择确认
  onTaskSelectionBack,  // 任务选择返回
  completedRounds,  // 已完成轮次
  availableTasksForSelection,  // 可选任务列表
  pendingRound,  // 待选择任务的轮次
  // ⭐ 问答流程状态
  isAnsweringQuestions,  // 是否处于问答阶段
  currentQuestionIndex,  // 当前问题索引
  totalQuestionsCount,  // 总问题数
  // ⭐ 任务选择界面：折叠状态
  collapsedTasks,  // 被折叠的主任务ID集合
  onToggleTaskCollapse,  // 切换折叠状态
  // ⭐ 上下文信息回调
  onContextInfoAdded,  // 上下文信息添加成功回调
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
  
  // ⭐ 上下文信息弹窗状态
  const [contextModalOpen, setContextModalOpen] = useState(false)
  const [contextModalData, setContextModalData] = useState<{
    qa: QuestionAnswerPair
    qaList?: Array<{question: string, answer: string}>  // 🆕 批量添加时使用
    taskId: string
    source: string
  } | null>(null)
  
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
  
  // ⭐ 处理添加上下文信息
  const handleAddContextInfo = (qa: QuestionAnswerPair, taskId: string, source: string) => {
    console.log('📝 打开添加上下文信息弹窗:', { qa, taskId, source })
    console.log('📋 当前可用任务列表 (availableTasksForSelection):', availableTasksForSelection)
    
    // 映射任务列表，使用任务标题作为 id
    const mappedTasks = availableTasksForSelection?.map(t => ({ id: t.title, title: t.title })) || []
    console.log('📋 映射后的任务列表:', mappedTasks)
    console.log('📍 默认任务 ID:', taskId)
    
    setContextModalData({ qa, taskId, source })
    setContextModalOpen(true)
  }
  
  // ⭐ 处理批量添加所有上下文信息
  const handleAddAllContext = (qaList: Array<{question: string, answer: string}>, taskId: string, source: string) => {
    console.log('📦 打开批量添加上下文弹窗:', { qaList, taskId, source })
    
    setContextModalData({ qa: qaList[0], qaList, taskId, source })
    setContextModalOpen(true)
  }
  
  const handleContextModalSuccess = async (addedContent: string, selectedTaskTitle: string, contextId: string) => {
    console.log('✅ 上下文信息添加成功:', { addedContent, selectedTaskTitle, contextId })
    
    // 通知主页面：需要插入上下文信息到笔记
    if (onContextInfoAdded) {
      onContextInfoAdded(selectedTaskTitle, addedContent, contextId)
    }
  }
  
  // ⭐ 自动滚动到底部（当有新消息时）
  useEffect(() => {
    if (chatScrollRef.current) {
      // 使用 smooth 滚动，体验更好
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [chatMessages, streamingMessage]) // 监听消息变化和流式消息
  
  // 🆕 矩阵模式下：强制显示 Agent 开关为关闭状态
  const displayAgentMode = viewMode === 'matrix' ? false : isAgentMode
  
  // ⭐ 判断是否应该禁用输入框（引导用户使用按钮）
  const shouldDisableInput = (() => {
    // 🆕 问答阶段：禁用底部输入框
    if (isAnsweringQuestions) {
      return true
    }
    
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
        
        {/* Agent 模式开关已移到底部输入栏左侧 */}
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
            chatMessages.map((message, index) => {
              // 检查是否包含任务列表卡片或任务选择卡片
              const hasTaskList = message.content.some(c => c.type === 'task-list')
              const hasTaskSelection = message.content.some(c => 
                c.type === 'interactive' && c.interactive?.type === 'reflection-task-selection'
              )
              const shouldUseFullWidth = hasTaskList || hasTaskSelection
              
              return (
              <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {message.role === 'user' ? (
                  <img src="/user-avatar.svg" alt="我" className="w-8 h-8 rounded-full flex-shrink-0" />
                ) : (
                  <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
                )}
                
                {/* 任务列表卡片或任务选择卡片独立显示 */}
                {shouldUseFullWidth ? (
                  <div className="w-[80%]">
                    <div className="rounded-lg px-3 py-2 shadow-sm bg-white">
                    {message.content.map((content, contentIndex) => (
                      <div key={contentIndex}>
                        {content.type === 'task-list' && content.taskList && (
                          <TaskListCard
                            tasks={content.taskList.tasks as TaskForDisplay[]}
                            totalCount={content.taskList.totalCount}
                            onTaskToggle={(taskId, noteId, newCompletedState) => {
                              if (onTaskToggleFromList) {
                                onTaskToggleFromList(taskId, noteId, newCompletedState)
                              }
                            }}
                            onMoveToToday={(taskId, noteId, noteDate) => {
                              if (onMoveTaskToToday) {
                                onMoveTaskToToday(taskId, noteId, noteDate)
                              }
                            }}
                            isRefreshing={isRefreshingTaskList}
                          />
                        )}
                          
                          {/* 渲染文本内容 */}
                          {content.type === 'text' && content.text && (
                            <div className="text-sm prose-chat">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content.text}</ReactMarkdown>
                            </div>
                          )}
                          
                          {/* 渲染交互式内容（包括任务选择卡片） */}
                          {content.type === 'interactive' && content.interactive?.type === 'reflection-task-selection' && availableTasksForSelection && (
                            <ReflectionTaskSelectionCard
                              tasks={availableTasksForSelection}
                              roundType={content.interactive.data?.roundType || pendingRound || 'clarity'}
                              isActive={content.interactive.isActive !== false}
                              onConfirm={(taskIds) => onTaskSelectionConfirm?.(taskIds)}
                              onBack={() => onTaskSelectionBack?.()}
                              collapsedTasks={collapsedTasks}
                              onToggleCollapse={onToggleTaskCollapse}
                            />
                          )}
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  /* 普通消息气泡 */
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
                            ) : content.text.includes('让我看看你这天的任务') || content.text.includes('让我重新看看你的任务') ? (
                              /* 🆕 加载状态动画 - 圆点替代省略号 */
                              <div className="flex items-center gap-2 py-1">
                                <span className="text-sm text-gray-600">
                                  {content.text.replace('⏳ ', '').replace('📂 ', '').replace('...', '')}
                                </span>
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm prose-chat">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content.text}</ReactMarkdown>
                              </div>
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
                          
                          {/* ⭐ 继续拆解选项 */}
                          {content.interactive.type === 'continue-decompose-options' && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => onContinueDecompose?.()}
                                disabled={content.interactive.isActive === false}
                                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                继续拆解
                              </button>
                              <button
                                onClick={() => onSkipContinueDecompose?.()}
                                disabled={content.interactive.isActive === false}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                取消
                              </button>
                            </div>
                          )}
                          
                          {/* ⭐ 优先级矩阵建议卡片 - 简化版，只显示建议 */}
                          {content.interactive.type === 'priority-matrix-suggestion' && (
                            <div className="mt-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-lg">
                              <div className="flex items-start gap-3 mb-3">
                                <span className="text-2xl">💡</span>
                                <div className="flex-1">
                                  <h3 className="text-sm font-semibold text-orange-900 mb-2">小提示</h3>
                                  <p className="text-sm text-gray-700 mb-1.5">
                                    矩阵模式更适合进行优先级排序！
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    可以通过拖拽直观地看到任务分布，更容易做出决策
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => onSwitchToMatrix?.()}
                                  disabled={content.interactive.isActive === false}
                                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center justify-center gap-2"
                                >
                                  <span>🎯</span>
                                  <span>切换到矩阵模式</span>
                                </button>
                                <button
                                  onClick={() => onSkipMatrixSwitch?.()}
                                  disabled={content.interactive.isActive === false}
                                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-white border-2 border-gray-300 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  暂时不切换
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* ⭐ 规划概述 - 引导使用底部快捷按钮 */}
                          {content.interactive.type === 'reflection-overview' && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600 text-center">
                                👇 请使用下方的快捷按钮开始规划
                              </p>
                            </div>
                          )}
                          
                          {/* ⭐ 任务选择列表 */}
                          {content.interactive.type === 'reflection-task-selection' && availableTasksForSelection && (
                            <ReflectionTaskSelectionCard
                              tasks={availableTasksForSelection}
                              roundType={content.interactive.data?.roundType || pendingRound || 'clarity'}
                              isActive={content.interactive.isActive !== false}
                              onConfirm={(taskIds) => onTaskSelectionConfirm?.(taskIds)}
                              onBack={() => onTaskSelectionBack?.()}
                              collapsedTasks={collapsedTasks}
                              onToggleCollapse={onToggleTaskCollapse}
                            />
                          )}
                          
                          {/* ⭐ 每日回顾 - 问题卡片 */}
                          {content.interactive.type === 'daily-reflection-question' && content.interactive.data && (
                            <DailyReflectionQuestionCard
                              question={content.interactive.data.question}
                              questionNumber={content.interactive.data.questionNumber}
                              totalQuestions={content.interactive.data.totalQuestions}
                              isActive={content.interactive.isActive !== false}
                              onAnswer={(answer) => onButtonClick?.('daily-reflection-answer', { 
                                ...content.interactive?.data, 
                                answer 
                              })}
                              onSkip={() => onButtonClick?.('daily-reflection-skip', content.interactive?.data)}
                            />
                          )}
                          
                          {/* ⭐ 每日回顾 - 完成卡片 */}
                          {content.interactive.type === 'daily-reflection-complete' && content.interactive.data && (
                            <DailyReflectionCompleteCard
                              summary={content.interactive.data.summary}
                              onViewHistory={() => onButtonClick?.('daily-reflection-view-history', {})}
                              onClose={() => onButtonClick?.('daily-reflection-close', {})}
                            />
                          )}
                          
                          {/* ⭐ 每日回顾 - 已完成提示 */}
                          {content.interactive.type === 'daily-reflection-already-done' && content.interactive.data && (
                            <DailyReflectionAlreadyDoneCard
                              summary={content.interactive.data.summary}
                              onViewHistory={() => onButtonClick?.('daily-reflection-view-history', {})}
                              onClear={() => onButtonClick?.('daily-reflection-clear', {})}
                              onClose={() => onButtonClick?.('daily-reflection-close', {})}
                            />
                          )}
                          
                          {/* ⭐ 每日回顾 - 恢复提示 */}
                          {content.interactive.type === 'daily-reflection-resume' && content.interactive.data && (
                            <DailyReflectionResumeCard
                              questionNumber={content.interactive.data.questionNumber}
                              totalQuestions={content.interactive.data.totalQuestions}
                              onResume={() => onButtonClick?.('daily-reflection-resume', content.interactive?.data)}
                              onRestart={() => onButtonClick?.('daily-reflection-restart', content.interactive?.data)}
                            />
                          )}
                          
                          {/* ⭐ 每日回顾 - 历史记录 */}
                          {content.interactive.type === 'daily-reflection-history' && content.interactive.data && (
                            <DailyReflectionHistoryCard
                              reflections={content.interactive.data.reflections || []}
                              hasMore={content.interactive.data.hasMore || false}
                              isLoading={content.interactive.data.isLoading || false}
                              onLoadMore={() => onButtonClick?.('daily-reflection-load-more', content.interactive?.data)}
                              onClose={() => onButtonClick?.('daily-reflection-history-close', {})}
                            />
                          )}
                          
                          {/* ⭐ 反思问答总结（带添加按钮） */}
                          {content.interactive.type === 'reflection-qa-summary' && content.interactive.data && (
                            <ReflectionQASummaryCard
                              qaList={content.interactive.data.qaList || []}
                              taskId={content.interactive.data.taskId}
                              roundType={content.interactive.data.roundType || 'clarity'}
                              onAddContext={handleAddContextInfo}
                              onAddAllContext={handleAddAllContext}
                            />
                          )}
                          
                          {/* ⭐ 问答输入卡片 */}
                          {content.interactive.type === 'question-answer' && content.interactive.data && (
                            <QuestionAnswerCard
                              question={content.interactive.data.question}
                              questionIndex={content.interactive.data.questionIndex}
                              totalQuestions={content.interactive.data.totalQuestions}
                              taskTitle={content.interactive.data.taskTitle}
                              taskId={content.interactive.data.taskId}
                              roundType={content.interactive.data.roundType}
                              isActive={content.interactive.isActive !== false}
                              onNext={(answer) => onButtonClick?.('next-question', { 
                                ...content.interactive?.data, 
                                answer 
                              })}
                              onBack={() => onButtonClick?.('back-to-selection-from-qa', content.interactive?.data)}
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
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                )}
              </div>
            )})
          )}
          
          {/* 流式输出和发送中指示器（⭐ Agent模式下不显示） */}
          {isSending && !streamingMessage && !isAgentRunning && (
            <AIThinkingIndicator 
              type={
                isTaskRecognitionMode ? 'task-recognition' :
                loadingReflectionType === 'priority' ? 'priority' :
                loadingReflectionType === 'decomposition' ? 'decomposition' :
                loadingReflectionType === 'time' ? 'time' :
                loadingReflectionType === 'clarity' ? 'clarity' :
                'default'
              }
              currentPhase={aiThinkingPhase}  // ✅ 使用动态阶段
            />
          )}
          
          {streamingMessage && !isTaskRecognitionMode && (
            <div className="flex items-start gap-3">
              <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[80%]">
                <div className="text-sm prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{streamingMessage}</ReactMarkdown>
                  <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                </div>
              </div>
            </div>
          )}
          
          {/* 正在生成反思问题的加载提示 */}
          {isGeneratingQuestions && (
            <div className="flex items-start gap-3">
              <img src="/ai-avatar.svg" alt="AI" className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>正在思考问题...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 反思模式控制按钮 */}
      {isReflectionMode && currentReflectionRound && (
        <div className="border-t border-gray-200 bg-blue-50 p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600">
              💭 {currentReflectionRound === 'clarity' ? '明确任务' : currentReflectionRound === 'time' ? '估算时间' : '安排优先级'}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={onSkipReflectionRound}
                disabled={isGeneratingQuestions}
                className="px-3 py-1.5 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步 →
              </button>
              <button
                onClick={onMoreQuestions}
                disabled={isGeneratingQuestions}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                更多问题
              </button>
              <button
                onClick={onEndReflection}
                disabled={isGeneratingQuestions}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                结束
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ⭐ 任务拆解选择区域 */}
      {isDecompositionPhase && decomposableTasks && decomposableTasks.length > 0 && (
        <DecompositionSelector
          tasks={decomposableTasks}
          onSelect={onDecomposeTaskSelect}
          onSkip={onSkipDecomposition}
        />
      )}
      
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
      
      {/* ⭐ 底部快捷规划按钮 */}
      {onReflectionQuickStart && (
        <ReflectionQuickActions
          currentReflectionType={currentReflectionType || null}
          onReflectionStart={onReflectionQuickStart}
          isVisible={!isDailyReflectionMode}
          isLoading={isReflectionLoading}
          loadingType={loadingReflectionType}
        />
      )}
      
      {/* 输入区域 */}
      <div className="px-4 pt-4 pb-2 border-t border-gray-100 flex-shrink-0">
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
          {/* Agent 模式切换按钮 */}
          <button
            onClick={() => setIsAgentMode(!isAgentMode)}
            disabled={viewMode === 'matrix'}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all border ${
              viewMode === 'matrix'
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                : displayAgentMode
                  ? 'bg-blue-50 border-blue-400 hover:bg-blue-100'
                  : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50 bg-white'
            }`}
            title={viewMode === 'matrix' ? '矩阵模式下不可用 Agent' : (displayAgentMode ? '点击关闭 Agent 模式' : '点击开启 Agent 模式')}
          >
            {/* 机器人图标 */}
            <svg className={`w-6 h-6 ${displayAgentMode ? 'text-blue-600' : 'text-gray-500'}`} viewBox="0 0 1024 1024" fill="currentColor">
              <path d="M554.666667 251.733333V341.333333h341.333333v426.666667H170.666667V341.333333h341.333333V251.733333c-25.6-8.533333-42.666667-34.133333-42.666667-59.733333 0-34.133333 29.866667-64 64-64s64 29.866667 64 64c0 29.866667-17.066667 51.2-42.666666 59.733333zM512 384H213.333333v341.333333h640V384h-341.333333z m-384 85.333333v213.333334H85.333333v-213.333334h42.666667z m853.333333 0v213.333334h-42.666666v-213.333334h42.666666zM384 597.333333c-25.6 0-42.666667-17.066667-42.666667-42.666666s17.066667-42.666667 42.666667-42.666667 42.666667 17.066667 42.666667 42.666667-17.066667 42.666667-42.666667 42.666666z m298.666667 0c-25.6 0-42.666667-17.066667-42.666667-42.666666s17.066667-42.666667 42.666667-42.666667 42.666667 17.066667 42.666666 42.666667-17.066667 42.666667-42.666666 42.666666z" />
            </svg>
          </button>

          {/* 输入框 */}
          <textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // ⭐ 防止重复触发：检查是否正在发送或 Agent 正在运行
                if (isSending || isAgentRunning) {
                  console.log('⚠️ 已有发送任务进行中，忽略 Enter 键')
                  return
                }
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
                : isAnsweringQuestions
                  ? "💡 请在上方问题卡片中输入回答"
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

          {/* 语音按钮 - 暂时隐藏 */}
          {/* <div className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors border ${
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
          </div> */}

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
      
      {/* ⭐ 添加上下文信息弹窗 */}
      {contextModalOpen && contextModalData && availableTasksForSelection && availableTasksForSelection.length > 0 && (
        <AddContextInfoModal
          isOpen={contextModalOpen}
          onClose={() => setContextModalOpen(false)}
          questionAnswer={contextModalData.qaList ? undefined : contextModalData.qa}  // 单个问答
          questionAnswers={contextModalData.qaList}  // 🆕 多个问答（批量模式）
          defaultTaskId={(() => {
            // 从快照ID中提取任务标题
            const snapshot = availableTasksForSelection.find(t => t.id === contextModalData.taskId)
            const taskTitle = snapshot?.title || availableTasksForSelection[0]?.title || ''
            console.log('🎯 设置默认任务标题:', taskTitle, '(来自快照ID:', contextModalData.taskId, ')')
            return taskTitle
          })()}
          availableTasks={availableTasksForSelection.map(t => ({ id: t.title, title: t.title }))}
          source={contextModalData.source}
          onSuccess={handleContextModalSuccess}
        />
      )}
    </aside>
    </>
  )
})

ChatSidebar.displayName = 'ChatSidebar'

export default ChatSidebar
