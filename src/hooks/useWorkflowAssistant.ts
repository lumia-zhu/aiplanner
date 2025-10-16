/**
 * AI工作流辅助Hook
 * 负责管理AI辅助完善计划的状态和逻辑
 */

import { useState, useCallback } from 'react'
import type { Task, UserProfile, WorkflowMode, AIRecommendation, ChatMessage, PrioritySortFeeling } from '@/types'
import { analyzeTasksForWorkflow, getTodayTasks, generateDetailedTaskSummary } from '@/lib/workflowAnalyzer'

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
  
  // 方法
  startWorkflow: () => Promise<void>
  selectOption: (optionId: 'A' | 'B' | 'C') => void
  selectFeeling: (feeling: PrioritySortFeeling) => void
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
      // 选择完善单个任务
      setWorkflowMode('single-task')
      
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
              text: '✅ 好的!我会帮你逐个完善任务。\n\n**功能开发中...**\n\n此功能将包括:\n• 📝 澄清任务细节\n• 🔨 拆解复杂任务\n• ⏱️ 估计执行时间\n\n敬请期待! 🚀'
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
    
    const feelingMap = {
      urgent: { 
        emoji: '🔥',
        label: '截止日期临近', 
        matrix: '艾森豪威尔矩阵(紧急/重要)' 
      },
      overwhelmed: { 
        emoji: '🤔',
        label: '任务太多太乱', 
        matrix: '努力/影响矩阵' 
      },
      blank: { 
        emoji: '😫',
        label: '大脑一片空白', 
        matrix: '趣味/刺激矩阵' 
      }
    }
    
    const selected = feelingMap[feeling]
    
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
          text: `✅ 明白了!\n\n功能开发中...\n\n我会为你调出${selected.matrix},帮你排列任务优先级。\n\n敬请期待! 🚀`
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
  }, [])

  return {
    workflowMode,
    aiRecommendation,
    isAnalyzing,
    selectedFeeling,
    startWorkflow,
    selectOption,
    selectFeeling,
    resetWorkflow
  }
}

