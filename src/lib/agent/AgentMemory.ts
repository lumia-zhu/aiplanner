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
    // TODO: Phase 3 实现完整的步骤记录
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
    console.log('🧹 所有记忆已清空（包括任务上下文）')
  }
}

