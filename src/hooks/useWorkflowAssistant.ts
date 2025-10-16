/**
 * AI工作流辅助Hook
 * 负责管理AI辅助完善计划的状态和逻辑
 */

import { useState, useCallback } from 'react'
import type { Task, UserProfile, WorkflowMode, AIRecommendation, ChatMessage } from '@/types'
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
  
  // 方法
  startWorkflow: () => Promise<void>
  selectOption: (optionId: 'A' | 'B' | 'C') => void
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
      // 选择优先级排序
      setWorkflowMode('priority-sort')
      
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
              text: '✅ 好的!我会帮你排列任务优先级。\n\n**功能开发中...**\n\n此功能将包括:\n• 🔥 艾森豪威尔矩阵(紧急/重要)\n• 💪 努力/影响矩阵\n• 😊 趣味/刺激矩阵\n\n敬请期待! 🚀'
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
   * 重置工作流状态
   */
  const resetWorkflow = useCallback(() => {
    setWorkflowMode('initial')
    setAIRecommendation(null)
    setIsAnalyzing(false)
  }, [])

  return {
    workflowMode,
    aiRecommendation,
    isAnalyzing,
    startWorkflow,
    selectOption,
    resetWorkflow
  }
}

