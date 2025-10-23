/**
 * Inline interactive buttons component
 * Renders clickable buttons in AI messages, supporting various interaction types
 */

'use client'

import React from 'react'
import type { InteractiveMessage } from '@/lib/doubaoService'
import type { Task, PrioritySortFeeling, SingleTaskAction } from '@/types'

interface InteractiveButtonsProps {
  interactive: InteractiveMessage
  // Various callback functions
  onWorkflowOptionSelect?: (optionId: 'A' | 'B' | 'C') => void
  onActionSelect?: (action: SingleTaskAction) => void
  onFeelingSelect?: (feeling: PrioritySortFeeling) => void
  onTaskSelect?: (task: Task | null) => void
  onClarificationConfirm?: () => void
  onClarificationReject?: () => void
  onEstimationConfirm?: (withBuffer: boolean) => void
  // Current task list (for task selection)
  currentTasks?: Task[]
}

// Workflow options configuration
const WORKFLOW_OPTIONS = [
  {
    id: 'A' as const,
    label: 'Refine Single Task',
    description: 'Clarify, decompose, and estimate time one by one',
    icon: '🔍',
    colorClass: 'from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400',
    textClass: 'text-blue-900'
  },
  {
    id: 'B' as const,
    label: 'Sort All Tasks',
    description: 'Organize priorities using matrix',
    icon: '📊',
    colorClass: 'from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400',
    textClass: 'text-purple-900'
  },
  {
    id: 'C' as const,
    label: 'End AI Assistance',
    description: 'Got it',
    icon: '✅',
    colorClass: 'from-green-50 to-emerald-50 border-green-200 hover:border-green-400',
    textClass: 'text-green-900'
  }
]

// Single task action options configuration
const ACTION_OPTIONS = [
  {
    id: 'clarify' as const,
    emoji: '📝',
    label: 'Clarify Task',
    description: 'Define requirements and goals',
    colorClass: 'from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400',
    textClass: 'text-blue-900'
  },
  {
    id: 'decompose' as const,
    emoji: '🔨',
    label: 'Decompose Task',
    description: 'Break down into smaller steps',
    colorClass: 'from-green-50 to-emerald-50 border-green-200 hover:border-green-400',
    textClass: 'text-green-900'
  },
  {
    id: 'estimate' as const,
    emoji: '⏱️',
    label: 'Estimate Time',
    description: 'Estimate duration needed',
    colorClass: 'from-orange-50 to-amber-50 border-orange-200 hover:border-orange-400',
    textClass: 'text-orange-900'
  },
  {
    id: 'back' as const,
    emoji: '↩️',
    label: 'Go Back',
    description: 'Return to selection',
    colorClass: 'from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400',
    textClass: 'text-gray-900'
  }
]

// Feeling options configuration
const FEELING_OPTIONS = [
  {
    id: 'urgent' as const,
    emoji: '🔥',
    label: 'Deadline Approaching',
    description: 'Separate "do now" from "do later"',
    colorClass: 'from-red-50 to-orange-50 border-red-200 hover:border-red-400',
    textClass: 'text-red-900'
  },
  {
    id: 'overwhelmed' as const,
    emoji: '🤔',
    label: 'Too Many Tasks',
    description: 'Find "high value" and "quick wins"',
    colorClass: 'from-yellow-50 to-amber-50 border-yellow-200 hover:border-yellow-400',
    textClass: 'text-yellow-900'
  },
  {
    id: 'blank' as const,
    emoji: '😫',
    label: 'Feeling Blank',
    description: 'Find "easiest" or "most appealing" tasks',
    colorClass: 'from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400',
    textClass: 'text-purple-900'
  },
  {
    id: 'back' as const,
    emoji: '↩️',
    label: 'Go Back',
    description: 'Return to selection',
    colorClass: 'from-gray-50 to-slate-50 border-gray-300 hover:border-gray-400',
    textClass: 'text-gray-900'
  }
]

