/**
 * AI工作流辅助Hook
 * 负责管理AI辅助完善计划的状态和逻辑
 */

import { useState, useCallback } from 'react'
import type { Task, UserProfile, WorkflowMode, AIRecommendation, PrioritySortFeeling, SingleTaskAction } from '@/types'
import type { ChatMessage } from '@/lib/doubaoService'
import { analyzeTasksForWorkflow, getTodayTasks, generateDetailedTaskSummary } from '@/lib/workflowAnalyzer'
import { getMatrixTypeByFeeling, getMatrixConfig } from '@/types'

interface UseWorkflowAssistantProps {
  tasks: Task[]
  userProfile: UserProfile | null
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
}

interface UseWorkflowAssistantReturn {
  // 状态
  workflowMode: WorkflowMode
  aiRecommendation: AIRecommendation | null
  isAnalyzing: boolean
  selectedFeeling: PrioritySortFeeling | null
  selectedAction: SingleTaskAction | null
  
  // 方法
  startWorkflow: () => Promise<void>
  selectOption: (optionId: 'A' | 'B' | 'C') => void
  selectFeeling: (feeling: PrioritySortFeeling) => void
  selectAction: (action: SingleTaskAction) => void
  resetWorkflow: () => void
}

/**
 * AI工作流辅助Hook
 */
export function useWorkflowAssistant({
  tasks,
  userProfile,
  setChatMessages
}: UseWorkflowAssistantProps): UseWorkflowAssistantReturn {
  
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('initial')
  const [aiRecommendation, setAIRecommendation] = useState<AIRecommendation | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedFeeling, setSelectedFeeling] = useState<PrioritySortFeeling | null>(null)
  const [selectedAction, setSelectedAction] = useState<SingleTaskAction | null>(null)

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
      
      // 添加到聊天消息
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: aiMessage
            }
          ]
        }
      ])
      
    } catch (error) {
      console.error('工作流分析失败:', error)
      
      // 添加错误消息
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '❌ 抱歉,分析任务时出现了问题。请稍后再试。'
            }
          ]
        }
      ])
    } finally {
      setIsAnalyzing(false)
    }
  }, [tasks, userProfile, setChatMessages])

  /**
   * 用户选择选项
   */
  const selectOption = useCallback((optionId: 'A' | 'B' | 'C') => {
    if (optionId === 'A') {
      // 选择完善单个任务 - 进入操作选择阶段
      setWorkflowMode('single-task-action')
      
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '🔍 选项A: 完善单个任务' }]
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '好的!我可以帮你做以下操作:\n\n请选择你想对任务进行什么操作:'
            }
          ]
        }
      ])
      
    } else if (optionId === 'B') {
      // 选择优先级排序 - 进入询问感觉阶段
      setWorkflowMode('priority-feeling')
      
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '📊 选项B: 对所有任务做优先级排序' }]
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '好的!在开始排序之前,我想了解一下:\n\n你现在主要的感觉是什么? 这将帮助我推荐最适合你的排序方法:'
            }
          ]
        }
      ])
      
    } else if (optionId === 'C') {
      // 结束AI辅助
      setWorkflowMode('ended')
      
      setChatMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: [{ type: 'text', text: '✅ 选项C: 结束AI辅助' }]
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '👋 好的!AI辅助已结束。\n\n如果需要帮助,随时点击"下一步,AI辅助完善计划"按钮即可。祝你高效完成任务! 💪'
            }
          ]
        }
      ])
    }
  }, [setChatMessages])

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
        },
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: '好的,已返回上一级。请重新选择你想做什么:'
          }]
        }
      ])
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
      },
      {
        role: 'assistant',
        content: [{
          type: 'text',
          text: guideMessage
        }]
      }
    ])
  }, [setChatMessages])

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
        },
        {
          role: 'assistant',
          content: [{
            type: 'text',
            text: '好的,已返回上一级。请重新选择你想做什么:'
          }]
        }
      ])
      return
    }
    
    // 选择了操作选项 clarify/decompose/estimate
    setSelectedAction(action)
    setWorkflowMode('single-task')
    
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
      },
      {
        role: 'assistant',
        content: [{
          type: 'text',
          text: `✅ 好的!我会帮你进行${selected.label}。\n\n**功能开发中...**\n\n敬请期待! 🚀`
        }]
      }
    ])
  }, [setChatMessages])

  /**
   * 重置工作流状态
   */
  const resetWorkflow = useCallback(() => {
    setWorkflowMode('initial')
    setAIRecommendation(null)
    setIsAnalyzing(false)
    setSelectedFeeling(null)
    setSelectedAction(null)
  }, [])

  return {
    workflowMode,
    aiRecommendation,
    isAnalyzing,
    selectedFeeling,
    selectedAction,
    startWorkflow,
    selectOption,
    selectFeeling,
    selectAction,
    resetWorkflow
  }
}

