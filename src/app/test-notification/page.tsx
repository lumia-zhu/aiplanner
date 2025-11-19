'use client'

/**
 * 浏览器通知测试页面
 * 访问: http://localhost:3001/test-notification
 * 
 * 功能：
 * - 测试浏览器通知权限请求
 * - 测试发送通知
 * - 测试定时提醒
 */

import { useState, useEffect } from 'react'

export default function TestNotificationPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [testMessage, setTestMessage] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [browserInfo, setBrowserInfo] = useState<{
    name: string
    isSupported: boolean
    limitations: string[]
  }>({
    name: '未知',
    isSupported: true,
    limitations: []
  })

  // 检测浏览器类型和限制
  useEffect(() => {
    const ua = navigator.userAgent
    let name = '未知浏览器'
    let limitations: string[] = []

    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      name = 'Safari'
      limitations = [
        '需要用户主动交互后才能请求权限',
        'iOS Safari 可能不支持或有限制',
        '建议使用 Chrome 或 Firefox 获得最佳体验'
      ]
    } else if (ua.includes('Chrome')) {
      name = 'Chrome'
    } else if (ua.includes('Firefox')) {
      name = 'Firefox'
    } else if (ua.includes('Edg')) {
      name = 'Edge'
    }

    const isSupported = 'Notification' in window

    setBrowserInfo({
      name,
      isSupported,
      limitations
    })
  }, [])

  // 检查当前权限状态
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // 请求通知权限
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('你的浏览器不支持通知功能')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)
      
      if (permission === 'granted') {
        // 发送一个欢迎通知
        new Notification('通知权限已开启 ✅', {
          body: '现在可以接收反思提醒了！',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        })
      }
    } catch (error) {
      console.error('请求通知权限失败:', error)
      alert('请求权限失败')
    }
  }

  // 发送测试通知
  const sendTestNotification = () => {
    if (permission !== 'granted') {
      alert('请先授予通知权限')
      return
    }

    const title = '📝 测试通知'
    const body = testMessage || '这是一条测试通知消息'

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      requireInteraction: false,
      silent: false,
    })

    // 点击通知时的回调
    notification.onclick = () => {
      console.log('通知被点击了')
      window.focus()
      notification.close()
    }

    // 3秒后自动关闭
    setTimeout(() => {
      notification.close()
    }, 3000)
  }

  // 发送反思提醒通知
  const sendReflectionReminder = () => {
    if (permission !== 'granted') {
      alert('请先授予通知权限')
      return
    }

    const notification = new Notification('🌙 每日反思时间到了', {
      body: '花几分钟总结今天的收获和成长吧！\n\n点击打开反思页面',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'daily-reflection',
      requireInteraction: true, // 需要用户交互才会关闭
      silent: false,
    })

    notification.onclick = () => {
      console.log('用户点击了反思提醒')
      window.focus()
      // TODO: 跳转到反思页面
      notification.close()
    }
  }

  // 安排定时提醒
  const scheduleNotification = () => {
    if (!scheduledTime) {
      alert('请选择提醒时间')
      return
    }

    if (permission !== 'granted') {
      alert('请先授予通知权限')
      return
    }

    // 取消之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // 计算延迟时间
    const now = new Date()
    const [hours, minutes] = scheduledTime.split(':').map(Number)
    
    const scheduledDate = new Date()
    scheduledDate.setHours(hours, minutes, 0, 0)

    // 如果设定时间已过，则设为明天
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1)
    }

    const delay = scheduledDate.getTime() - now.getTime()
    const delaySeconds = Math.floor(delay / 1000)
    const delayMinutes = Math.floor(delaySeconds / 60)

    console.log(`将在 ${delayMinutes} 分钟后发送通知`)

    const id = setTimeout(() => {
      sendReflectionReminder()
      setIsScheduled(false)
      setTimeoutId(null)
    }, delay)

    setTimeoutId(id)
    setIsScheduled(true)
    alert(`已安排在 ${scheduledTime} 发送提醒（${delayMinutes} 分钟后）`)
  }

  // 取消定时提醒
  const cancelSchedule = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsScheduled(false)
  }

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🔔 浏览器通知测试</h1>
        <p className="text-gray-600 mb-8">测试浏览器通知功能，为反思提醒做准备</p>

        {/* 权限状态 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 权限状态</h2>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm text-gray-600">当前权限：</span>
              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                permission === 'granted' 
                  ? 'bg-green-100 text-green-700'
                  : permission === 'denied'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {permission === 'granted' ? '✅ 已授权' : permission === 'denied' ? '❌ 已拒绝' : '⏳ 未设置'}
              </span>
            </div>
          </div>

          {permission === 'default' && (
            <button
              onClick={requestPermission}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              请求通知权限
            </button>
          )}

          {permission === 'denied' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">
                ⚠️ 通知权限已被拒绝。请在浏览器设置中手动开启：
              </p>
              <ol className="text-sm text-red-600 mt-2 ml-4 list-decimal">
                <li>点击地址栏左侧的锁图标</li>
                <li>找到"通知"权限</li>
                <li>选择"允许"</li>
                <li>刷新页面</li>
              </ol>
            </div>
          )}

          {permission === 'granted' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">
                ✅ 通知权限已开启！可以接收提醒了。
              </p>
            </div>
          )}
        </div>

        {/* 测试通知 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">💬 发送测试通知</h2>
          
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="输入通知内容（可选）"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={sendTestNotification}
            disabled={permission !== 'granted'}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            发送测试通知
          </button>
        </div>

        {/* 反思提醒测试 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🌙 反思提醒测试</h2>
          
          <button
            onClick={sendReflectionReminder}
            disabled={permission !== 'granted'}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed mb-2"
          >
            立即发送反思提醒
          </button>

          <p className="text-xs text-gray-500">
            模拟每日反思时间到达时的通知效果
          </p>
        </div>

        {/* 定时提醒 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">⏰ 定时提醒测试</h2>
          
          <div className="flex gap-2 mb-3">
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {!isScheduled ? (
              <button
                onClick={scheduleNotification}
                disabled={permission !== 'granted'}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                安排提醒
              </button>
            ) : (
              <button
                onClick={cancelSchedule}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                取消提醒
              </button>
            )}
          </div>

          {isScheduled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                ⏰ 已安排在 <strong>{scheduledTime}</strong> 发送反思提醒
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            选择一个时间，系统会在该时间发送通知（如果时间已过，则为明天）
          </p>
        </div>

        {/* 技术说明 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">📚 技术说明</h2>
          
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <strong>浏览器支持：</strong>
              <p className="text-gray-600">Chrome、Firefox、Safari、Edge 等现代浏览器都支持</p>
            </div>

            <div>
              <strong>权限机制：</strong>
              <p className="text-gray-600">需要用户主动授权，一次授权长期有效</p>
            </div>

            <div>
              <strong>通知特性：</strong>
              <ul className="list-disc list-inside text-gray-600 ml-2">
                <li>标题、正文、图标</li>
                <li>点击事件回调</li>
                <li>自动关闭或需要交互</li>
                <li>声音提醒（可关闭）</li>
              </ul>
            </div>

            <div>
              <strong>限制条件：</strong>
              <ul className="list-disc list-inside text-gray-600 ml-2">
                <li>需要 HTTPS 或 localhost</li>
                <li>用户必须授权</li>
                <li>部分浏览器有数量限制</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



