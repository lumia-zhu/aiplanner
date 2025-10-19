/**
 * 模拟流式文本输出
 * 逐字显示文本,类似打字机效果
 */

interface StreamTextOptions {
  text: string
  onChunk: (chunk: string) => void
  onComplete: () => void
  chunkSize?: number // 每次显示几个字符
  delay?: number // 每次延迟多少毫秒
}

export function streamText({
  text,
  onChunk,
  onComplete,
  chunkSize = 2, // 默认每次2个字符
  delay = 30 // 默认30ms延迟
}: StreamTextOptions): () => void {
  let currentIndex = 0
  let intervalId: NodeJS.Timeout | null = null
  
  intervalId = setInterval(() => {
    if (currentIndex >= text.length) {
      // 文本已全部显示完
      if (intervalId) {
        clearInterval(intervalId)
      }
      onComplete()
      return
    }
    
    // 计算本次要显示的字符数
    const endIndex = Math.min(currentIndex + chunkSize, text.length)
    const chunk = text.slice(currentIndex, endIndex)
    
    onChunk(chunk)
    currentIndex = endIndex
  }, delay)
  
  // 返回取消函数
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}










