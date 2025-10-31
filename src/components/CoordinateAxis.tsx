/**
 * 任务矩阵坐标轴组件
 * 显示十字坐标轴和四个方向的标签（重要/不重要，紧急/不紧急）
 */

'use client'

export default function CoordinateAxis() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {/* 纵轴（垂直线） */}
      <div 
        className="absolute top-0 bottom-0 w-[1px] bg-gray-300"
        style={{
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* 横轴（水平线） */}
      <div 
        className="absolute left-0 right-0 h-[1px] bg-gray-300"
        style={{
          top: '50%',
          transform: 'translateY(-50%)'
        }}
      />
      
      {/* 上方标签：重要 ↑ */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ top: '-8px' }}
      >
        <div className="text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <span>重要</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
      </div>
      
      {/* 下方标签：不重要 ↓ */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ bottom: '-8px' }}
      >
        <div className="text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>不重要</span>
        </div>
      </div>
      
      {/* 左侧标签：← 不紧急 */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 flex items-center"
        style={{ left: '-8px' }}
      >
        <div className="text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>不紧急</span>
        </div>
      </div>
      
      {/* 右侧标签：紧急 → */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 flex items-center"
        style={{ right: '-8px' }}
      >
        <div className="text-xs text-gray-600 font-semibold bg-white px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <span>紧急</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </div>
  )
}

