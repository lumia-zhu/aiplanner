/**
 * AI工作流辅助Hook
 * 负责管理AI辅助完善计划的状态和逻辑
 */

import { useState, useCallback, useRef } from 'react'
import type { Task, UserProfile, WorkflowMode, AIRecommendation, PrioritySortFeeling, SingleTaskAction } from '@/types'
import type { ChatMessage } from '@/lib/doubaoService'
import { analyzeTasksForWorkflow, getTodayTasks, generateDetailedTaskSummary } from '@/lib/workflowAnalyzer'
import { getMatrixTypeByFeeling, getMatrixConfig } from '@/types'
import { streamText } from '@/utils/streamText'
import { generateContextQuestions, formatQuestionsMessage } from '@/lib/contextQuestions'

interface UseWorkflowAssistantProps {
  tasks: Task[]
  userProfile: UserProfile | null
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  setStreamingMessage: (message: string | ((prev: string) => string)) => void
  setIsSending: (sending: boolean) => void
}

interface UseWorkflowAssistantReturn {
  // 状态
  workflowMode: WorkflowMode
  aiRecommendation: AIRecommendation | null
  isAnalyzing: boolean
  selectedFeeling: PrioritySortFeeling | null
  selectedAction: SingleTaskAction | null
  selectedTaskForDecompose: Task | null
  taskContextInput: string  // 用户输入的任务上下文
  contextQuestions: string[]  // 当前任务的问题列表
  
  // 方法
  startWorkflow: () => Promise<void>
  selectOption: (optionId: 'A' | 'B' | 'C') => void
  selectFeeling: (feeling: PrioritySortFeeling) => void
  selectAction: (action: SingleTaskAction) => void
  selectTaskForDecompose: (task: Task | null) => void
  submitTaskContext: (contextInput: string) => void  // 提交任务上下文
  clearSelectedTask: () => void  // 静默清空选中任务，不发送消息
  goBackToSingleTaskAction: () => void // 静默返回到单任务操作选择
  resetWorkflow: () => void
}

/**
 * AI工作流辅助Hook
 */
