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
      
      // 查询总数
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
      
      setTotalCount(count || 0)
      
      // 查询数据（分页）
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
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
  }, [isAdmin, page, pageSize])

  // 权限通过后加载数据
  useEffect(() => {
    if (isAdmin) {
      loadMessages()
    }
  }, [isAdmin, loadMessages])

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
  const getContentPreview = (content: any) => {
    try {
      if (typeof content === 'string') {
        return content.slice(0, 120) + (content.length > 120 ? '...' : '')
      }
      const text = JSON.stringify(content)
      return text.slice(0, 120) + (text.length > 120 ? '...' : '')
    } catch {
      return '[无法解析]'
    }
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
        {/* 统计信息 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-gray-600">
              共 <span className="font-bold text-blue-600">{totalCount}</span> 条聊天记录
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">每页显示：</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户ID</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {msg.user_id?.slice(0, 8)}...
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
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
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
              <h2 className="text-lg font-bold">消息详情</h2>
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
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded">{selectedMessage.id}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">用户ID</label>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded">{selectedMessage.user_id}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">角色</label>
                    <div className="text-sm bg-gray-50 p-2 rounded">{selectedMessage.role}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">类型</label>
                    <div className="text-sm bg-gray-50 p-2 rounded">{selectedMessage.message_type || 'text'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">上下文日期</label>
                    <div className="text-sm bg-gray-50 p-2 rounded">{selectedMessage.context_date || '-'}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">创建时间</label>
                  <div className="text-sm bg-gray-50 p-2 rounded">{formatTime(selectedMessage.created_at)}</div>
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
