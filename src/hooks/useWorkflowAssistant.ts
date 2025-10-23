/**
 * AI工作流辅助Hook
 * 负责管理AI辅助完善计划的状态和逻辑
 */

import { useState, useCallback, useRef } from 'react'
import type { Task, UserProfile, WorkflowMode, AIRecommendation, PrioritySortFeeling, SingleTaskAction, ClarificationQuestion, StructuredContext, DateScope } from '@/types'
import type { ChatMessage, InteractiveMessageType } from '@/lib/doubaoService'
import { analyzeTasksForWorkflow, getTodayTasks, generateDetailedTaskSummary } from '@/lib/workflowAnalyzer'
import { filterTasksByScope, getScopeDescription } from '@/utils/dateUtils'
import { getMatrixTypeByFeeling, getMatrixConfig } from '@/types'
import { streamText } from '@/utils/streamText'
import { generateContextQuestions, formatQuestionsMessage } from '@/lib/contextQuestions'
import { generateDecompositionQuestionsWithFallback } from '@/lib/decompositionAI'
import { getGuidanceMessage } from '@/lib/guidanceService'
import type { GuidanceScenario } from '@/lib/guidanceService'
import { generateClarificationQuestions, formatClarificationQuestionsMessage, recommendTasksForClarification, formatRecommendationsMessage, recommendTasksForTimeEstimation, formatTimeEstimationRecommendationsMessage } from '@/lib/clarificationQuestions'
import { doubaoService } from '@/lib/doubaoService'
import { generateReflectionQuestion, buildUserProfile } from '@/lib/timeEstimationAI'
import { formatMinutes, calculateBuffer, encodeEstimatedDuration } from '@/utils/timeEstimation'
import { generateClarificationQuestionsWithFallback } from '@/lib/clarificationAI'
import { formatSummaryForEdit } from '@/utils/summaryUtils'

interface UseWorkflowAssistantProps {
  tasks: Task[]
  userProfile: UserProfile | null
  dateScope: DateScope  // ⭐ 新增：日期范围
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  setStreamingMessage: (message: string | ((prev: string) => string)) => void
  setIsSending: (sending: boolean) => void
  onWorkflowEnd?: () => void  // ⭐ 新增：工作流结束时的回调
}

interface UseWorkflowAssistantReturn {
  // 状态
  workflowMode: WorkflowMode
  aiRecommendation: AIRecommendation | null
  isAnalyzing: boolean
  selectedFeeling: PrioritySortFeeling | null
  selectedAction: SingleTaskAction | null
  selectedTaskForDecompose: Task | null
  taskContextInput: string  // 用户输入的任务上下文（拆解用）
  contextQuestions: string[]  // 当前任务的问题列表（拆解用）
  
  // 任务澄清相关状态
  clarificationQuestions: ClarificationQuestion[]  // 澄清问题列表
  clarificationAnswer: string  // 用户的澄清回答
  structuredContext: StructuredContext | null  // AI提取的结构化上下文
  aiClarificationSummary: string  // AI生成的理解总结
  editableText: string  // ⭐ 用户编辑的澄清文本
  
  // ⭐ 时间估算相关状态
  estimationTask: Task | null  // 正在估算的任务
  estimationInitial: number | null  // 用户的初始估计（分钟）
  estimationReflection: string  // AI的反思问题
  
  // 方法
  startWorkflow: () => Promise<void>
  selectOption: (optionId: 'A' | 'B' | 'C') => void
  selectFeeling: (feeling: PrioritySortFeeling) => void
  selectAction: (action: SingleTaskAction) => void
  selectTaskForDecompose: (task: Task | null) => void
  submitTaskContext: (contextInput: string) => void  // 提交任务上下文（拆解用）
  skipTaskContext: () => void  // ⭐ 跳过任务上下文输入，使用默认上下文继续拆解
  cancelTaskContext: () => void  // ⭐ 取消任务拆解，返回上一级
  clearSelectedTask: () => void  // 静默清空选中任务，不发送消息
  goBackToSingleTaskAction: () => void // 静默返回到单任务操作选择
  
  // 任务澄清相关方法
  submitClarificationAnswer: (answer: string) => Promise<void>  // 提交澄清回答
  skipClarificationAnswer: () => void  // ⭐ 跳过澄清问题，返回上一级
  cancelClarificationAnswer: () => void  // ⭐ 取消任务澄清，返回上一级
  confirmClarification: () => void  // 确认澄清结果
  rejectClarification: () => void  // 重新澄清
  handleConfirmEdit: () => Promise<void>  // ⭐ 确认编辑后的澄清内容
  handleCancelEdit: () => void  // ⭐ 取消编辑
  setEditableText: (text: string) => void  // ⭐ 设置可编辑文本
  
  // ⭐ 时间估算相关方法
  selectTaskForEstimation: (task: Task) => void  // 选择要估算的任务
  submitInitialEstimation: (minutes: number) => Promise<void>  // 提交初始时间估计
  resubmitEstimation: (minutes: number) => Promise<void>  // 重新提交时间估计（反思后）
  confirmEstimation: (withBuffer: boolean) => void  // 确认最终估计（是否含buffer）
  cancelEstimation: () => void  // 取消估算，返回上一级
  
