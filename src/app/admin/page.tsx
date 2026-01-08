'use client'

/**
 * 管理员后台 - 首页
 * 自动跳转到聊天记录页面
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage } from '@/lib/auth'
import { isUserAdmin } from '@/lib/userProfile'

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const checkAdminAccess = async () => {
      // 检查登录状态
      const user = getUserFromStorage()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // 检查管理员权限
      const adminStatus = await isUserAdmin(user.id)
      setIsAdmin(adminStatus)
      setChecking(false)

      if (adminStatus) {
        // 是管理员，跳转到聊天记录页面
        router.push('/admin/chat')
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
          <p className="text-gray-600 mb-4">
            你不是管理员，无法访问此页面
          </p>
          <p className="text-gray-500 text-sm">
            {countdown} 秒后自动返回主页面...
          </p>
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

  // 正在跳转（理论上不会显示，因为会直接跳转）
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">正在跳转到管理后台...</p>
      </div>
    </div>
  )
}
