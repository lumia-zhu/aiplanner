/**
 * ReAct Agent 核心
 * 
 * TODO: Phase 3 实现完整的 ReAct 循环
 */

import type { AgentContext, AgentResponse } from './AgentTypes'

export class ReactAgent {
  constructor() {
    console.log('✅ ReactAgent 初始化（占位符 - Phase 1）')
  }
  
  /**
   * 运行 Agent
   * 
   * @param message 用户消息
   * @param context Agent 上下文（包含任务上下文缓存）
   * @returns Agent 响应
   */
  async run(message: string, context: AgentContext): Promise<AgentResponse> {
    console.log('🤖 ReactAgent.run() 被调用')
    console.log('📝 用户消息:', message)
    console.log('📊 任务上下文:', context.taskContext)
    
    // 占位符：返回错误，提示功能未实现
    return {
      type: 'error',
      content: '🚧 Agent 功能正在开发中（Phase 1 完成，Phase 2-3 开发中）\n\n请切换到「普通模式」继续使用。'
    }
  }
  
  /**
   * 恢复被中断的流程（用户提供输入后）
   * 
   * @param userInput 用户输入
   * @param context 上下文
   * @returns Agent 响应
   */
  async resume(userInput: string, context: any): Promise<AgentResponse> {
    console.log('🔄 ReactAgent.resume() 被调用')
    
    return {
      type: 'error',
      content: '🚧 Agent 恢复功能正在开发中'
    }
  }
}

