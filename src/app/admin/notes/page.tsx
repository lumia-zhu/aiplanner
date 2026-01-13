'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage } from '@/lib/auth'
import { isUserAdmin } from '@/lib/userProfile'
import { createClient } from '@/lib/supabase-client'
import NoteEditor from '@/components/NoteEditor'

// 笔记版本类型
interface NoteVersion {
  id: string
  note_id: string
  user_id: string
  note_date: string
  content: any
  plain_text: string | null
  version_source: string
  content_length: number | null
  task_count: number
  created_at: string
}

export default function AdminNotesPage() {
  const router = useRouter()
  
  // 权限状态
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [countdown, setCountdown] = useState(3)
  
  // 数据状态
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  
  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  // 筛选状态
  const [filterUserIds, setFilterUserIds] = useState<string[]>([])
  const [filterNoteDate, setFilterNoteDate] = useState('')
  const [filterVersionSource, setFilterVersionSource] = useState<'all' | 'auto_save' | 'manual_save' | 'initial'>('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  
  // 用户列表
  const [users, setUsers] = useState<Array<{ user_id: string; username: string }>>([])
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  
  // 详情弹窗
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)
  
  // 导出状态
  const [exporting, setExporting] = useState(false)
  
  // 勾选状态（用于时间线）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // 时间线弹窗
  const [showTimeline, setShowTimeline] = useState(false)
  const [timelineVersions, setTimelineVersions] = useState<NoteVersion[]>([])
  const [timelineIndex, setTimelineIndex] = useState(0)
  
  // 权限检查
  useEffect(() => {
    const checkAdmin = async () => {
      const user = getUserFromStorage()
      if (!user) {
        router.push('/auth/login')
        return
      }
      
      const admin = await isUserAdmin(user.id)
      setIsAdmin(admin)
      setChecking(false)
    }
    
    checkAdmin()
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
  
  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    
    try {
      const supabase = createClient()
      
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id')
      
      if (!profiles) return
      
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username')
        .in('id', profiles.map(p => p.user_id))
      
      if (usersData) {
        setUsers(usersData.map(u => ({ user_id: u.id, username: u.username })))
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }, [isAdmin])
  
  // 加载笔记版本
  const loadVersions = useCallback(async () => {
    if (!isAdmin) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      
      // 先获取总数
      let countQuery = supabase.from('note_versions').select('*', { count: 'exact', head: true })
      
      if (filterUserIds.length > 0) {
        countQuery = countQuery.in('user_id', filterUserIds)
      }
      if (filterNoteDate) {
        countQuery = countQuery.eq('note_date', filterNoteDate)
      }
      if (filterVersionSource !== 'all') {
        countQuery = countQuery.eq('version_source', filterVersionSource)
      }
      if (filterStartDate) {
        countQuery = countQuery.gte('created_at', filterStartDate)
      }
      if (filterEndDate) {
        const endDateTime = new Date(filterEndDate)
        endDateTime.setHours(23, 59, 59, 999)
        countQuery = countQuery.lte('created_at', endDateTime.toISOString())
      }
      
      const { count } = await countQuery
      setTotalCount(count || 0)
      
      // 获取数据
      let query = supabase.from('note_versions').select('*')
      
      if (filterUserIds.length > 0) {
        query = query.in('user_id', filterUserIds)
      }
      if (filterNoteDate) {
        query = query.eq('note_date', filterNoteDate)
      }
      if (filterVersionSource !== 'all') {
        query = query.eq('version_source', filterVersionSource)
      }
      if (filterStartDate) {
        query = query.gte('created_at', filterStartDate)
      }
      if (filterEndDate) {
        const endDateTime = new Date(filterEndDate)
        endDateTime.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDateTime.toISOString())
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)
      
      if (error) {
        console.error('查询笔记版本失败:', error)
        return
      }
      
      setVersions(data || [])
    } catch (error) {
      console.error('加载笔记版本失败:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, page, pageSize, filterUserIds, filterNoteDate, filterVersionSource, filterStartDate, filterEndDate])
  
  // 权限通过后加载数据
  useEffect(() => {
    if (isAdmin) {
      loadVersions()
      loadUsers()
    }
  }, [isAdmin, loadVersions, loadUsers])
  
  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.user-search-container')) {
        setShowUserDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // 导出 CSV
  const exportToCSV = async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      
      let query = supabase.from('note_versions').select('*')
      
      if (filterUserIds.length > 0) {
        query = query.in('user_id', filterUserIds)
      }
      if (filterNoteDate) {
        query = query.eq('note_date', filterNoteDate)
      }
      if (filterVersionSource !== 'all') {
        query = query.eq('version_source', filterVersionSource)
      }
      if (filterStartDate) {
        query = query.gte('created_at', filterStartDate)
      }
      if (filterEndDate) {
        const endDateTime = new Date(filterEndDate)
        endDateTime.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDateTime.toISOString())
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(5000)
      
      if (error) {
        console.error('导出失败:', error)
        alert('导出失败：' + error.message)
        return
      }
      
      if (!data || data.length === 0) {
        alert('没有数据可导出')
        return
      }
      
      const headers = ['ID', '笔记ID', '用户ID', '笔记日期', '版本来源', '内容长度', '任务数量', '创建时间', '纯文本', '完整内容(JSON)']
      const rows = data.map(v => [
        v.id,
        v.note_id,
        v.user_id,
        v.note_date,
        v.version_source,
        v.content_length || 0,
        v.task_count,
        v.created_at,
        (v.plain_text || '').replace(/"/g, '""'),
        JSON.stringify(v.content).replace(/"/g, '""')
      ])
      
      const BOM = '\uFEFF'
      const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `note_versions_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      alert(`成功导出 ${data.length} 条记录`)
    } catch (error) {
      console.error('导出异常:', error)
      alert('导出失败')
    } finally {
      setExporting(false)
    }
  }
  
  // 勾选/取消勾选
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }
  
  // 全选/取消全选当前页
  const toggleSelectAll = () => {
    if (selectedIds.size === versions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(versions.map(v => v.id)))
    }
  }
  
  // 生成时间线
  const generateTimeline = () => {
    if (selectedIds.size < 2) {
      alert('请至少选择 2 个版本来生成时间线')
      return
    }
    
    // 获取选中的版本，按时间排序（从旧到新）
    const selected = versions
      .filter(v => selectedIds.has(v.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    setTimelineVersions(selected)
    setTimelineIndex(0)
    setShowTimeline(true)
  }
  
  // 格式化时间
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  // 版本来源标签
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'auto_save': return { text: '自动保存', color: 'bg-blue-100 text-blue-700' }
      case 'manual_save': return { text: '手动保存', color: 'bg-green-100 text-green-700' }
      case 'initial': return { text: '初始创建', color: 'bg-purple-100 text-purple-700' }
      default: return { text: source, color: 'bg-gray-100 text-gray-700' }
    }
  }
  
  // 权限检查中
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">检查权限中...</div>
      </div>
    )
  }
  
  // 非管理员
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-500 mb-2">⚠️ 无权访问</div>
          <div className="text-gray-500">{countdown} 秒后跳转...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-800">🔧 管理员后台</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/admin/chat')}
                  className="px-4 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  聊天记录
                </button>
                <button className="px-4 py-1.5 text-sm rounded bg-blue-500 text-white">
                  笔记版本
                </button>
                <button
                  onClick={() => router.push('/admin/analytics')}
                  className="px-4 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  后台统计
                </button>
              </div>
            </div>
            <button
              onClick={() => router.push('/notes-dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← 返回主页
            </button>
          </div>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 筛选条件 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-5 gap-4">
            {/* 用户名 */}
            <div className="relative user-search-container">
              <label className="block text-xs text-gray-500 mb-1">用户名 ({filterUserIds.length} 已选)</label>
              <input
                type="text"
                placeholder="搜索并添加用户"
                value={userSearchTerm}
                onChange={(e) => {
                  setUserSearchTerm(e.target.value)
                  setShowUserDropdown(true)
                }}
                onFocus={() => setShowUserDropdown(true)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
              
              {showUserDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                  <div
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-900 border-b"
                    onClick={() => {
                      setFilterUserIds([])
                      setUserSearchTerm('')
                      setShowUserDropdown(false)
                      setPage(1)
                    }}
                  >
                    清除所有选择
                  </div>
                  {users
                    .filter(u => 
                      u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                      u.user_id.includes(userSearchTerm)
                    )
                    .map(user => (
                      <div
                        key={user.user_id}
                        className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex items-center justify-between ${
                          filterUserIds.includes(user.user_id) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                        }`}
                        onClick={() => {
                          if (filterUserIds.includes(user.user_id)) {
                            setFilterUserIds(prev => prev.filter(id => id !== user.user_id))
                          } else {
                            setFilterUserIds(prev => [...prev, user.user_id])
                          }
                          setUserSearchTerm('')
                          setPage(1)
                        }}
                      >
                        <span>
                          {user.username} <span className="text-gray-400 text-xs">({user.user_id.slice(0, 8)}...)</span>
                        </span>
                        {filterUserIds.includes(user.user_id) && <span className="text-blue-600">✓</span>}
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            {/* 笔记日期 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">笔记日期</label>
              <input
                type="date"
                value={filterNoteDate}
                onChange={(e) => {
                  setFilterNoteDate(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            
            {/* 版本来源 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">版本来源</label>
              <select
                value={filterVersionSource}
                onChange={(e) => {
                  setFilterVersionSource(e.target.value as any)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="all">全部</option>
                <option value="auto_save">自动保存</option>
                <option value="manual_save">手动保存</option>
                <option value="initial">初始创建</option>
              </select>
            </div>
            
            {/* 创建时间范围 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">开始日期</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-500 mb-1">结束日期</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
          </div>
          
          {/* 清除筛选 */}
          {(filterUserIds.length > 0 || filterNoteDate || filterVersionSource !== 'all' || filterStartDate || filterEndDate) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setFilterUserIds([])
                  setUserSearchTerm('')
                  setFilterNoteDate('')
                  setFilterVersionSource('all')
                  setFilterStartDate('')
                  setFilterEndDate('')
                  setPage(1)
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
        
        {/* 统计信息 + 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-gray-600">
              共 <span className="font-bold text-blue-600">{totalCount}</span> 条版本记录
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={exportToCSV}
                disabled={exporting || totalCount === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all duration-200"
              >
                {exporting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    导出中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    导出 CSV
                  </>
                )}
              </button>
              
              {/* 生成时间线按钮 */}
              <button
                onClick={generateTimeline}
                disabled={selectedIds.size < 2}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                生成时间线 {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">每页显示：</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="border rounded px-2 py-1 text-sm text-gray-900"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* 数据表格 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : versions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无数据</div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-10">
                    <input
                      type="checkbox"
                      checked={versions.length > 0 && selectedIds.size === versions.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">创建时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">用户</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">笔记日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">内容长度</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">任务数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">纯文本预览</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {versions.map(version => {
                  const user = users.find(u => u.user_id === version.user_id)
                  
                  return (
                    <tr key={version.id} className={`hover:bg-gray-50 ${selectedIds.has(version.id) ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(version.id)}
                          onChange={() => toggleSelect(version.id)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatTime(version.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user?.username || version.user_id.slice(0, 8) + '...'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{version.note_date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{version.content_length || 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{version.task_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {version.plain_text?.slice(0, 50) || '(空)'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedVersion(version)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* 分页 */}
        {totalCount > pageSize && (
          <div className="mt-4 flex justify-center items-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-600">
              第 {page} / {Math.ceil(totalCount / pageSize)} 页
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= totalCount}
              className="px-4 py-2 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
      
      {/* 详情弹窗 */}
      {selectedVersion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">版本详情</h3>
              <button
                onClick={() => setSelectedVersion(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">版本 ID:</span>
                  <span className="ml-2 text-gray-900">{selectedVersion.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">笔记 ID:</span>
                  <span className="ml-2 text-gray-900">{selectedVersion.note_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">用户 ID:</span>
                  <span className="ml-2 text-gray-900">{selectedVersion.user_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">笔记日期:</span>
                  <span className="ml-2 text-gray-900">{selectedVersion.note_date}</span>
                </div>
                <div>
                  <span className="text-gray-500">版本来源:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${getSourceLabel(selectedVersion.version_source).color}`}>
                    {getSourceLabel(selectedVersion.version_source).text}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">创建时间:</span>
                  <span className="ml-2 text-gray-900">{formatTime(selectedVersion.created_at)}</span>
                </div>
              </div>
              
              {/* 格式化内容预览 - 和 notes dashboard 一模一样 */}
              <div>
                <div className="text-gray-500 text-sm mb-2">📋 笔记内容:</div>
                <div className="bg-white rounded-lg border border-gray-200 max-h-[400px] overflow-y-auto">
                  <NoteEditor
                    initialContent={selectedVersion.content}
                    editable={false}
                    autoSave={false}
                    onChange={() => {}}
                  />
                </div>
              </div>
              
              {/* 纯文本内容 */}
              <div>
                <div className="text-gray-500 text-sm mb-2">纯文本内容:</div>
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedVersion.plain_text || '(空)'}
                </div>
              </div>
              
              {/* JSON 原始数据 */}
              <div>
                <div className="text-gray-500 text-sm mb-2">完整 JSON 内容:</div>
                <pre className="bg-gray-900 text-green-400 rounded p-3 text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(selectedVersion.content, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 时间线弹窗 */}
      {showTimeline && timelineVersions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                📊 版本时间线 ({timelineVersions.length} 个版本)
              </h3>
              <button
                onClick={() => {
                  setShowTimeline(false)
                  setTimelineVersions([])
                  setTimelineIndex(0)
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            {/* 时间线滑块 */}
            <div className="p-4 border-b bg-gray-50 flex-shrink-0">
              <div className="relative pt-2 pb-2">
                {/* 时间线轨道 */}
                <div className="h-1 bg-gray-200 rounded-full relative">
                  {/* 进度条 */}
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-200"
                    style={{ width: `${(timelineIndex / (timelineVersions.length - 1)) * 100}%` }}
                  />
                </div>
                
                {/* 节点 */}
                <div className="absolute top-0 left-0 right-0 flex justify-between" style={{ transform: 'translateY(-1px)' }}>
                  {timelineVersions.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setTimelineIndex(i)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        i === timelineIndex 
                          ? 'bg-blue-600 border-blue-600 scale-125 shadow-lg' 
                          : i < timelineIndex 
                            ? 'bg-blue-400 border-blue-400' 
                            : 'bg-white border-gray-300 hover:border-blue-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* 前后导航按钮 */}
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={() => setTimelineIndex(Math.max(0, timelineIndex - 1))}
                  disabled={timelineIndex === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 上一个
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {timelineIndex + 1} / {timelineVersions.length}
                </span>
                <button
                  onClick={() => setTimelineIndex(Math.min(timelineVersions.length - 1, timelineIndex + 1))}
                  disabled={timelineIndex === timelineVersions.length - 1}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一个 →
                </button>
              </div>
            </div>
            
            {/* 笔记内容预览 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 text-sm text-gray-500">
                <span className="font-medium">笔记时间:</span> {formatTime(timelineVersions[timelineIndex].created_at)}
                <span className="mx-3">|</span>
                <span className="font-medium">任务数:</span> {timelineVersions[timelineIndex].task_count}
              </div>
              <div className="bg-white rounded-lg border border-gray-200">
                <NoteEditor
                  key={timelineVersions[timelineIndex].id}
                  initialContent={timelineVersions[timelineIndex].content}
                  editable={false}
                  autoSave={false}
                  onChange={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
