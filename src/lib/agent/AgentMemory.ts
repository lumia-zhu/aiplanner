/**
 * Agent 记忆管理
 * 
 * 负责管理：
 * 1. 对话历史（短期记忆）
 * 2. 思考过程（ReAct Thoughts）
 * 3. 任务上下文缓存（Long-term Memory）
 * 
 * TODO: Phase 3 完善实现
 */

import type { IAgentMemory, ReActStep, TaskContext } from './AgentTypes'

export class AgentMemory implements IAgentMemory {
  // 对话历史（短期记忆）
  private messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  
  // 思考过程
  private thoughts: string[] = []
  
  // ReAct 步骤
  private steps: ReActStep[] = []
  
  // 任务上下文缓存（Long-term Memory）
  private taskContext: TaskContext | null = null
  
  // 任务上下文加载时间戳（用于判断缓存是否过期）
  private taskContextLoadedAt: number | null = null
  
  constructor() {
    console.log('✅ AgentMemory 初始化')
  }
  
  /**
   * 添加对话消息
   */
  addMessage(message: { role: 'user' | 'assistant'; content: string }): void {
    this.messages.push(message)
    console.log(`💬 添加消息 [${message.role}]:`, message.content.substring(0, 50))
  }
  
  /**
   * 添加思考
   */
  addThought(thought: string): void {
    this.thoughts.push(thought)
    console.log('💭 添加思考:', thought.substring(0, 50))
  }
  
  /**
   * 添加 ReAct 步骤
   */
  addStep(step: { action: string; input: any; observation: any }): void {
    console.log('🔄 添加 ReAct 步骤:', step.action)
    
    // 1. 保存步骤到历史记录
    this.steps.push(step)
    
    // 2. 将 Observation 作为 assistant 消息添加到对话历史
    // 这样 LLM 在下一轮迭代时能看到工具执行结果
    const observationText = `Observation: ${JSON.stringify(step.observation, null, 2)}`
    this.addMessage({
      role: 'assistant',
      content: observationText
    })
    
    console.log('✅ ReAct 步骤已记录，Observation 已添加到对话历史')
  }
  
  /**
   * 获取对话历史
   */
  getHistory() {
    return this.messages
  }
  
  /**
   * 获取思考历史
   */
  getThoughts() {
    return this.thoughts
  }
  
  /**
   * 获取 ReAct 步骤历史
   */
  getSteps(): ReActStep[] {
    return this.steps
  }
  
  /**
   * 更新任务上下文（Long-term Memory）
   * 
   * 这是 Agent 的长期记忆，包含近3个月的任务信息
   */
  updateTaskContext(taskContext: TaskContext): void {
    this.taskContext = taskContext
    console.log('📊 任务上下文已更新:', {
      今天任务数: taskContext.todayTasks.length,
      近3个月总任务数: taskContext.recentTasksSummary.totalCount,
      紧急任务数: taskContext.recentTasksSummary.urgentCount
    })
  }
  
  /**
   * 获取任务上下文
   */
  getTaskContext(): TaskContext | null {
    return this.taskContext
  }
  
  /**
   * ✅ 清空本次推理过程（保留对话历史和任务上下文）
   * 
   * 用于开始新的用户请求，清空本次推理的思考和步骤
   * 但保留对话历史作为上下文
   */
  clearCurrentRun(): void {
    this.thoughts = []
    this.steps = []
    console.log('🧹 本次推理过程已清空（保留对话历史和任务上下文）')
  }
  
  /**
   * 清空对话记忆（保留任务上下文）
   * 
   * 用于开始新的对话，但保持对任务的了解
   */
  clear(): void {
    this.messages = []
    this.thoughts = []
    this.steps = []
    console.log('🧹 对话记忆已清空（保留任务上下文）')
  }
  
  /**
   * 完全清空（包括任务上下文）
   * 
   * 用于用户退出登录或切换账号
   */
  clearAll(): void {
    this.messages = []
    this.thoughts = []
    this.steps = []
    this.taskContext = null
    this.taskContextLoadedAt = null
    console.log('🧹 所有记忆已清空（包括任务上下文）')
  }
  
  /**
   * 确保任务上下文已加载（如果缓存过期或不存在，则重新加载）
   * 
   * @param userId 用户 ID
   * @param referenceDate 参考日期（默认为今天）
   */
  async ensureTaskContext(userId: string, referenceDate?: Date): Promise<void> {
    const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

    // 检查缓存是否有效
    const now = Date.now()
    const cacheAge = this.taskContextLoadedAt ? now - this.taskContextLoadedAt : Infinity
    
    if (this.taskContext && cacheAge < CACHE_DURATION) {
      console.log(`✅ 任务上下文缓存有效（${Math.floor(cacheAge / 1000)}秒前加载），跳过重新加载`)
      return
    }

    // 缓存过期或不存在，重新加载
    console.log('🔄 任务上下文缓存过期或不存在，重新加载...')
    
    try {
      // 动态导入工具（避免循环依赖）
      const { LoadTaskContextTool } = await import('./tools/LoadTaskContextTool')
      
      const tool = new LoadTaskContextTool()
      const result = await tool.execute({ 
        userId, 
        referenceDate: referenceDate || new Date() 
      })

      if (result.type === 'success') {
        this.updateTaskContext(result.data)
        this.taskContextLoadedAt = now
        console.log('✅ 任务上下文自动加载成功')
      } else {
        console.error('❌ 任务上下文加载失败:', result.message)
      }
    } catch (error: any) {
      console.error('❌ 任务上下文加载异常:', error)
    }
  }
}

