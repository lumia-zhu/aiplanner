// ============================================
// Session 追踪 Hook
// ============================================
// 用途：管理用户会话的生命周期，提供 sessionId 给其他埋点使用
// ============================================

import { useRef, useEffect, useCallback, useState } from 'react'
import { 
  createSession, 
  updateSession, 
  logSessionStarted, 
  logSessionEnded 
} from '@/lib/userEventService'

/**
 * Session 追踪 Hook 的返回值
 */
interface UseSessionTrackingReturn {
  /** 当前会话 ID */
  sessionId: string
  /** 增加事件计数 */
  incrementEventCount: () => void
  /** 当前事件计数 */
  eventsCount: number
  /** 会话是否已初始化 */
  isInitialized: boolean
}

/**
 * 生成 UUID（兼容不支持 crypto.randomUUID 的环境）
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Session 追踪 Hook
 * 
 * 功能：
 * 1. 页面加载时创建新会话
 * 2. 记录会话开始事件
 * 3. 页面关闭时记录会话结束事件并更新会话
 * 4. 提供 sessionId 给其他埋点使用
 * 
 * @param userId 用户 ID（必须）
 * @param contextDate 当前上下文日期（YYYY-MM-DD 格式）
 * @returns Session 追踪相关的状态和方法
 */
export function useSessionTracking(
  userId: string | null | undefined,
  contextDate: string
): UseSessionTrackingReturn {
  // 会话 ID（整个会话期间保持不变）
  const sessionIdRef = useRef<string>(generateUUID())
  
  // 会话开始时间
  const sessionStartRef = useRef<number>(Date.now())
  
  // 事件计数
  const [eventsCount, setEventsCount] = useState(0)
  const eventsCountRef = useRef<number>(0)
  
  // 会话是否已初始化
  const [isInitialized, setIsInitialized] = useState(false)
  
  // 上一次的 contextDate（用于检测变化）
  const lastContextDateRef = useRef<string>(contextDate)
  
  // 增加事件计数
  const incrementEventCount = useCallback(() => {
    eventsCountRef.current++
    setEventsCount(eventsCountRef.current)
  }, [])
  
  // 初始化会话
  useEffect(() => {
    if (!userId) {
      return
    }
    
    const initSession = async () => {
      const sessionId = sessionIdRef.current
      
      console.log('🎬 初始化用户会话:', sessionId)
      
      // 1. 创建会话记录
      const deviceInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
        screenHeight: typeof window !== 'undefined' ? window.screen.height : 0
      }
      
      const created = await createSession({
        sessionId,
        userId,
        deviceInfo
      })
      
      if (created) {
        // 2. 记录会话开始事件
        await logSessionStarted(userId, sessionId, contextDate)
        setIsInitialized(true)
        console.log('✅ 会话初始化完成')
      } else {
        console.warn('⚠️ 会话创建失败，但不影响功能使用')
        // 即使创建失败，也标记为已初始化，避免阻塞其他功能
        setIsInitialized(true)
      }
    }
    
    initSession()
    
    // 页面关闭/刷新时结束会话
    const handleBeforeUnload = () => {
      if (!userId) return
      
      const sessionId = sessionIdRef.current
      const durationMs = Date.now() - sessionStartRef.current
      const count = eventsCountRef.current
      
      console.log('🔚 结束用户会话:', sessionId, '时长:', durationMs, 'ms', '事件数:', count)
      
      // 使用 sendBeacon 确保数据发送（即使页面关闭）
      // 注意：sendBeacon 不支持自定义 headers，所以这里用同步方式
      // 实际生产环境可能需要其他方案
      
      // 记录会话结束事件（尽力而为）
      logSessionEnded(userId, sessionId, durationMs, count, lastContextDateRef.current)
        .catch(() => {}) // 忽略错误
      
      // 更新会话记录（尽力而为）
      updateSession({
        sessionId,
        endedAt: new Date().toISOString(),
        durationMs,
        eventsCount: count
      }).catch(() => {}) // 忽略错误
    }
    
    // 页面可见性变化处理（用户切换标签页）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 用户离开页面，可以记录一个中间状态
        // 这里暂时不做处理，因为 beforeunload 已经覆盖了
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId]) // 只在 userId 变化时重新初始化
  
  // 更新 lastContextDateRef
  useEffect(() => {
    lastContextDateRef.current = contextDate
  }, [contextDate])
  
  return {
    sessionId: sessionIdRef.current,
    incrementEventCount,
    eventsCount,
    isInitialized
  }
}

/**
 * 获取当前日期字符串（YYYY-MM-DD 格式）
 */
export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0]
}