export function useWorkflowAssistant({
  tasks,
  userProfile,
  setChatMessages,
  setStreamingMessage,
  setIsSending
}: UseWorkflowAssistantProps): UseWorkflowAssistantReturn {
  
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('initial')
  const [aiRecommendation, setAIRecommendation] = useState<AIRecommendation | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedFeeling, setSelectedFeeling] = useState<PrioritySortFeeling | null>(null)
  const [selectedAction, setSelectedAction] = useState<SingleTaskAction | null>(null)
  const [selectedTaskForDecompose, setSelectedTaskForDecompose] = useState<Task | null>(null)
  const [taskContextInput, setTaskContextInput] = useState<string>('')  // 用户输入的任务上下文
  const [contextQuestions, setContextQuestions] = useState<string[]>([])  // 当前任务的问题列表
  
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
   * 开始工作流: 分析任务并生成推荐
   */
  const startWorkflow = useCallback(async () => {
    try {
      setIsAnalyzing(true)
      setWorkflowMode('initial')
      
      // 获取今天的任务
      const todayTasks = getTodayTasks(tasks)
      
      // 调用分析服务
      const recommendation = await analyzeTasksForWorkflow(tasks, userProfile)
      setAIRecommendation(recommendation)
      
      // 生成详细任务摘要(包含任务列表)
      const detailedSummary = generateDetailedTaskSummary(todayTasks)
      
      // 生成置信度显示
      const confidenceEmoji = 
        recommendation.confidence === 'high' ? '⭐⭐⭐' :
        recommendation.confidence === 'medium' ? '⭐⭐' : '⭐'
      const confidenceText = 
        recommendation.confidence === 'high' ? '高' : 
        recommendation.confidence === 'medium' ? '中' : '低'
      
      // 构建AI消息
      const aiMessage = `📋 今天的任务分析

${detailedSummary}

---

💡 我的建议:
${recommendation.reason}

---

请选择你想做什么:`
      
      // 使用流式输出显示消息
      streamAIMessage(aiMessage)
      
    } catch (error) {
      console.error('工作流分析失败:', error)
      
      // 使用流式输出显示错误消息
      streamAIMessage('❌ 抱歉,分析任务时出现了问题。请稍后再试。')
    } finally {
      setIsAnalyzing(false)
    }
  }, [tasks, userProfile, setChatMessages, streamAIMessage])

  /**
   * 用户选择选项
   */
  const selectOption = useCallback((optionId: 'A' | 'B' | 'C') => {
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
      
      // 然后流式显示AI回复
      streamAIMessage('好的!我可以帮你做以下操作:\n\n请选择你想对任务进行什么操作:')
      
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
      
      streamAIMessage('好的!在开始排序之前,我想了解一下:\n\n你现在主要的感觉是什么? 这将帮助我推荐最适合你的排序方法:')
      
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
      
      streamAIMessage('👋 好的!AI辅助已结束。\n\n如果需要帮助,随时点击"下一步,AI辅助完善计划"按钮即可。祝你高效完成任务! 💪')
    }
  }, [setChatMessages, streamAIMessage])

  /**
   * 用户选择感觉选项
   */
  const selectFeeling = useCallback((feeling: PrioritySortFeeling) => {
    if (feeling === 'back') {
      // 返回初始状态
      setWorkflowMode('initial')
      setSelectedFeeling(null)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '↩️ 返回上一级' }]
        }
      ])
      streamAIMessage('好的,已返回上一级。请重新选择你想做什么:')
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
    if (action === 'back') {
      // 返回初始状态
      setWorkflowMode('initial')
      setSelectedAction(null)
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '↩️ 返回上一级' }]
        }
      ])
      streamAIMessage('好的,已返回上一级。请重新选择你想做什么:')
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
    
    // 如果是任务拆解或任务澄清，进入任务选择模式
    if (action === 'decompose') {
      setWorkflowMode('task-selection')
      streamAIMessage('好的！我来帮你拆解任务。\n\n请选择你想要拆解的任务：')
    } else if (action === 'clarify') {
      // 为“任务澄清”给出建议与原因，再进入任务选择
      const todayTasks = getTodayTasks(tasks)
      const candidates: { title: string; reason: string }[] = []
      for (const t of todayTasks) {
        if (!t.description || t.description.trim().length < 6) {
          candidates.push({ title: t.title, reason: '没有描述或描述过于简短' })
          continue
        }
        if (t.title.length > 28 || /[?？]/.test(t.title)) {
          candidates.push({ title: t.title, reason: '标题过长/含不确定性，需要明确产出与范围' })
          continue
        }
        if (t.tags?.includes('difficult')) {
          candidates.push({ title: t.title, reason: '被标记为“困难”，建议先澄清目标与步骤' })
          continue
        }
      }
      const top = candidates.slice(0, 3)
      const suggestion = top.length > 0
        ? `好的！在开始澄清之前，我建议优先澄清以下任务：\n\n${top
            .map((c, i) => `${i + 1}. ${c.title} —— 原因：${c.reason}`)
            .join('\n')}
\n\n请选择你想要澄清的任务：`
        : '好的！请选择你想要澄清的任务：'

      setWorkflowMode('task-selection')
      streamAIMessage(suggestion)
    } else {
      // 其他功能暂未开发
      setWorkflowMode('single-task')
      streamAIMessage(`✅ 好的!我会帮你进行${selected.label}。\n\n**功能开发中...**\n\n敬请期待! 🚀`)
    }
  }, [setChatMessages, streamAIMessage])

  /**
   * 用户选择要拆解的任务
   */
  const selectTaskForDecompose = useCallback((task: Task | null) => {
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
        // 拆解路径：生成问题并进入上下文输入模式
        setSelectedTaskForDecompose(task)
        const questions = generateContextQuestions(task)
        setContextQuestions(questions)
        setWorkflowMode('task-context-input')
        const questionMessage = formatQuestionsMessage(task, questions)
        streamAIMessage(questionMessage)
      } else if (selectedAction === 'clarify') {
        // 澄清路径：暂不实现后续功能，仅提示并返回上一层
        streamAIMessage('收到！我会在后续为该任务提供澄清引导与模板。')
        setSelectedTaskForDecompose(null)
        setTaskContextInput('')
        setContextQuestions([])
        setWorkflowMode('single-task-action')
      }
    }
  }, [setChatMessages, streamAIMessage, selectedAction])

  /**
   * 提交任务上下文
   */
  const submitTaskContext = useCallback((contextInput: string) => {
    // 保存用户输入（允许为空）
    if (contextInput.trim()) {
      setTaskContextInput(contextInput)
      // 仅保留确认语，不再提示“正在为你打开任务拆解工具...”
      streamAIMessage('明白了！我会根据你提供的信息来拆解任务。')
    } else {
      setTaskContextInput('')
      // 用户未提供额外上下文，静默进入下一步
    }

    // 切换到单任务模式，dashboard 会监听并触发拆解
    setWorkflowMode('single-task')
  }, [streamAIMessage])

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
  }, [])

  return {
    workflowMode,
    aiRecommendation,
    isAnalyzing,
    selectedFeeling,
    selectedAction,
    selectedTaskForDecompose,
    taskContextInput,
    contextQuestions,
    startWorkflow,
    selectOption,
    selectFeeling,
    selectAction,
    selectTaskForDecompose,
    submitTaskContext,
    clearSelectedTask,
    goBackToSingleTaskAction,
    resetWorkflow
  }
}

