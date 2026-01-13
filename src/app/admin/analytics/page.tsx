'use client'

/**
 * 管理员后台 - 统计分析页面
 * 查看用户行为统计数据，支持聚合和导出
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage } from '@/lib/auth'
import { isUserAdmin } from '@/lib/userProfile'
import {
  getAllUsers,
  getAnalyticsData,
  calculateSummary,
  runAggregation,
  exportAnalyticsWithUsernames,
  downloadCSV,
  type UserWithStats,
  type AnalyticsSummary,
  type AggregationResult
} from '@/lib/adminAnalyticsService'
import type { DailyUserAnalytics } from '@/types/analytics'

export default function AdminAnalyticsPage() {
  const router = useRouter()
  
  // ============================================
  // 权限状态
  // ============================================
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [countdown, setCountdown] = useState(3)
  
  // ============================================
  // 数据状态
  // ============================================
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [analyticsData, setAnalyticsData] = useState<DailyUserAnalytics[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  
  // ============================================
  // 筛选状态
  // ============================================
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // ============================================
  // 分页状态
  // ============================================
  const [page, setPage] = useState(1)
  const pageSize = 20
  
  // ============================================
  // 聚合状态
  // ============================================
  const [isAggregating, setIsAggregating] = useState(false)
  const [aggregationProgress, setAggregationProgress] = useState({ current: 0, total: 0, message: '' })
  const [showAggregationModal, setShowAggregationModal] = useState(false)

  // ============================================
  // 权限检查
  // ============================================
  useEffect(() => {
    const checkAdminAccess = async () => {
      const user = getUserFromStorage()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const adminStatus = await isUserAdmin(user.id)
      setIsAdmin(adminStatus)
      setChecking(false)
      
      if (adminStatus) {
        // 加载初始数据
        loadUsers()
        initializeDateRange()
      }
    }

    checkAdminAccess()
  }, [router])

  // 非管理员倒计时跳转
  useEffect(() => {
    if (!checking && !isAdmin) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            router.push('/notes-dashboard')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [checking, isAdmin, router])

  // ============================================
  // 数据加载
  // ============================================
  
  // 初始化日期范围（默认最近7天）
  const initializeDateRange = () => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)
    
    setEndDate(today.toISOString().split('T')[0])
    setStartDate(weekAgo.toISOString().split('T')[0])
  }

  // 加载用户列表
  const loadUsers = async () => {
    const userList = await getAllUsers()
    setUsers(userList)
  }

  // 加载统计数据
  const loadAnalyticsData = useCallback(async () => {
    if (!startDate || !endDate) return
    
    setLoading(true)
    try {
      const data = await getAnalyticsData(selectedUserId, startDate, endDate)
      setAnalyticsData(data)
      setSummary(calculateSummary(data))
      setPage(1)  // 重置分页
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, startDate, endDate])

  // 当筛选条件变化时自动加载
  useEffect(() => {
    if (isAdmin && startDate && endDate) {
      loadAnalyticsData()
    }
  }, [isAdmin, startDate, endDate, selectedUserId, loadAnalyticsData])

  // ============================================
  // 聚合功能
  // ============================================
  const handleAggregation = async () => {
    if (!startDate || !endDate) {
      alert('请先选择日期范围')
      return
    }
    
    setShowAggregationModal(true)
    setIsAggregating(true)
    setAggregationProgress({ current: 0, total: 0, message: '准备中...' })
    
    try {
      const result = await runAggregation(
        selectedUserId,
        startDate,
        endDate,
        (current, total, message) => {
          setAggregationProgress({ current, total, message })
        }
      )
      
      if (result.success) {
        alert(`✅ ${result.message}`)
        // 刷新数据
        await loadAnalyticsData()
      } else {
        alert(`⚠️ ${result.message}`)
      }
    } catch (error) {
      console.error('聚合失败:', error)
      alert('聚合失败，请查看控制台')
    } finally {
      setIsAggregating(false)
      setShowAggregationModal(false)
    }
  }

  // ============================================
  // 导出功能
  // ============================================
  const handleExport = () => {
    if (analyticsData.length === 0) {
      alert('没有数据可以导出')
      return
    }
    
    const csv = exportAnalyticsWithUsernames(analyticsData, users)
    const filename = `analytics_${startDate}_${endDate}.csv`
    downloadCSV(csv, filename)
  }

  // ============================================
  // 辅助函数
  // ============================================
  const getUsernameById = (userId: string): string => {
    const user = users.find(u => u.user_id === userId)
    return user?.username || '未知用户'
  }

  // 分页数据
  const totalPages = Math.ceil(analyticsData.length / pageSize)
  const paginatedData = analyticsData.slice((page - 1) * pageSize, page * pageSize)

  // ============================================
  // 渲染 - 加载中
  // ============================================
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在检查权限...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // 渲染 - 非管理员
  // ============================================
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">无访问权限</h1>
          <p className="text-gray-600 mb-4">你不是管理员，无法访问此页面</p>
          <p className="text-gray-500 text-sm">{countdown} 秒后自动返回主页面...</p>
          <button
            onClick={() => router.push('/notes-dashboard')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            立即返回
          </button>
        </div>
      </div>
    )
  }

  // ============================================
  // 渲染 - 主页面
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">📊 后台统计</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/admin/chat')}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              聊天记录
            </button>
            <button
              onClick={() => router.push('/admin/notes')}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              笔记版本
            </button>
            <button
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
            >
              后台统计
            </button>
          </div>
        </div>
        <p className="text-gray-600">查看用户行为统计数据，支持数据聚合和导出</p>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* 用户选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[200px] text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部用户</option>
              {users.map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
          
          {/* 日期范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* 操作按钮 - 统一蓝色系配色 */}
          <div className="flex gap-2">
            <button
              onClick={loadAnalyticsData}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {loading ? '加载中...' : '查询'}
            </button>
            <button
              onClick={handleAggregation}
              disabled={isAggregating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isAggregating ? '聚合中...' : '聚合'}
            </button>
            <button
              onClick={handleExport}
              disabled={analyticsData.length === 0}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出
            </button>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">💬 总消息数</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalMessages}</div>
            <div className="text-xs text-gray-400 mt-1">
              反思: {summary.reflectionMessages} | 普通: {summary.normalMessages}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">📝 总任务数</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalTasks}</div>
            <div className="text-xs text-gray-400 mt-1">
              父任务: {summary.parentTasks} | 子任务: {summary.childTasks}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">❓ 总问题数</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalQuestions}</div>
            <div className="text-xs text-gray-400 mt-1">
              已回答: {summary.answeredQuestions} | 忽略: {summary.ignoredQuestions}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">✅ 回答率</div>
            <div className="text-2xl font-bold text-gray-900">{summary.answerRate}%</div>
            <div className="text-xs text-gray-400 mt-1">
              澄清: {summary.clarityCompleted} | 拆解: {summary.decompositionCompleted}
            </div>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">详细数据</h2>
          <p className="text-sm text-gray-500">共 {analyticsData.length} 条记录</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            加载中...
          </div>
        ) : analyticsData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无数据，请先点击「聚合」按钮生成统计数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">日期</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">用户</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">消息数</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">任务数</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">问题数</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">已回答</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">回答率</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">交互类型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((item, index) => {
                  const answerRate = item.total_questions > 0 
                    ? Math.round((item.answered_questions / item.total_questions) * 100)
                    : 0
                  return (
                    <tr key={`${item.user_id}-${item.date}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{item.date}</td>
                      <td className="px-4 py-3 text-gray-900">{getUsernameById(item.user_id)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.total_messages}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.total_tasks}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.total_questions}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.answered_questions}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          answerRate >= 80 ? 'bg-green-100 text-green-700' :
                          answerRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {answerRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {item.clarity_completed > 0 && <span className="mr-1">📝{item.clarity_completed}</span>}
                        {item.decomposition_completed > 0 && <span className="mr-1">✂️{item.decomposition_completed}</span>}
                        {item.time_completed > 0 && <span className="mr-1">⏱️{item.time_completed}</span>}
                        {item.priority_completed > 0 && <span>🎯{item.priority_completed}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 聚合进度弹窗 */}
      {showAggregationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔄 数据聚合中</h2>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{aggregationProgress.message}</span>
                <span>{aggregationProgress.current} / {aggregationProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: aggregationProgress.total > 0 
                      ? `${(aggregationProgress.current / aggregationProgress.total) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-500">请勿关闭此页面，聚合完成后将自动关闭...</p>
          </div>
        </div>
      )}
    </div>
  )
}
