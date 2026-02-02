import React from 'react'

interface ReflectionQuickActionsProps {
  currentReflectionType: 'clarity' | 'decomposition' | 'time' | 'priority' | null
  onReflectionStart: (type: 'clarity' | 'decomposition' | 'time' | 'priority') => void
  isVisible: boolean
  isLoading?: boolean  // ⭐ 是否正在加载
  loadingType?: 'clarity' | 'decomposition' | 'time' | 'priority' | null  // ⭐ 正在加载的类型
}

export function ReflectionQuickActions({
  currentReflectionType,
  onReflectionStart,
  isVisible,
  isLoading = false,
  loadingType = null
}: ReflectionQuickActionsProps) {
  
  // console.log('🔘 ReflectionQuickActions 渲染:', { isLoading, loadingType, currentReflectionType })
  
  const buttons = [
    { 
      type: 'clarity' as const, 
      icon: '📝', 
      label: '明确/拆分任务',
      baseColor: 'border-blue-200 bg-blue-50 text-blue-700',
      activeRing: 'ring-2 ring-blue-500 ring-offset-2',
      hoverColor: 'hover:border-blue-300 hover:bg-blue-100'
    },
    { 
      type: 'decomposition' as const, 
      icon: '✂️', 
      label: '拆分步骤',
      baseColor: 'border-purple-200 bg-purple-50 text-purple-700',
      activeRing: 'ring-2 ring-purple-500 ring-offset-2',
      hoverColor: 'hover:border-purple-300 hover:bg-purple-100'
    },
    { 
      type: 'time' as const, 
      icon: '⏱️', 
      label: '估算时间',
      baseColor: 'border-green-200 bg-green-50 text-green-700',
      activeRing: 'ring-2 ring-green-500 ring-offset-2',
      hoverColor: 'hover:border-green-300 hover:bg-green-100'
    },
    { 
      type: 'priority' as const, 
      icon: '🎯', 
      label: '安排优先级',
      baseColor: 'border-orange-200 bg-orange-50 text-orange-700',
      activeRing: 'ring-2 ring-orange-500 ring-offset-2',
      hoverColor: 'hover:border-orange-300 hover:bg-orange-100'
    }
  ]

  if (!isVisible) {
    return null
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent border-t border-gray-200 px-3 pt-2 pb-1">
      {/* 标题 */}
      <div className="text-[11px] font-medium text-gray-500 mb-1.5 flex items-center gap-1">
        <span className="text-xs">⚡</span>
        <span>任务规划</span>
      </div>
      
      {/* 三个按钮一行 (隐藏拆分步骤，已集成到明确/拆分任务中) */}
      <div className="grid grid-cols-3 gap-1.5">
        {buttons.filter(btn => btn.type !== 'decomposition').map(btn => {
          const isActive = currentReflectionType === btn.type
          const isThisLoading = isLoading && loadingType === btn.type
          
          return (
            <button
              key={btn.type}
              onClick={() => onReflectionStart(btn.type)}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-1
                h-[44px] px-1 rounded-md border
                transition-all duration-200 ease-out
                ${btn.baseColor}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : btn.hoverColor}
                ${isActive ? btn.activeRing : ''}
              `}
            >
              {isThisLoading ? (
                <>
                  <span className="text-lg animate-spin">⏳</span>
                  <span className="text-xs font-medium">
                    处理中
                  </span>
                </>
              ) : (
                <>
                  <span className={`text-lg transition-transform ${
                    isActive ? 'scale-110' : ''
                  }`}>
                    {btn.icon}
                  </span>
                  <span className="text-xs font-medium">
                    {btn.label}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

