'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginUser, saveUserToStorage } from '@/lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('🔐 登录按钮点击，当前状态:', { username, password: password ? '***' : '空' })
    
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setIsLoading(true)
    setError('')

    console.log('📡 开始登录请求...')
    const result = await loginUser(username.trim(), password)
    console.log('📡 登录结果:', result.error || '成功')
    
    if (result.error) {
      setError(result.error)
    } else if (result.user) {
      // ⭐ 登录成功时清除之前的会话状态，确保每次登录都是全新状态
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('dateScope')
        sessionStorage.removeItem('chatSidebarOpen')
      }
      
      saveUserToStorage(result.user)
      router.push('/notes-dashboard') // 登录成功后跳转到笔记界面
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* 应用标题和介绍 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📋 任务管理器
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            简洁高效的任务管理应用
          </p>
          <p className="text-base text-gray-600">
            欢迎回来！请登录您的账户
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="输入用户名"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#3f3f3f]"
              placeholder="输入密码"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            还没有账户？{' '}
            <Link href="/auth/register" className="text-blue-600 hover:text-blue-500 font-medium">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
