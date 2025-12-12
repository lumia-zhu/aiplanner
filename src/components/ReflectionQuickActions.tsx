import React from 'react'

interface ReflectionQuickActionsProps {
  currentReflectionType: 'clarity' | 'decomposition' | 'time' | 'priority' | null
  onReflectionStart: (type: 'clarity' | 'decomposition' | 'time' | 'priority') => void
  isVisible: boolean
}

export function ReflectionQuickActions({
  currentReflectionType,
  onReflectionStart,
  isVisible
}: ReflectionQuickActionsProps) {
  
  const buttons = [
    { 
      type: 'clarity' as const, 
      icon: '📝', 
      label: '澄清任务',
      baseColor: 'border-blue-200 bg-blue-50 text-blue-700',
      activeRing: 'ring-2 ring-blue-500 ring-offset-2',
      hoverColor: 'hover:border-blue-300 hover:bg-blue-100'
    },
    { 
      type: 'decomposition' as const, 
      icon: '✂️', 
      label: '任务拆解',
      baseColor: 'border-purple-200 bg-purple-50 text-purple-700',
      activeRing: 'ring-2 ring-purple-500 ring-offset-2',
      hoverColor: 'hover:border-purple-300 hover:bg-purple-100'
    },
    { 
      type: 'time' as const, 
      icon: '⏱️', 
      label: '时间规划',
      baseColor: 'border-green-200 bg-green-50 text-green-700',
      activeRing: 'ring-2 ring-green-500 ring-offset-2',
      hoverColor: 'hover:border-green-300 hover:bg-green-100'
    },
    { 
      type: 'priority' as const, 
      icon: '🎯', 
      label: '优先级排列',
      baseColor: 'border-orange-200 bg-orange-50 text-orange-700',
      activeRing: 'ring-2 ring-orange-500 ring-offset-2',
      hoverColor: 'hover:border-orange-300 hover:bg-orange-100'
    }
  ]

  if (!isVisible) {
    return null
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent border-t border-gray-200 px-4 py-3">
      {/* 标题 */}
      <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <span>⚡</span>
        <span>任务反思</span>
      </div>
      
      {/* 四个按钮 (2行2列) */}
      <div className="grid grid-cols-2 gap-2">
        {buttons.map(btn => {
          const isActive = currentReflectionType === btn.type
          
          return (
            <button
              key={btn.type}
              onClick={() => onReflectionStart(btn.type)}
              className={`
                flex items-center justify-center gap-1.5
                h-[52px] px-3 rounded-lg border
                transition-all duration-200 ease-out
                ${btn.baseColor}
                ${btn.hoverColor}
                ${isActive ? btn.activeRing : ''}
              `}
            >
              <span className={`text-xl transition-transform ${
                isActive ? 'scale-110' : ''
              }`}>
                {btn.icon}
              </span>
              <span className="text-sm font-medium whitespace-nowrap">
                {btn.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

