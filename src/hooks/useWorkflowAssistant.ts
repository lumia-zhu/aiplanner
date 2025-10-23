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
        recommendation.confidence === 'high' ? '高' : 
        recommendation.confidence === 'medium' ? '中' : '低'
      
      // 获取范围描述
      const scopeText = getScopeDescription(dateScope)
      
      // 构建AI消息
      const aiMessage = `📋 ${scopeText}的任务分析

${detailedSummary}

---

💡 我的建议:
${recommendation.reason}

---

请选择你想做什么:`
      
      // 使用流式输出显示消息（带交互按钮）
      streamAIMessageWithInteractive(aiMessage, {
        type: 'workflow-options',
        data: {}
      })
      
    } catch (error) {
      console.error('工作流分析失败:', error)
      
      // 使用流式输出显示错误消息
      streamAIMessage('❌ 抱歉,分析任务时出现了问题。请稍后再试。')
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
          content: [{ type: 'text', text: '🔍 完善单个任务' }]
        }
      ])
      
      // 然后流式显示AI回复（带交互按钮）
      streamAIMessageWithInteractive('好的!我可以帮你做以下操作:\n\n请选择你想对任务进行什么操作:', {
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
          content: [{ type: 'text', text: '📊 对所有任务做优先级排序' }]
        }
      ])
      
      // 使用带交互按钮的流式输出
      streamAIMessageWithInteractive('好的!在开始排序之前,我想了解一下:\n\n你现在主要的感觉是什么? 这将帮助我推荐最适合你的排序方法:', {
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
          content: [{ type: 'text', text: '✅ 结束AI辅助' }]
        }
      ])
      
      const message = '👋 好的!AI辅助已结束。\n\n如果需要帮助,随时点击"下一步,AI辅助完善计划"按钮即可。祝你高效完成任务! 💪'
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
          content: [{ type: 'text', text: '↩️ 返回上一级' }]
        }
      ])
      
      // ⭐ 1秒后显示初始选项按钮
      setTimeout(() => {
        setWorkflowMode('initial')
        streamAIMessageWithInteractive('好的，已返回上一级。请重新选择你想做什么:', {
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
        label: '截止日期临近'
      },
      overwhelmed: { 
        emoji: '🤔',
        label: '任务太多太乱'
      },
      blank: { 
        emoji: '😫',
        label: '大脑一片空白'
      }
    }
    
    const selected = feelingMap[feeling]
    
    // 根据不同类型生成不同的引导消息
    let guideMessage = ''
    
    if (feeling === 'urgent') {
      guideMessage = `好的!我们来用【${config.title}】快速分类今天的任务~

这个矩阵会帮你把任务分成四个象限:
📍 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
📍 ${config.quadrants.q2.label}: ${config.quadrants.q2.description}
📍 ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
📍 ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

请在弹出的矩阵中拖拽任务进行分类吧! 👇`
    } else if (feeling === 'overwhelmed') {
      guideMessage = `好的!我们来用【${config.title}】找到"高回报"的任务~

这个矩阵会帮你识别:
🎯 ${config.quadrants.q2.label}: ${config.quadrants.q2.description} - 这些是最值得做的!
💎 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
⚠️ ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
✅ ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

请在弹出的矩阵中拖拽任务进行分类吧! 👇`
    } else if (feeling === 'blank') {
      guideMessage = `好的!我们来用【${config.title}】找到你想做的任务~

这个矩阵会帮你发现:
🌟 ${config.quadrants.q1.label}: ${config.quadrants.q1.description}
⚡ ${config.quadrants.q2.label}: ${config.quadrants.q2.description}
😴 ${config.quadrants.q3.label}: ${config.quadrants.q3.description}
😊 ${config.quadrants.q4.label}: ${config.quadrants.q4.description}

请在弹出的矩阵中拖拽任务进行分类吧! 👇`
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
        streamAIMessageWithInteractive('好的，已返回上一级。请重新选择你想做什么:', {
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
        label: '任务澄清'
      },
      decompose: { 
        emoji: '🔨',
        label: '任务拆解'
      },
      estimate: { 
        emoji: '⏱️',
        label: '任务时间估计'
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
      streamAIMessageWithInteractive('好的！我来帮你拆解任务。\n\n请选择你想要拆解的任务：', {
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
      streamAIMessage(`✅ 好的!我会帮你进行${selected.label}。\n\n**功能开发中...**\n\n敬请期待! 🚀`)
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
        streamAIMessage(`好的！我们来估算「${task.title}」需要多久。\n\n请选择或输入你的时间估计：`)
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
      streamAIMessage('明白了！我会根据你提供的信息来拆解任务。')
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
    streamAIMessage('好的，我们直接开始拆解任务，无需额外背景信息。')
    
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
      { role: 'user', content: [{ type: 'text', text: '← 取消' }] }
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
        answer
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
        streamAIMessage(`❌ 抱歉，处理你的回答时遇到了问题：${result.error || '未知错误'}\n\n请尝试重新描述。`)
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
      { role: 'user', content: [{ type: 'text', text: '✅ 确认，就是这样' }] }
    ])
    
    // ⭐ 生成智能引导消息
    let successMessage = '太好了！我已经理解了你的任务。'
    
    if (structuredContext.deadline_datetime && structuredContext.deadline_confidence) {
      const deadline = new Date(structuredContext.deadline_datetime)
      const deadlineStr = deadline.toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      })
      
      successMessage += `\n\n⏰ 我已将任务截止时间设置为：${deadlineStr}`
      
      if (structuredContext.deadline_confidence === 'medium') {
        successMessage += '\n（如有偏差请在任务列表中手动调整）'
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
      streamAIMessageWithInteractive('很好！还想对这个任务做点什么吗？', {
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

    // 显示用户拒绝消息
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: '✏️ 重新描述' }] }
    ])
    
    // 清空当前澄清结果，回到输入状态
    setClarificationAnswer('')
    setStructuredContext(null)
    setAIClarificationSummary('')
    
    streamAIMessage('好的，请重新回答刚才的问题，我会更仔细地理解你的意思。')
  }, [setChatMessages, streamAIMessage])

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
    streamAIMessage('好的，我们暂时跳过这些问题。')
    
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
      { role: 'user', content: [{ type: 'text', text: '← 取消' }] }
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
    streamAIMessage(`好的！我们来估算「${task.title}」需要多久。\n\n请选择或输入你的时间估计：`)
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
      { role: 'user', content: [{ type: 'text', text: `${minutes}分钟` }] }
    ])
    
    // 显示加载状态
    setIsSending(true)
    setStreamingMessage('正在思考...')
    
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
      const message = `再想一想这几个问题：\n\n${reflection}\n\n请重新考虑后，确认或修改你的时间估计：`
      
      streamAIMessage(message)
      setWorkflowMode('task-estimation-reflection')
    } catch (error) {
      console.error('❌ 生成反思问题失败:', error)
      // 降级：使用规则反思（3个问题）
      const message = `再想一想这几个问题：\n\n• 这个任务有没有隐藏的步骤或前置工作？\n• 如果需要查资料或学习新知识，会额外花多久？\n• 任务完成后的检查和收尾工作需要多久？\n\n请重新考虑后，确认或修改你的时间估计：`
      
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
      { role: 'user', content: [{ type: 'text', text: `${minutes}分钟` }] }
    ])
    
    // 进入buffer询问阶段
    const bufferMinutes = calculateBuffer(minutes)
    const totalWithBuffer = minutes + bufferMinutes
    const message = `好的！那如果再加上20%的缓冲时间（约${bufferMinutes}分钟），总共${totalWithBuffer}分钟，你会更从容。\n\n要加上缓冲时间吗？`
    
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
      ? `${totalMinutes}分钟（含20%缓冲）`
      : `${estimationInitial}分钟`
    
    // 显示用户选择
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: [{ type: 'text', text: withBuffer ? '✅ 加上缓冲时间' : '⏱️ 就这个时间' }] }
    ])
    
    // ⭐ 生成智能引导消息
    const guidanceMessage = getGuidanceMessage('action-completed-estimate', {
      currentTask: estimationTask,
      allTasks: tasks,
      dateScope
    })
    
    streamAIMessage(`✅ 已记录！任务「${estimationTask.title}」的预估时长为：${displayText}\n\n${guidanceMessage}`)
    
    // 清空估算状态
    clearEstimationState()
    
    // ⭐ 1秒后自动显示单任务操作按钮，让用户可以继续完善
    setTimeout(() => {
      setWorkflowMode('single-task-action')
      streamAIMessageWithInteractive('时间估算完成！还需要其他帮助吗？', {
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
      { role: 'user', content: [{ type: 'text', text: '← 取消' }] }
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
    
    // ⭐ 估算相关方法
    selectTaskForEstimation,
    submitInitialEstimation,
    resubmitEstimation,
    confirmEstimation,
    cancelEstimation,

    resetWorkflow
  }
}

