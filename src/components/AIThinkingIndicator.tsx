'use client'

import React from 'react'

/**
 * AI 思考指示器 - 显示 AI 处理的实时阶段进度
 * 
 * 用途：让用户清楚知道 AI 当前在做什么，避免长时间等待时误以为出错
 */

// 场景类型
export type ThinkingType = 
  | 'default'           // 普通对话
  | 'priority'          // 优先级分析
  | 'decomposition'     // 任务拆解
  | 'time'              // 时间估算
  | 'task-recognition'  // 任务识别
  | 'clarity'           // 任务澄清

// 阶段定义
interface PhaseConfig {
  icon: string
  text: string
}

// 不同场景的阶段配置
const PHASE_CONFIGS: Record<ThinkingType, PhaseConfig[]> = {
  default: [
    { icon: '🔍', text: '理解你的问题' },
    { icon: '🧠', text: '思考回答' },
    { icon: '✍️', text: '生成回复' },
  ],
  priority: [
    { icon: '🔍', text: '分析任务内容' },
    { icon: '📊', text: '评估紧急程度' },
    { icon: '🎯', text: '生成优先级建议' },
  ],
  decomposition: [
    { icon: '🔍', text: '理解任务目标' },
    { icon: '✂️', text: '拆分子任务' },
    { icon: '📝', text: '整理拆解结果' },
  ],
  time: [
    { icon: '🔍', text: '分析任务复杂度' },
    { icon: '⏱️', text: '计算预估时间' },
    { icon: '📋', text: '生成时间建议' },
  ],
  'task-recognition': [
    { icon: '🔍', text: '识别任务信息' },
    { icon: '📅', text: '解析时间日期' },
    { icon: '📋', text: '整理任务列表' },
  ],
  clarity: [
    { icon: '🔍', text: '分析任务描述' },
    { icon: '💭', text: '识别模糊点' },
    { icon: '❓', text: '生成澄清问题' },
  ],
}

// 场景标题
const TYPE_TITLES: Record<ThinkingType, string> = {
  default: 'AI 正在思考',
  priority: '正在分析任务优先级',
  decomposition: '正在拆解任务',
  time: '正在估算时间',
  'task-recognition': '正在识别任务',
  clarity: '正在分析任务',
}

interface AIThinkingIndicatorProps {
  /** 场景类型 */
  type?: ThinkingType
  /** 当前阶段 (1-3) */
  currentPhase?: number
}

export const AIThinkingIndicator: React.FC<AIThinkingIndicatorProps> = ({
  type = 'default',
  currentPhase = 1,
}) => {
  const phases = PHASE_CONFIGS[type] || PHASE_CONFIGS.default
  const title = TYPE_TITLES[type] || TYPE_TITLES.default
  
  // 确保阶段在有效范围内
  const safePhase = Math.max(1, Math.min(currentPhase, phases.length))
  
  return (
    <div className="flex items-start gap-3">
      <img 
        src="/ai-avatar.svg" 
        alt="AI" 
        className="w-8 h-8 rounded-full flex-shrink-0" 
      />
      <div className="bg-white rounded-lg px-4 py-3 shadow-sm max-w-[85%] min-w-[240px]">
        {/* 标题 */}
        <div className="text-sm font-medium text-gray-700 mb-3">
          {title}
        </div>
        
        {/* 阶段列表 */}
        <div className="space-y-2">
          {phases.map((phase, index) => {
            const phaseNumber = index + 1
            const isCompleted = phaseNumber < safePhase
            const isCurrent = phaseNumber === safePhase
            const isPending = phaseNumber > safePhase
            
            return (
              <div 
                key={index}
                className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                  isCompleted ? 'text-green-600' :
                  isCurrent ? 'text-blue-600' :
                  'text-gray-400'
                }`}
              >
                {/* 状态图标 */}
                <span className="w-5 h-5 flex items-center justify-center">
                  {isCompleted && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isCurrent && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {isPending && (
                    <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
                  )}
                </span>
                
                {/* 阶段图标和文字 */}
                <span className="flex items-center gap-1.5">
                  <span>{phase.icon}</span>
                  <span className={isCurrent ? 'font-medium' : ''}>
                    {phase.text}
                    {isCurrent && '...'}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AIThinkingIndicator

