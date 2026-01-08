'use client'

/**
 * 管理员后台 - 聊天记录页面
 * 查看和筛选用户与 Chatbot 的完整聊天记录
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage } from '@/lib/auth'
import { isUserAdmin } from '@/lib/userProfile'
import { createClient } from '@/lib/supabase-client'

// 聊天消息类型
interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  message_type: string
  content: any
  context_date: string | null
  metadata: any
  created_at: string
  chat_date: string
}

export default function AdminChatPage() {
  const router = useRouter()
  
  // 权限状态
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [countdown, setCountdown] = useState(3)
  
  // 数据状态
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  
  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  // 筛选状态
  const [filterUserIds, setFilterUserIds] = useState<string[]>([])
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'assistant'>('all')
  const [filterMessageType, setFilterMessageType] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  
  // 用户列表（用于下拉选择）
  const [users, setUsers] = useState<Array<{ user_id: string; username: string }>>([])
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  
  // 消息类型列表
  const [messageTypes, setMessageTypes] = useState<string[]>([])
  
  // 详情弹窗
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null)

  // 检查管理员权限
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

  // 加载聊天记录
  const loadMessages = useCallback(async () => {
    if (!isAdmin) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      
      // 构建查询（带筛选）
      let countQuery = supabase.from('chat_messages').select('*', { count: 'exact', head: true })
      let dataQuery = supabase.from('chat_messages').select('*')
      
      // 应用筛选条件
      if (filterUserIds.length > 0) {
        countQuery = countQuery.in('user_id', filterUserIds)
        dataQuery = dataQuery.in('user_id', filterUserIds)
      }
      
      if (filterRole !== 'all') {
        countQuery = countQuery.eq('role', filterRole)
        dataQuery = dataQuery.eq('role', filterRole)
      }
      
      if (filterMessageType.trim()) {
        countQuery = countQuery.eq('message_type', filterMessageType.trim())
        dataQuery = dataQuery.eq('message_type', filterMessageType.trim())
      }
      
      if (filterStartDate) {
        countQuery = countQuery.gte('created_at', filterStartDate)
        dataQuery = dataQuery.gte('created_at', filterStartDate)
      }
      
      if (filterEndDate) {
        // 结束日期包含当天全天
        const endDateTime = new Date(filterEndDate)
        endDateTime.setHours(23, 59, 59, 999)
        countQuery = countQuery.lte('created_at', endDateTime.toISOString())
        dataQuery = dataQuery.lte('created_at', endDateTime.toISOString())
      }
      
      // 查询总数
      const { count } = await countQuery
      setTotalCount(count || 0)
      
      // 查询数据（分页）
      const { data, error } = await dataQuery
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)
      
      if (error) {
        console.error('查询聊天记录失败:', error)
        return
      }
      
      setMessages(data || [])
    } catch (error) {
      console.error('加载聊天记录异常:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, page, pageSize, filterUserIds, filterRole, filterMessageType, filterStartDate, filterEndDate])

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    
    try {
      const supabase = createClient()
      
      // 从 user_profiles 获取用户信息
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id')
      
      if (!profiles) return
      
      // 获取对应的用户名
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

  // 加载消息类型列表
  const loadMessageTypes = useCallback(async () => {
    if (!isAdmin) return
    
    try {
      const supabase = createClient()
      
      // 获取所有不同的 message_type
      const { data } = await supabase
        .from('chat_messages')
        .select('message_type')
      
      if (data) {
        const types = [...new Set(data.map(d => d.message_type).filter(Boolean))]
        setMessageTypes(types.sort())
      }
    } catch (error) {
      console.error('加载消息类型列表失败:', error)
    }
  }, [isAdmin])

  // 权限通过后加载数据
  useEffect(() => {
    if (isAdmin) {
      loadMessages()
      loadUsers()
      loadMessageTypes()
    }
  }, [isAdmin, loadMessages, loadUsers, loadMessageTypes])

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
  const [exporting, setExporting] = useState(false)
  
  const exportToCSV = async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      
      // 构建查询（带筛选，最多 5000 条）
      let query = supabase.from('chat_messages').select('*')
      
      if (filterUserIds.length > 0) {
        query = query.in('user_id', filterUserIds)
      }
      if (filterRole !== 'all') {
        query = query.eq('role', filterRole)
      }
      if (filterMessageType.trim()) {
        query = query.eq('message_type', filterMessageType.trim())
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
      
      // 构建 CSV 内容
      const headers = ['ID', '用户ID', '角色', '消息类型', '上下文日期', '创建时间', '内容', '元数据']
      const rows = data.map(msg => [
        msg.id,
        msg.user_id,
        msg.role,
        msg.message_type || 'text',
        msg.context_date || '',
        msg.created_at,
        JSON.stringify(msg.content).replace(/"/g, '""'),  // 转义双引号
        JSON.stringify(msg.metadata || {}).replace(/"/g, '""')
      ])
      
      // 添加 BOM 以支持中文
      const BOM = '\uFEFF'
      const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
      
      // 下载文件
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `chat_messages_${new Date().toISOString().slice(0, 10)}.csv`
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

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 截取内容预览
  // 提取完整文本内容（用于 tooltip）
  const getFullContent = (content: any): string => {
    try {
      if (typeof content === 'string') {
        return content
      }
      
      if (Array.isArray(content)) {
        const texts = content
          .filter(item => item.type === 'text' && item.text)
          .map(item => item.text)
          .join(' ')
        
        if (texts) return texts
        
        const hasTaskList = content.some(item => item.type === 'task-list')
        if (hasTaskList) return '[任务列表]'
      }
      
      if (typeof content === 'object' && content.text) {
        return content.text
      }
      
      return '[非文本内容]'
    } catch {
      return '[无法解析]'
    }
  }

  // 获取内容预览（截断版本）
  const getContentPreview = (content: any) => {
    const full = getFullContent(content)
    return full.length > 120 ? full.slice(0, 120) + '...' : full
  }

  // 总页数
  const totalPages = Math.ceil(totalCount / pageSize)

  // 加载中
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

  // 非管理员
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">无访问权限</h1>
          <p className="text-gray-600 mb-4">你不是管理员，无法访问此页面</p>
          <p className="text-gray-500 text-sm">{countdown} 秒后自动返回...</p>
          <button
            onClick={() => router.push('/notes-dashboard')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            立即返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-800">🔧 管理员后台</h1>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
                  聊天记录
                </button>
                <button 
                  onClick={() => router.push('/admin/notes')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  笔记版本
                </button>
              </div>
            </div>
            <button
              onClick={() => router.push('/notes-dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← 返回主页
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 筛选表单 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700">🔍 筛选条件</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
              
              {/* 下拉列表 */}
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
                  {users.filter(u => 
                    u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    u.user_id.includes(userSearchTerm)
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      未找到匹配的用户
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* 角色 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">角色</label>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value as any)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="all">全部</option>
                <option value="user">用户</option>
                <option value="assistant">AI</option>
              </select>
            </div>
            
            {/* 消息类型 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">消息类型</label>
              <select
                value={filterMessageType}
                onChange={(e) => {
                  setFilterMessageType(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="">全部类型</option>
                {messageTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* 开始日期 */}
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
            
            {/* 结束日期 */}
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
          
          {/* 清除筛选按钮 */}
          {(filterUserIds.length > 0 || filterRole !== 'all' || filterMessageType || filterStartDate || filterEndDate) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setFilterUserIds([])
                  setUserSearchTerm('')
                  setFilterRole('all')
                  setFilterMessageType('')
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
              共 <span className="font-bold text-blue-600">{totalCount}</span> 条聊天记录
            </div>
            <div className="flex items-center gap-4">
              {/* 导出 CSV */}
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
              
              {/* 每页显示 */}
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
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无数据
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上下文日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">内容预览</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatTime(msg.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" title={msg.user_id}>
                      {users.find(u => u.user_id === msg.user_id)?.username || msg.user_id?.slice(0, 8) + '...'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        msg.role === 'user' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {msg.role === 'user' ? '用户' : 'AI'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {msg.message_type || 'text'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {msg.context_date || '-'}
                    </td>
                    <td 
                      className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" 
                      title={getFullContent(msg.content)}
                    >
                      {getContentPreview(msg.content)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setSelectedMessage(msg)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
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

      {/* 详情弹窗 */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">消息详情</h2>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">ID</label>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded text-gray-900">{selectedMessage.id}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">用户ID</label>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded text-gray-900">{selectedMessage.user_id}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">角色</label>
                    <div className="text-sm bg-gray-50 p-2 rounded text-gray-900">{selectedMessage.role}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">类型</label>
                    <div className="text-sm bg-gray-50 p-2 rounded text-gray-900">{selectedMessage.message_type || 'text'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">上下文日期</label>
                    <div className="text-sm bg-gray-50 p-2 rounded text-gray-900">{selectedMessage.context_date || '-'}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">创建时间</label>
                  <div className="text-sm bg-gray-50 p-2 rounded text-gray-900">{formatTime(selectedMessage.created_at)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Content (JSON)</label>
                  <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
                    {JSON.stringify(selectedMessage.content, null, 2)}
                  </pre>
                </div>
                {selectedMessage.metadata && Object.keys(selectedMessage.metadata).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Metadata (JSON)</label>
                    <pre className="text-xs bg-gray-900 text-yellow-400 p-4 rounded overflow-x-auto">
                      {JSON.stringify(selectedMessage.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedMessage, null, 2))
                  alert('已复制到剪贴板')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                复制 JSON
              </button>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