export default function InteractiveButtons({
  interactive,
  onWorkflowOptionSelect,
  onActionSelect,
  onFeelingSelect,
  onTaskSelect,
  onClarificationConfirm,
  onClarificationReject,
  onEstimationConfirm,
  currentTasks = []
}: InteractiveButtonsProps) {
  const isActive = interactive.isActive !== false // Active by default

  // Render workflow options buttons
  if (interactive.type === 'workflow-options') {
    return (
      <div className="space-y-2 mt-3">
        {WORKFLOW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => isActive && onWorkflowOptionSelect?.(option.id)}
            disabled={!isActive}
            className={`
              w-full text-left p-2.5 rounded-lg border-2 transition-all
              ${!isActive 
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                : `bg-gradient-to-r ${option.colorClass} hover:shadow-md`
              }
            `}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 text-lg mt-0.5">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xs font-semibold mb-0.5 ${!isActive ? 'text-gray-500' : option.textClass}`}>
                  {option.label}
                </h3>
                <p className="text-xs text-gray-600 leading-snug">
                  {option.description}
                </p>
              </div>
              {isActive && (
                <div className="flex-shrink-0 text-gray-400 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Render single task action buttons
  if (interactive.type === 'single-task-action') {
    return (
      <div className="space-y-2 mt-3">
        {ACTION_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => isActive && onActionSelect?.(option.id)}
            disabled={!isActive}
            className={`
              w-full text-left p-2.5 rounded-lg border-2 transition-all
              ${!isActive 
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                : `bg-gradient-to-r ${option.colorClass} hover:shadow-md`
              }
            `}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 text-lg mt-0.5">
                {option.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xs font-semibold mb-0.5 ${!isActive ? 'text-gray-500' : option.textClass}`}>
                  {option.label}
                </h3>
                <p className="text-xs text-gray-600 leading-snug">
                  {option.description}
                </p>
              </div>
              {isActive && (
                <div className="flex-shrink-0 text-gray-400 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Render feeling options buttons
  if (interactive.type === 'feeling-options') {
    return (
      <div className="space-y-2 mt-3">
        {FEELING_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => isActive && onFeelingSelect?.(option.id)}
            disabled={!isActive}
            className={`
              w-full text-left p-2.5 rounded-lg border-2 transition-all
              ${!isActive 
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                : `bg-gradient-to-r ${option.colorClass} hover:shadow-md`
              }
            `}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 text-lg mt-0.5">
                {option.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xs font-semibold mb-0.5 ${!isActive ? 'text-gray-500' : option.textClass}`}>
                  {option.label}
                </h3>
                <p className="text-xs text-gray-600 leading-snug">
                  {option.description}
                </p>
              </div>
              {isActive && (
                <div className="flex-shrink-0 text-gray-400 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Render task selection list
  if (interactive.type === 'task-selection') {
    const allTasks = currentTasks
    const hasAnyTask = allTasks.length > 0

    if (!hasAnyTask) {
      return (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 text-center">No tasks available</p>
        </div>
      )
    }

    return (
      <div className="space-y-2 mt-3">
        {allTasks.map((task) => {
          const isCompleted = task.completed
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => isActive && onTaskSelect?.(task)}
              disabled={!isActive}
              className={`
                w-full text-left p-2.5 rounded-lg border-2 transition-all
                ${!isActive || isCompleted
                  ? 'bg-gray-50 border-gray-300 opacity-60 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
                }
              `}
            >
              <div className="flex items-start gap-2">
                {isCompleted && (
                  <div className="flex-shrink-0 text-green-600 mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-xs font-semibold line-clamp-2 ${
                      isCompleted 
                        ? 'line-through text-gray-500' 
                        : !isActive
                          ? 'text-gray-500'
                          : 'text-blue-900'
                    }`}>
                      {task.title}
                    </h3>
                    {isCompleted && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full whitespace-nowrap">
                        Completed
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                      {task.description}
                    </p>
                  )}
                  {task.deadline_datetime && !isCompleted && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{new Date(task.deadline_datetime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
                {isActive && !isCompleted && (
                  <div className="flex-shrink-0 text-gray-400 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Render clarification confirmation buttons
  if (interactive.type === 'clarification-confirm') {
    return (
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => isActive && onClarificationConfirm?.()}
          disabled={!isActive}
          className={`
            flex-1 px-4 py-2.5 text-xs font-medium rounded-lg transition-all
            ${!isActive
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm hover:shadow-md'
            }
          `}
        >
          ✅ Confirm, Continue
        </button>
        <button
          type="button"
          onClick={() => isActive && onClarificationReject?.()}
          disabled={!isActive}
          className={`
            flex-1 px-4 py-2.5 text-xs font-medium rounded-lg transition-all
            ${!isActive
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : 'bg-white text-purple-600 border-2 border-purple-300 hover:bg-purple-50 hover:border-purple-400'
            }
          `}
        >
          🔄 Needs Correction
        </button>
      </div>
    )
  }

  // Render time estimation confirmation buttons
  if (interactive.type === 'estimation-confirm') {
    const estimateMinutes = interactive.data?.estimateMinutes || 60
    const bufferMinutes = Math.round(estimateMinutes * 0.3)
    const totalMinutes = estimateMinutes + bufferMinutes

    return (
      <div className="space-y-2 mt-3">
        <button
          type="button"
          onClick={() => isActive && onEstimationConfirm?.(true)}
          disabled={!isActive}
          className={`
            w-full text-left p-2.5 rounded-lg border-2 transition-all
            ${!isActive
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-400 hover:shadow-md'
            }
          `}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 text-lg mt-0.5">✅</div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-xs font-semibold mb-0.5 ${!isActive ? 'text-gray-500' : 'text-green-900'}`}>
                Add Buffer: {totalMinutes} minutes
              </h3>
              <p className="text-xs text-gray-600 leading-snug">
                Include 30% Buffer ({bufferMinutes} minutes), more reliable
              </p>
            </div>
            {isActive && (
              <div className="flex-shrink-0 text-gray-400 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={() => isActive && onEstimationConfirm?.(false)}
          disabled={!isActive}
          className={`
            w-full text-left p-2.5 rounded-lg border-2 transition-all
            ${!isActive
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
            }
          `}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 text-lg mt-0.5">⚡</div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-xs font-semibold mb-0.5 ${!isActive ? 'text-gray-500' : 'text-blue-900'}`}>
                Stick with estimate: {estimateMinutes} minutes
              </h3>
              <p className="text-xs text-gray-600 leading-snug">
                I'm confident with this
              </p>
            </div>
            {isActive && (
              <div className="flex-shrink-0 text-gray-400 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        </button>
      </div>
    )
  }

  return null
}

