'use client'

import { useState } from 'react'
import DateScopeSelector from '@/components/DateScopeSelector'
import type { DateScope } from '@/types'

/**
 * 日期范围选择器测试页面
 * 用于验证 DateScopeSelector 组件的功能
 */
export default function TestDateScopePage() {
  // 获取日期的零点时间
  function getStartOfDay(date: Date): Date {
    const newDate = new Date(date)
    newDate.setHours(0, 0, 0, 0)
    return newDate
  }

  // 获取日期的结束时间
  function getEndOfDay(date: Date): Date {
    const newDate = new Date(date)
    newDate.setHours(23, 59, 59, 999)
    return newDate
  }

  // 初始化为今天
  const [dateScope, setDateScope] = useState<DateScope>({
    start: getStartOfDay(new Date()),
    end: getEndOfDay(new Date()),
    includeOverdue: true,
    preset: 'today'
  })

  // 格式化日期显示
  function formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          日期范围选择器测试
        </h1>

        {/* 日期范围选择器 */}
        <DateScopeSelector 
          scope={dateScope} 
          onScopeChange={setDateScope} 
        />

        {/* 当前状态显示 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            当前范围状态
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-600 w-32">预设类型：</span>
              <span className="text-sm text-gray-900 font-mono">
                {dateScope.preset}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-600 w-32">起始日期：</span>
              <span className="text-sm text-gray-900 font-mono">
                {formatDate(dateScope.start)}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-600 w-32">结束日期：</span>
              <span className="text-sm text-gray-900 font-mono">
                {formatDate(dateScope.end)}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-600 w-32">包含逾期：</span>
              <span className="text-sm text-gray-900 font-mono">
                {dateScope.includeOverdue ? '✅ 是' : '❌ 否'}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-600 w-32">天数范围：</span>
              <span className="text-sm text-gray-900 font-mono">
                {Math.ceil((dateScope.end.getTime() - dateScope.start.getTime()) / (1000 * 60 * 60 * 24))} 天
              </span>
            </div>
          </div>
        </div>

        {/* 测试说明 */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            测试项目清单
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ 点击"今天"按钮 → 应显示今天的日期范围</li>
            <li>✅ 点击"3天"按钮 → 应显示今天到后天的日期范围</li>
            <li>✅ 点击"7天"按钮 → 应显示未来7天的日期范围</li>
            <li>✅ 点击"本周"按钮 → 应显示本周一至周日的日期范围</li>
            <li>✅ 点击"本月"按钮 → 应显示本月1号至月末的日期范围</li>
            <li>✅ 手动修改起止日期 → preset应变为"custom"</li>
            <li>✅ 选择结束日期早于开始日期 → 应显示红色边框和错误提示</li>
            <li>✅ 修正日期后 → 错误提示应消失</li>
            <li>✅ 勾选/取消"包含逾期任务" → includeOverdue应相应变化</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

