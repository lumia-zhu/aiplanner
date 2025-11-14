/**
 * 统一日志管理工具
 * 
 * 使用方式：
 * import { logger } from '@/utils/logger'
 * 
 * logger.debug('调试信息')  // 只在开发环境显示
 * logger.info('普通信息')   // 在所有环境显示
 * logger.warn('警告信息')   // 黄色警告
 * logger.error('错误信息')  // 红色错误
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private enableDebugLogs = process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS === 'true'

  /**
   * 调试日志（开发环境 + 启用调试时显示）
   */
  debug(...args: any[]) {
    if (this.isDevelopment && this.enableDebugLogs) {
      console.log('🐛 [DEBUG]', ...args)
    }
  }

  /**
   * 普通信息日志（所有环境显示）
   */
  info(...args: any[]) {
    console.log('ℹ️', ...args)
  }

  /**
   * 成功日志
   */
  success(...args: any[]) {
    console.log('✅', ...args)
  }

  /**
   * 警告日志
   */
  warn(...args: any[]) {
    console.warn('⚠️', ...args)
  }

  /**
   * 错误日志（始终显示）
   */
  error(...args: any[]) {
    console.error('❌', ...args)
  }

  /**
   * 分组日志（用于复杂的日志输出）
   */
  group(label: string, callback: () => void) {
    if (this.isDevelopment && this.enableDebugLogs) {
      console.group(label)
      callback()
      console.groupEnd()
    }
  }

  /**
   * 性能日志
   */
  time(label: string) {
    if (this.isDevelopment && this.enableDebugLogs) {
      console.time(label)
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment && this.enableDebugLogs) {
      console.timeEnd(label)
    }
  }
}

export const logger = new Logger()