  resetWorkflow: () => void
}

/**
 * AI工作流辅助Hook
 */
export function useWorkflowAssistant({
  tasks,
  userProfile,
  dateScope,
  setChatMessages,
  setStreamingMessage,
  setIsSending,
  onWorkflowEnd
}: UseWorkflowAssistantProps): UseWorkflowAssistantReturn {
  
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('initial')
  const [aiRecommendation, setAIRecommendation] = useState<AIRecommendation | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedFeeling, setSelectedFeeling] = useState<PrioritySortFeeling | null>(null)
  const [selectedAction, setSelectedAction] = useState<SingleTaskAction | null>(null)
  const [selectedTaskForDecompose, setSelectedTaskForDecompose] = useState<Task | null>(null)
  const [taskContextInput, setTaskContextInput] = useState<string>('')  // 用户输入的任务上下文（拆解用）
  const [contextQuestions, setContextQuestions] = useState<string[]>([])  // 当前任务的问题列表（拆解用）
  
  // 任务澄清相关状态
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([])
  const [clarificationAnswer, setClarificationAnswer] = useState<string>('')
  const [structuredContext, setStructuredContext] = useState<StructuredContext | null>(null)
  const [aiClarificationSummary, setAIClarificationSummary] = useState<string>('')
  const [editableText, setEditableText] = useState<string>('')  // ⭐ 用户编辑的澄清文本
  
  // ⭐ 时间估算相关状态
  const [estimationTask, setEstimationTask] = useState<Task | null>(null)           // 正在估算的任务
  const [estimationInitial, setEstimationInitial] = useState<number | null>(null)    // 用户的初始估计（分钟）
  const [estimationReflection, setEstimationReflection] = useState<string>('')      // AI的反思问题
  
  // 用于取消正在进行的流式输出
  const cancelStreamRef = useRef<(() => void) | null>(null)
  
  /**
   * 辅助函数: 流式显示AI消息
   */
  const streamAIMessage = useCallback((text: string) => {
    // 先取消之前的流式输出(如果有)
    if (cancelStreamRef.current) {
      cancelStreamRef.current()
    }
    
    setStreamingMessage('')
    setIsSending(true)
    
    const cancel = streamText({
      text,
      onChunk: (chunk) => {
        setStreamingMessage(prev => prev + chunk)
      },
      onComplete: () => {
        // 流式输出完成,添加到消息列表
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: [{ type: 'text', text }]
          }
        ])
        setStreamingMessage('')
        setIsSending(false)
        cancelStreamRef.current = null
      },
      chunkSize: 2,
      delay: 30
    })
    
    cancelStreamRef.current = cancel
  }, [setChatMessages, setStreamingMessage, setIsSending])

  /**
   * 辅助函数: 流式显示带交互按钮的AI消息
   */
  const streamAIMessageWithInteractive = useCallback((
    text: string, 
    interactive: { type: InteractiveMessageType; data?: any }
  ) => {
    // 先取消之前的流式输出(如果有)
    if (cancelStreamRef.current) {
      cancelStreamRef.current()
    }
    
    setStreamingMessage('')
    setIsSending(true)
    
    const cancel = streamText({
      text,
      onChunk: (chunk) => {
        setStreamingMessage(prev => prev + chunk)
      },
      onComplete: () => {
        // 流式输出完成,添加到消息列表（包含交互按钮）
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: [
              { type: 'text', text },
              { 
                type: 'interactive', 
                interactive: {
                  type: interactive.type,
                  data: interactive.data || {},
                  isActive: true
                }
              }
            ]
          }
        ])
        setStreamingMessage('')
        setIsSending(false)
        cancelStreamRef.current = null
      },
      chunkSize: 2,
      delay: 30
    })
    
    cancelStreamRef.current = cancel
  }, [setChatMessages, setStreamingMessage, setIsSending])

  /**
   * 开始工作流: 分析任务并生成推荐
   */
  const startWorkflow = useCallback(async () => {
    try {
      setIsAnalyzing(true)
      setWorkflowMode('initial')
      
      // 使用当前范围的任务
      const scopedTasks = filterTasksByScope(tasks, dateScope)
      
      // 调用分析服务（传入dateScope）
      const recommendation = await analyzeTasksForWorkflow(tasks, userProfile, dateScope)
      setAIRecommendation(recommendation)
      
      // 生成详细任务摘要(包含任务列表)
      const detailedSummary = generateDetailedTaskSummary(scopedTasks, dateScope)
      
      // 生成置信度显示
      const confidenceEmoji = 
        recommendation.confidence === 'high' ? '⭐⭐⭐' :
        recommendation.confidence === 'medium' ? '⭐⭐' : '⭐'
      const confidenceText = 
        recommendation.confidence === 'high' ? 'High' : 
        recommendation.confidence === 'medium' ? 'Medium' : 'Low'
      
      // 获取范围描述
      const scopeText = getScopeDescription(dateScope)
      
      // 构建AI消息
      const aiMessage = `📋 Task Analysis for ${scopeText}

${detailedSummary}

---

💡 My Suggestion:
${recommendation.reason}

---

What would you like to do?`
      
      // 使用流式输出显示消息（带交互按钮）
      streamAIMessageWithInteractive(aiMessage, {
        type: 'workflow-options',
        data: {}
      })
      
    } catch (error) {
      console.error('工作流分析失败:', error)
      
      // 使用流式输出显示错误消息
      streamAIMessage('❌ Sorry, an error occurred while analyzing tasks. Please try again later.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [tasks, userProfile, dateScope, setChatMessages, streamAIMessage])

  /**
   * 用户选择选项
   */
  const selectOption = useCallback((optionId: 'A' | 'B' | 'C') => {
    // 禁用上一条消息的工作流选项按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'workflow-options')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    if (optionId === 'A') {
      // 选择完善单个任务 - 进入操作选择阶段
      setWorkflowMode('single-task-action')
      
      // 先添加用户消息
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '🔍 Refine Single Task' }]
        }
      ])
      
      // 然后流式显示AI回复（带交互按钮）
      streamAIMessageWithInteractive('Great! I can help you with the following:\n\nWhat would you like to do with the task?', {
        type: 'single-task-action',
        data: {}
      })
      
    } else if (optionId === 'B') {
      // 选择优先级排序 - 进入询问感觉阶段
      setWorkflowMode('priority-feeling')
      
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '📊 Sort All Tasks by Priority' }]
        }
      ])
      
      // 使用带交互按钮的流式输出
      streamAIMessageWithInteractive('Great! Before we start sorting, I\'d like to understand:\n\nHow are you feeling right now? This will help me recommend the best sorting method for you:', {
        type: 'feeling-options',
        data: {}
      })
      
    } else if (optionId === 'C') {
      // 结束AI辅助
      setWorkflowMode('ended')
      
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '✅ End AI Assistance' }]
        }
      ])
      
      const message = '👋 Alright! AI assistance has ended.\n\nIf you need help, just click the "Next, AI-assisted Planning" button anytime. Good luck with your tasks! 💪'
      streamAIMessage(message)
      
      // ⭐ 等待消息显示完成后1秒，关闭侧边栏
      const messageLength = message.length
      const streamDuration = messageLength * 20 // 假设每个字符20ms
      setTimeout(() => {
        onWorkflowEnd?.()
      }, streamDuration + 1000) // 流式输出完成 + 1秒延迟
    }
  }, [setChatMessages, streamAIMessage, streamAIMessageWithInteractive])

  /**
   * 用户选择感觉选项
   */
  const selectFeeling = useCallback((feeling: PrioritySortFeeling) => {
    // 禁用上一条消息的感觉选项按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'feeling-options')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    if (feeling === 'back') {
      // 返回初始状态
      setSelectedFeeling(null)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '↩️ Go Back' }]
        }
      ])
      
      // ⭐ 1秒后显示初始选项按钮
      setTimeout(() => {
        setWorkflowMode('initial')
        streamAIMessageWithInteractive('Alright, returned to previous level. What would you like to do?', {
          type: 'workflow-options',
          data: {}
        })
      }, 1000)
      return
    }
    
    // 选择了感觉选项A/B/C
    setSelectedFeeling(feeling)
    setWorkflowMode('priority-matrix')
    
    // 获取对应的矩阵类型和配置
    const matrixType = getMatrixTypeByFeeling(feeling)
    
    if (!matrixType) return
    
    const config = getMatrixConfig(matrixType)
    
    // 感觉选项映射
    const feelingMap = {
      urgent: { 
        emoji: '🔥',
        label: 'Deadline Approaching'
      },
      overwhelmed: { 
        emoji: '🤔',
        label: 'Too Many Tasks'
      },
      blank: { 
        emoji: '😫',
        label: 'Feeling Blank'
      }
    }
    
    const selected = feelingMap[feeling]
    
    // 根据不同类型生成不同的引导消息
    let guideMessage = ''
    
    if (feeling === 'urgent') {
      guideMessage = `Great! Let's use the [${config.title}] to quickly categorize today's tasks~

This matrix will help you divide tasks into four quadrants:
📍 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
📍 ${config.quadrants.q2.label}: ${config.quadrants.q2.description}
📍 ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
📍 ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

Please drag and drop tasks in the matrix that pops up! 👇`
    } else if (feeling === 'overwhelmed') {
      guideMessage = `Great! Let's use the [${config.title}] to find "high-return" tasks~

This matrix will help you identify:
🎯 ${config.quadrants.q2.label}: ${config.quadrants.q2.description} - These are the most worthwhile!
💎 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
⚠️ ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
✅ ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

Please drag and drop tasks in the matrix that pops up! 👇`
    } else if (feeling === 'blank') {
      guideMessage = `Great! Let's use the [${config.title}] to find tasks you want to do~

This matrix will help you discover:
🌟 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
⚡ ${config.quadrants.q2.label}: ${config.quadrants.q2.description}
😴 ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
😊 ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

Please drag and drop tasks in the matrix that pops up! 👇`
    }
    
    setChatMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: [{ type: 'text', text: `${selected.emoji} ${selected.label}` }]
      }
    ])
    
    streamAIMessage(guideMessage)
  }, [setChatMessages, streamAIMessage])

  /**
   * 用户选择单个任务操作
   */
  const selectAction = useCallback((action: SingleTaskAction) => {
    // 禁用上一条消息的单任务操作按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'single-task-action')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    if (action === 'back') {
      // 返回初始状态
      setSelectedAction(null)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '↩️ 返回上一级' }]
        }
      ])
      
      // ⭐ 1秒后显示初始选项按钮
      setTimeout(() => {
        setWorkflowMode('initial')
        streamAIMessageWithInteractive('Alright, returned to previous level. What would you like to do?', {
          type: 'workflow-options',
          data: {}
        })
      }, 1000)
      return
    }
    
    // 选择了操作选项 clarify/decompose/estimate
    setSelectedAction(action)
    
    const actionMap = {
      clarify: { 
        emoji: '📝',
        label: 'Task Clarification'
      },
      decompose: { 
        emoji: '🔨',
        label: 'Task Decomposition'
      },
      estimate: { 
        emoji: '⏱️',
        label: 'Time Estimation'
      }
    }
    
    const selected = actionMap[action]
    
    setChatMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: [{ type: 'text', text: `${selected.emoji} ${selected.label}` }]
      }
    ])
    
    // 如果是任务拆解、任务澄清或时间估计，进入任务选择模式
    if (action === 'decompose') {
      setWorkflowMode('task-selection')
      streamAIMessageWithInteractive('Great! I\'ll help you decompose the task.\n\nPlease select the task you want to decompose:', {
        type: 'task-selection',
        data: {}
      })
    } else if (action === 'clarify') {
      // ⭐ 为"任务澄清"给出建议与原因（使用dateScope筛选的任务）
      const scopedTasks = filterTasksByScope(tasks, dateScope)
      
      // ⭐ 调试日志
      console.log('🔍 [Clarify] 调试信息:')
      console.log('  - 所有任务数量:', tasks.length)
      console.log('  - dateScope:', {
        start: dateScope.start.toISOString(),
        end: dateScope.end.toISOString(),
        preset: dateScope.preset,
        includeOverdue: dateScope.includeOverdue
      })
      console.log('  - 筛选后任务数量:', scopedTasks.length)
      console.log('  - 筛选后任务:', scopedTasks.map(t => ({
        title: t.title,
        deadline: t.deadline_datetime,
        completed: t.completed
      })))
      
      const recommendations = recommendTasksForClarification(scopedTasks)
      console.log('  - 推荐任务数量:', recommendations.length)
      
      const recommendationMessage = formatRecommendationsMessage(recommendations)
      
      setWorkflowMode('task-selection')
      streamAIMessageWithInteractive(recommendationMessage, {
        type: 'task-selection',
        data: {}
      })
    } else if (action === 'estimate') {
      // ⭐ 新增: 任务时间估计功能，使用dateScope筛选的任务
      const scopedTasks = filterTasksByScope(tasks, dateScope)
      
      // ⭐ 调试日志
      console.log('🔍 [Estimate] 调试信息:')
      console.log('  - 所有任务数量:', tasks.length)
      console.log('  - dateScope:', {
        start: dateScope.start.toISOString(),
        end: dateScope.end.toISOString(),
        preset: dateScope.preset,
        includeOverdue: dateScope.includeOverdue
      })
      console.log('  - 筛选后任务数量:', scopedTasks.length)
      console.log('  - 筛选后任务:', scopedTasks.map(t => ({
        title: t.title,
        deadline: t.deadline_datetime,
        completed: t.completed
      })))
      
      const recommendations = recommendTasksForTimeEstimation(scopedTasks)
      console.log('  - 推荐任务数量:', recommendations.length)
      
      const recommendationMessage = formatTimeEstimationRecommendationsMessage(recommendations)
      
      setWorkflowMode('task-selection')
      streamAIMessageWithInteractive(recommendationMessage, {
        type: 'task-selection',
        data: {}
      })
    } else {
      // 其他未知功能
      streamAIMessage(`✅ Alright! I'll help you with ${selected.label}.\n\n**Feature under development...**\n\nStay tuned! 🚀`)
    }
  }, [setChatMessages, streamAIMessage, streamAIMessageWithInteractive, tasks, dateScope])

  /**
   * 用户选择要拆解的任务
   */
  const selectTaskForDecompose = useCallback(async (task: Task | null) => {
    // 禁用上一条消息的任务选择按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'task-selection')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    if (task === null) {
      // 返回上一级（返回到操作选择）
      setWorkflowMode('single-task-action')
      setSelectedTaskForDecompose(null)
      setTaskContextInput('')
      setContextQuestions([])
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '↩️ 返回上一级' }]
        }
      ])
      streamAIMessage('好的,已返回上一级。请重新选择操作:')
    } else {
      // 选择了任务
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: [{ type: 'text', text: `📌 ${task.title}` }] }
      ])

      if (selectedAction === 'decompose') {
        // ⭐ 拆解路径：使用AI动态生成拆解问题
        setSelectedTaskForDecompose(task)
        
        // 显示加载动画
        setIsSending(true)
        streamAIMessage('正在分析任务，生成拆解引导问题...')
        
        try {
          // 调用AI生成问题（带降级方案）
          const result = await generateDecompositionQuestionsWithFallback(task)
          
          // 清空加载消息，显示问题
          setStreamingMessage('')
          setIsSending(false)
          
          // 保存问题到状态
          setContextQuestions(result.questions)
          
          // 进入上下文输入模式
          setWorkflowMode('task-context-input')
          
          // 显示问题消息
          streamAIMessage(result.message)
          
        } catch (error) {
          // 如果连降级方案都失败了（极端情况）
          console.error('拆解问题生成完全失败:', error)
          setIsSending(false)
          streamAIMessage('抱歉，问题生成失败了。请稍后再试，或者选择其他操作。')
          setWorkflowMode('single-task-action')
        }
      } else if (selectedAction === 'clarify') {
        // ⭐ 澄清路径：使用AI动态生成澄清问题
        setSelectedTaskForDecompose(task)
        
        // 显示加载动画
        setIsSending(true)
        streamAIMessage('正在分析任务，生成问题...')
        
        try {
          // 调用AI生成问题（带降级方案）
          const result = await generateClarificationQuestionsWithFallback(task)
          
          // 清空加载消息，显示问题
          setStreamingMessage('')
          setIsSending(false)
          
          // 保存问题到状态（注意：现在questions是string[]而不是ClarificationQuestion[]）
          // 为了兼容后续流程，我们需要转换格式
          const clarificationQuestions: ClarificationQuestion[] = result.questions.map((q) => ({
            dimension: 'dynamic',
            question: q,
            purpose: 'AI动态生成的问题'
          }))
          setClarificationQuestions(clarificationQuestions)
          
          // 进入澄清输入模式
          setWorkflowMode('task-clarification-input')
          
          // 显示问题消息
          streamAIMessage(result.message)
          
        } catch (error) {
          // 如果连降级方案都失败了（极端情况）
          console.error('问题生成完全失败:', error)
          setIsSending(false)
          streamAIMessage('抱歉，问题生成失败了。请稍后再试，或者选择其他操作。')
          setWorkflowMode('single-task-action')
        }
      } else if (selectedAction === 'estimate') {
        // ⭐ 时间估算路径：进入时间输入模式
        setEstimationTask(task)
        setWorkflowMode('task-estimation-input')
        streamAIMessage(`Great! Let's estimate how long "${task.title}" will take.\n\nPlease select or enter your time estimate:`)
      }
    }
  }, [setChatMessages, streamAIMessage, selectedAction, setIsSending, setStreamingMessage])

  /**
   * 提交任务上下文
   */
  const submitTaskContext = useCallback((contextInput: string) => {
    // 保存用户输入（允许为空）
    if (contextInput.trim()) {
      setTaskContextInput(contextInput)
      // 仅保留确认语，不再提示"正在为你打开任务拆解工具..."
      streamAIMessage('Understood! I\'ll decompose the task based on the information you provided.')
    } else {
      setTaskContextInput('')
      // 用户未提供额外上下文，静默进入下一步
    }

    // 切换到单任务模式，dashboard 会监听并触发拆解
    setWorkflowMode('single-task')
  }, [streamAIMessage])

  /**
   * ⭐ 跳过任务上下文输入，使用默认上下文继续拆解
   */
  const skipTaskContext = useCallback(() => {
    // 清空用户输入
    setTaskContextInput('')
    
    // 显示AI消息
    streamAIMessage('Alright, let\'s start decomposing the task directly without additional background.')
    
    // 继续拆解流程
    setWorkflowMode('single-task')
  }, [streamAIMessage])

  /**
   * ⭐ 取消任务拆解，返回上一级
   */
  const cancelTaskContext = useCallback(() => {
    // 清空输入
    setTaskContextInput('')
    
    // ⭐ 生成智能引导消息
    const guidanceMessage = getGuidanceMessage('action-cancelled-decompose', {
      currentTask: selectedTaskForDecompose || undefined,
      allTasks: tasks,
      dateScope
    })
    
    // 清空选中的任务
    setSelectedTaskForDecompose(null)
    
    // 显示用户取消消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '← Cancel' }] }
    ])
    
    // 1秒后显示 single-task-action 按钮
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive(guidanceMessage, {
        type: 'single-task-action',
        data: {}
      })
    }, 1000)
  }, [setChatMessages, streamAIMessageWithInteractive, selectedTaskForDecompose, tasks, dateScope])

  /**
   * 静默清空选中任务（不发送消息）
   */
  const clearSelectedTask = useCallback(() => {
    setSelectedTaskForDecompose(null)
    setTaskContextInput('')
    setContextQuestions([])
  }, [])

  // 静默返回到操作选择层级
  const goBackToSingleTaskAction = useCallback(() => {
    setWorkflowMode('single-task-action')
    setSelectedTaskForDecompose(null)
    setTaskContextInput('')
    setContextQuestions([])
    setClarificationQuestions([])
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
  }, [])

  /**
   * 提交澄清回答
   */
  const submitClarificationAnswer = useCallback(async (answer: string) => {
    if (!selectedTaskForDecompose) return
    
    setClarificationAnswer(answer)
    
    // 显示用户消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: answer }] }
    ])
    
    // 调用AI服务进行结构化整合
    setIsSending(true)
    
    try {
      const result = await doubaoService.clarifyTask(
        selectedTaskForDecompose.title,
        selectedTaskForDecompose.description,
        clarificationQuestions,
        answer,
        userProfile
      )
      
      setIsSending(false)
      
      if (result.success && result.structured_context && result.summary) {
        // 保存结构化上下文和总结
        setStructuredContext(result.structured_context)
        setAIClarificationSummary(result.summary)
        
        // 流式显示AI的理解总结（带确认按钮）
        streamAIMessageWithInteractive(result.summary, {
          type: 'clarification-confirm',
          data: {}
        })
        
        // 注意：不在这里自动切换状态，等待用户确认或修正
      } else {
        // AI调用失败，显示错误
        streamAIMessage(`❌ Sorry, there was an issue processing your response: ${result.error || 'Unknown error'}\n\nPlease try describing again.`)
        // 重置澄清状态，允许用户重新回答
        setClarificationAnswer('')
        setStructuredContext(null)
        setAIClarificationSummary('')
      }
    } catch (error) {
      console.error('提交澄清回答失败:', error)
      setIsSending(false)
      streamAIMessage('❌ 处理失败，请稍后重试。')
      setClarificationAnswer('')
      setStructuredContext(null)
      setAIClarificationSummary('')
    }
  }, [selectedTaskForDecompose, clarificationQuestions, setChatMessages, streamAIMessage, streamAIMessageWithInteractive, setIsSending])

  /**
   * 确认澄清结果
   * 注意：实际的任务更新需要在Dashboard中调用 appendStructuredContextToTask
   */
  const confirmClarification = useCallback(() => {
    if (!selectedTaskForDecompose || !structuredContext) return
    
    // 禁用上一条消息的澄清确认按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'clarification-confirm')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    // 显示用户确认消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '✅ Confirmed, that\'s it' }] }
    ])
    
    // ⭐ 生成智能引导消息
    let successMessage = 'Great! I have understood your task.'
    
    if (structuredContext.deadline_datetime && structuredContext.deadline_confidence) {
      const deadline = new Date(structuredContext.deadline_datetime)
      const deadlineStr = deadline.toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      })
      
      successMessage += `\n\n⏰ I've set the task deadline to: ${deadlineStr}`
      
      if (structuredContext.deadline_confidence === 'medium') {
        successMessage += '\n(If there\'s a discrepancy, please manually adjust it in the task list)'
      }
    }
    
    // ⭐ 添加智能引导
    const guidanceMessage = getGuidanceMessage('action-completed-clarify', {
      currentTask: selectedTaskForDecompose,
      allTasks: tasks,
      dateScope
    })
    
    successMessage += '\n\n' + guidanceMessage
    
    streamAIMessage(successMessage)
    
    // 清空澄清状态
    setClarificationQuestions([])
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
    
    // ⭐ 1秒后自动显示单任务操作按钮，让用户可以继续完善
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive('Nice! Anything else you\'d like to do with this task?', {
        type: 'single-task-action',
        data: {}
      })
    }, 1000)
  }, [selectedTaskForDecompose, structuredContext, setChatMessages, streamAIMessage, streamAIMessageWithInteractive, tasks, dateScope])

  /**
   * 重新澄清
   */
  const rejectClarification = useCallback(() => {
    // 禁用上一条消息的澄清确认按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'clarification-confirm')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    // 显示用户选择修正的消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '✏️ Needs correction' }] }
    ])
    
    // 初始化可编辑文本
    const editText = formatSummaryForEdit(aiClarificationSummary)
    setEditableText(editText)
    
    // 进入编辑模式，不清空数据
    setWorkflowMode('clarification-edit')
    
    // 显示提示消息
    streamAIMessage('Alright! You can directly edit the content below. After making changes, click "Confirm Edit".')
  }, [aiClarificationSummary, setChatMessages, streamAIMessage])

  /**
   * ⭐ 确认编辑后的澄清内容
   */
  const handleConfirmEdit = useCallback(async () => {
    if (!selectedTaskForDecompose || !editableText.trim()) return
    
    setIsSending(true)
    
    try {
      // 调用AI重新解析编辑后的文本
      const result = await doubaoService.reparseTaskClarification(
        selectedTaskForDecompose.title,
        editableText,
        userProfile
      )
      
      setIsSending(false)
      
      if (result.success && result.structured_context && result.summary) {
        // 更新结构化上下文和总结
        setStructuredContext(result.structured_context)
        setAIClarificationSummary(result.summary)
        
        // 显示用户的编辑消息
        setChatMessages(prev => [
          ...prev,
          { role: 'user', content: [{ type: 'text', text: '✅ Edit confirmed' }] }
        ])
        
        // 显示AI确认消息并提供确认按钮
        streamAIMessageWithInteractive(result.summary, {
          type: 'clarification-confirm',
          data: {}
        })
        
        // 退出编辑模式
        setWorkflowMode('task-clarification-input')
      } else {
        throw new Error('Failed to re-parse')
      }
    } catch (error) {
      console.error('重新解析任务失败:', error)
      setIsSending(false)
      streamAIMessage('Sorry, AI encountered an issue while parsing your edit. Please try again later.')
    }
  }, [editableText, selectedTaskForDecompose, userProfile, setIsSending, setChatMessages, streamAIMessage, streamAIMessageWithInteractive])

  /**
   * ⭐ 取消编辑，返回到澄清确认状态
   */
  const handleCancelEdit = useCallback(() => {
    // 清空编辑文本
    setEditableText('')
    
    // 显示用户取消消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '❌ Cancel edit' }] }
    ])
    
    // 返回到原来的澄清确认状态
    setWorkflowMode('task-clarification-input')
    
    // 重新显示AI的理解和确认按钮
    streamAIMessageWithInteractive(aiClarificationSummary, {
      type: 'clarification-confirm',
      data: {}
    })
  }, [aiClarificationSummary, setChatMessages, streamAIMessageWithInteractive])

  /**
   * ⭐ 跳过澄清问题，返回上一级
   */
  const skipClarificationAnswer = useCallback(() => {
    // 清空澄清状态
    setClarificationQuestions([])
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
    
    // 显示AI消息
    streamAIMessage('Alright, let\'s skip these questions for now.')
    
    // 返回到单任务操作选择
    setWorkflowMode('single-task-action')
  }, [streamAIMessage])

  /**
   * ⭐ 取消任务澄清，返回上一级
   */
  const cancelClarificationAnswer = useCallback(() => {
    // ⭐ 生成智能引导消息（在清空状态前）
    const guidanceMessage = getGuidanceMessage('action-cancelled-clarify', {
      currentTask: selectedTaskForDecompose || undefined,
      allTasks: tasks,
      dateScope
    })
    
    // 清空澄清状态和选中的任务
    setClarificationQuestions([])
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
    setSelectedTaskForDecompose(null)
    
    // 显示用户取消消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '← Cancel' }] }
    ])
    
    // 1秒后显示 single-task-action 按钮
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive(guidanceMessage, {
        type: 'single-task-action',
        data: {}
      })
    }, 1000)
  }, [setChatMessages, streamAIMessageWithInteractive, selectedTaskForDecompose, tasks, dateScope])

  // ============================================
  // ⭐ 时间估算相关方法
  // ============================================
  
  /**
   * 选择要估算时间的任务（由selectTaskForDecompose调用）
   */
  const selectTaskForEstimation = useCallback((task: Task) => {
    setEstimationTask(task)
    setWorkflowMode('task-estimation-input')
    streamAIMessage(`Great! Let's estimate how long "${task.title}" will take.\n\nPlease select or enter your time estimate:`)
  }, [streamAIMessage])
  
  /**
   * 提交初始时间估计
   */
  const submitInitialEstimation = useCallback(async (minutes: number) => {
    if (!estimationTask) return
    
    setEstimationInitial(minutes)
    
    // 显示用户输入
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: `${minutes} minutes` }] }
    ])
    
    // 显示加载状态
    setIsSending(true)
    setStreamingMessage('Thinking...')
    
    // 调用AI生成个性化反思问题
    try {
      // 构建估算专用的用户画像（因为全局UserProfile不包含估算相关字段）
      const userProfileData = buildUserProfile(tasks)
      const reflection = await generateReflectionQuestion({
        task: estimationTask,
        userProfile: userProfileData,
        initialEstimate: minutes
      })
      
      setEstimationReflection(reflection)
      
      // 显示反思问题，让用户重新考虑
      // reflection包含3个问题，用换行分隔
      const message = `Think about these questions:\n\n${reflection}\n\nAfter reconsidering, please confirm or adjust your time estimate:`
      
      streamAIMessage(message)
      setWorkflowMode('task-estimation-reflection')
    } catch (error) {
      console.error('❌ 生成反思问题失败:', error)
      // 降级：使用规则反思（3个问题）
      const message = `Think about these questions:\n\n• Are there any hidden steps or prerequisites in this task?\n• If you need to research or learn new skills, how much extra time will it take?\n• How long will checking and wrapping up the task take?\n\nAfter reconsidering, please confirm or adjust your time estimate:`
      
      streamAIMessage(message)
      setWorkflowMode('task-estimation-reflection')
    }
  }, [estimationTask, tasks, setChatMessages, setStreamingMessage, setIsSending, streamAIMessage])
  
  /**
   * ⭐ 用户重新提交时间估计（反思后）
   */
  const resubmitEstimation = useCallback(async (minutes: number) => {
    if (!estimationTask) return
    
    setEstimationInitial(minutes)
    
    // 显示用户输入
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: `${minutes} minutes` }] }
    ])
    
    // 进入buffer询问阶段
    const bufferMinutes = calculateBuffer(minutes)
    const totalWithBuffer = minutes + bufferMinutes
    const message = `Perfect! If you add a 20% buffer (about ${bufferMinutes} minutes), that's ${totalWithBuffer} minutes total, which would give you more breathing room.\n\nDo you want to add buffer time?`
    
    streamAIMessageWithInteractive(message, {
      type: 'estimation-confirm',
      data: { estimateMinutes: minutes }
    })
    setWorkflowMode('task-estimation-buffer')
  }, [estimationTask, setChatMessages, streamAIMessage, streamAIMessageWithInteractive])
  
  /**
   * 确认最终估计（是否含buffer）
   * 需要在dashboard中调用updateTask API
   */
  const confirmEstimation = useCallback((withBuffer: boolean) => {
    if (!estimationTask || !estimationInitial) return
    
    // 禁用上一条消息的估时确认按钮
    setChatMessages(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.content.some(c => c.type === 'interactive' && c.interactive?.type === 'estimation-confirm')) {
        return {
          ...msg,
          content: msg.content.map(c => 
            c.type === 'interactive' 
              ? { ...c, interactive: { ...c.interactive!, isActive: false } }
              : c
          )
        }
      }
      return msg
    }))

    const finalMinutes = encodeEstimatedDuration(estimationInitial, withBuffer)
    
    // 这个方法只负责更新本地状态和显示确认消息
    // 实际的数据库更新由dashboard的onEstimationConfirm处理
    const totalMinutes = withBuffer ? Math.ceil(estimationInitial * 1.2) : estimationInitial
    const displayText = withBuffer 
      ? `${totalMinutes} minutes (with 20% buffer)`
      : `${estimationInitial} minutes`
    
    // 显示用户选择
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: withBuffer ? '✅ Add buffer time' : '⏱️ Just this time' }] }
    ])
    
    // ⭐ 生成智能引导消息
    const guidanceMessage = getGuidanceMessage('action-completed-estimate', {
      currentTask: estimationTask,
      allTasks: tasks,
      dateScope
    })
    
    streamAIMessage(`✅ Recorded! The estimated duration for task "${estimationTask.title}" is: ${displayText}\n\n${guidanceMessage}`)
    
    // 清空估算状态
    clearEstimationState()
    
    // ⭐ 1秒后自动显示单任务操作按钮，让用户可以继续完善
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive('Time estimation complete! Need any other help?', {
        type: 'single-task-action',
        data: {}
      })
    }, 1000)
  }, [estimationTask, estimationInitial, setChatMessages, streamAIMessage, streamAIMessageWithInteractive, tasks, dateScope])
  
  /**
   * 取消估算，返回上一级
   */
  const cancelEstimation = useCallback(() => {
    // ⭐ 生成智能引导消息（在清空状态前获取任务信息）
    const guidanceMessage = getGuidanceMessage('action-cancelled-estimate', {
      currentTask: estimationTask || undefined,
      allTasks: tasks,
      dateScope
    })
    
    // 清空估算状态
    setEstimationTask(null)
    setEstimationInitial(null)
    setEstimationReflection('')
    
    // 显示取消消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '← Cancel' }] }
    ])
    
    // 1秒后显示 single-task-action 按钮
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive(guidanceMessage, {
        type: 'single-task-action',
        data: {}
      })
    }, 1000)
  }, [setChatMessages, streamAIMessageWithInteractive, estimationTask, tasks, dateScope])
  
  /**
   * 清空估算状态（内部辅助方法）
   */
  const clearEstimationState = useCallback(() => {
    setEstimationTask(null)
    setEstimationInitial(null)
    setEstimationReflection('')
  }, [])
  
  /**
   * 重置工作流状态
   */
  const resetWorkflow = useCallback(() => {
    setWorkflowMode('initial')
    setAIRecommendation(null)
    setIsAnalyzing(false)
    setSelectedFeeling(null)
    setSelectedAction(null)
    setSelectedTaskForDecompose(null)
    setTaskContextInput('')
    setContextQuestions([])
    setClarificationQuestions([])
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
    // ⭐ 清空估算状态
    setEstimationTask(null)
    setEstimationInitial(null)
    setEstimationReflection('')
  }, [])

  return {
    // 状态
    workflowMode,
    aiRecommendation,
    isAnalyzing,
    selectedFeeling,
    selectedAction,
    selectedTaskForDecompose,
    taskContextInput,
    contextQuestions,
    
    // 澄清相关状态
    clarificationQuestions,
    clarificationAnswer,
    structuredContext,
    aiClarificationSummary,
    editableText,
    
    // ⭐ 估算相关状态
    estimationTask,
    estimationInitial,
    estimationReflection,
    
    // 方法
    startWorkflow,
    selectOption,
    selectFeeling,
    selectAction,
    selectTaskForDecompose,
    submitTaskContext,
    skipTaskContext,  // ⭐ 新增
    cancelTaskContext,  // ⭐ 新增
    clearSelectedTask,
    goBackToSingleTaskAction,
    
    // 澄清相关方法
    submitClarificationAnswer,
    skipClarificationAnswer,  // ⭐ 新增
    cancelClarificationAnswer,  // ⭐ 新增
    confirmClarification,
    rejectClarification,
    handleConfirmEdit,
    handleCancelEdit,
    setEditableText,
    
    // ⭐ 估算相关方法
    selectTaskForEstimation,
    submitInitialEstimation,
    resubmitEstimation,
    confirmEstimation,
    cancelEstimation,

    resetWorkflow
  }
}

