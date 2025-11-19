type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private level: LogLevel = 'debug'

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]) {
    console.info(`[INFO] ${message}`, ...args)
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args)
  }

  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args)
  }

  success(message: string, ...args: any[]) {
    console.log(`✅ [SUCCESS] ${message}`, ...args)
  }
}

export const logger = new Logger()
