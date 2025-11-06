/**
 * ReAct Agent 核心
 * 
 * Phase 3 Step 3: 完整的 ReAct 循环实现
 * 
 * 基于 ReAct (Reasoning and Acting) 范式
 * 论文: https://arxiv.org/abs/2210.03629
 */

import type { AgentContext, AgentResponse, AgentTool, ChatMessage } from './AgentTypes'
import { AgentMemory } from './AgentMemory'
import { buildReActPrompt, parseReActOutput, validateActionInput } from './AgentPrompt'
import { getAllTools, getTool } from './tools'
import { doubaoService } from '@/lib/doubaoService'
import { DEFAULT_AGENT_CONFIG } from './AgentConfig'

/**
 * ReAct Agent 主类
 */
export class ReactAgent {
  private memory: AgentMemory
  private tools: AgentTool[]
  private maxIterations: number
  
  // 用于恢复流程的状态
  private pendingToolName: string | null = null
  private pendingToolInput: any = null
  private pendingContext: any = null
  
  constructor() {
    this.memory = new AgentMemory()
    this.tools = getAllTools()
    this.maxIterations = DEFAULT_AGENT_CONFIG.maxIterations
    
    console.log('✅ ReactAgent 初始化完成')
    console.log(`   📦 已加载 ${this.tools.length} 个工具`)
    console.log(`   🔄 最大迭代次数: ${this.maxIterations}`)
  }
  
  /**
   * 运行 Agent（主入口）
   * 
   * @param message 用户消息
   * @param context Agent 上下文（包含任务上下文缓存）
   * @returns Agent 响应
   */
  async run(message: string, context: AgentContext): Promise<AgentResponse> {
    console.log('\n🤖 ========== ReactAgent.run() ==========')
    console.log(`📝 用户消息: "${message}"`)
    console.log(`🆔 用户 ID: ${context.userId}`)
    console.log(`📊 任务上下文: ${context.taskContext ? '已加载' : '未加载'}`)
    
    // 1. 确保任务上下文已加载
    await this.memory.ensureTaskContext(context.userId)
    
    // 2. 添加用户消息到记忆
    this.memory.addMessage({ role: 'user', content: message })
    
    // 3. 开始 ReAct 循环
    return await this.continueRun(message, context)
  }
  
  /**
   * 恢复被暂停的流程（用户提供输入后）
   * 
   * @param userInput 用户输入
   * @param context 上下文（从上次暂停时保存的）
   * @returns Agent 响应
   */
  async resume(userInput: string, resumeContext: any): Promise<AgentResponse> {
    console.log('\n🔄 ========== ReactAgent.resume() ==========')
    console.log(`📝 用户输入: "${userInput}"`)
    console.log(`🔧 恢复工具: ${resumeContext.pendingTool}`)
    
    // 1. 恢复暂停状态
    this.pendingToolName = resumeContext.pendingTool
    this.pendingToolInput = resumeContext.toolInput
    this.pendingContext = resumeContext.agentContext
    
    // 2. 调用工具（第二轮，带用户输入）
    const tool = getTool(this.pendingToolName!)
    if (!tool) {
      return {
        type: 'error',
        content: `工具 ${this.pendingToolName} 未找到`
      }
    }
    
    // 将用户输入作为 userContext 参数传递
    const toolParams = {
      ...this.pendingToolInput,
      userContext: userInput
    }
    
    console.log(`🔧 调用工具（第二轮）: ${tool.name}`)
    
    let toolResult
    try {
      toolResult = await tool.execute(toolParams)
    } catch (error: any) {
      console.error(`❌ 工具执行错误: ${error.message}`)
      toolResult = {
        type: 'error' as const,
        message: `工具执行失败: ${error.message}`
      }
    }
    
    // 3. 处理工具结果
    if (toolResult.type === 'need_input') {
      // 仍然需要更多输入（理论上不应该发生）
      console.log('⚠️ 工具仍然需要输入（不常见）')
      return {
        type: 'need_user_input',
        prompt: toolResult.prompt,
        context: toolResult.context
      }
    } else if (toolResult.type === 'error') {
      // 工具执行失败
      console.error(`❌ 工具执行失败: ${toolResult.message}`)
      
      // 记录错误观察
      const observation = `工具执行失败: ${toolResult.message}`
      this.memory.addMessage({
        role: 'assistant',
        content: `Observation: ${observation}`
      })
      
      // 继续 ReAct 循环，让 Agent 重新推理
      return await this.continueRun('', this.pendingContext, 1)
    } else {
      // 工具执行成功
      console.log('✅ 工具执行成功')
      
      const observation = `工具 ${tool.name} 执行成功。\n结果: ${JSON.stringify(toolResult.data, null, 2)}`
      this.memory.addMessage({
        role: 'assistant',
        content: `Observation: ${observation}`
      })
      
      // 继续 ReAct 循环
      return await this.continueRun('', this.pendingContext, 1)
    }
  }
  
  /**
   * ReAct 主循环（私有方法）
   * 
   * 实现 Thought → Action → Observation 循环
   * 
   * @param userMessage 用户消息（第一次调用时有值，后续循环为空）
   * @param context Agent 上下文
   * @param startIteration 起始迭代次数（用于恢复）
   * @returns Agent 响应
   */
  private async continueRun(
    userMessage: string,
    context: AgentContext,
    startIteration: number = 0
  ): Promise<AgentResponse> {
    const usedTools: string[] = []
    const thoughts: string[] = []
    
    for (let iteration = startIteration; iteration < this.maxIterations; iteration++) {
      console.log(`\n🔄 ========== 迭代 ${iteration + 1}/${this.maxIterations} ==========`)
      
      // ========== 步骤 1: 构建 Prompt ==========
      const prompt = buildReActPrompt({
        userMessage: iteration === 0 ? userMessage : '',
        memory: this.memory.getHistory(),
        tools: this.tools,
        taskContext: this.memory.getTaskContext(),
        userProfile: context.userProfile,
        dateScope: context.dateScope,
        userId: context.userId
      })
      
      // ========== 步骤 2: 调用 LLM ==========
      console.log('🧠 调用 LLM...')
      let llmResponse
      try {
        const result = await doubaoService.sendMessage(prompt)
        if (!result.success || !result.message) {
          throw new Error(result.error || 'LLM 调用失败')
        }
        llmResponse = result.message
        console.log(`📝 LLM 输出长度: ${llmResponse.length} 字符`)
      } catch (error: any) {
        console.error(`❌ LLM 调用失败: ${error.message}`)
        return {
          type: 'error',
          content: `AI 服务暂时不可用，请稍后再试。\n错误: ${error.message}`,
          metadata: {
            iterations: iteration + 1,
            error: error
          }
        }
      }
      
      // ========== 步骤 3: 解析 LLM 输出 ==========
      console.log('🔍 解析 LLM 输出...')
      let parsed
      try {
        parsed = parseReActOutput(llmResponse)
      } catch (error: any) {
        console.error(`❌ 解析失败: ${error.message}`)
        
        // 解析失败，返回错误
        return {
          type: 'error',
          content: `抱歉，我的回复格式有误。请换个方式问我。\n技术细节: ${error.message}`,
          metadata: {
            iterations: iteration + 1,
            error: error
          }
        }
      }
      
      // 记录 Thought
      thoughts.push(parsed.thought)
      this.memory.addThought(parsed.thought)
      console.log(`💭 Thought: "${parsed.thought.substring(0, 60)}..."`)
      
      // ========== 步骤 4: 处理 Response 或 Action ==========
      if (parsed.type === 'response') {
        // Agent 决定直接回复用户
        console.log('✅ Agent 决定直接回复用户')
        
        // 记录到 Memory
        this.memory.addMessage({
          role: 'assistant',
          content: parsed.response
        })
        
        return {
          type: 'text',
          content: parsed.response,
          metadata: {
            iterations: iteration + 1,
            thoughts: thoughts,
            usedTools: usedTools
          }
        }
      } else {
        // Agent 决定调用工具
        const { action, actionInput } = parsed
        console.log(`🔧 Agent 决定调用工具: ${action}`)
        
        // 查找工具
        const tool = getTool(action)
        if (!tool) {
          console.error(`❌ 工具未找到: ${action}`)
          
          // 记录错误观察，让 Agent 重新推理
          const observation = `错误：工具 ${action} 不存在。可用工具列表: ${this.tools.map(t => t.name).join(', ')}`
          this.memory.addMessage({
            role: 'assistant',
            content: `Observation: ${observation}`
          })
          
          // 继续下一次迭代
          continue
        }
        
        // 验证参数
        const validation = validateActionInput(tool.name, actionInput, tool.parameters)
        if (!validation.valid) {
          console.error(`❌ 参数验证失败: ${validation.errors.join(', ')}`)
          
          // 记录错误观察
          const observation = `参数验证失败: ${validation.errors.join(', ')}`
          this.memory.addMessage({
            role: 'assistant',
            content: `Observation: ${observation}`
          })
          
          // 继续下一次迭代
          continue
        }
        
        // 执行工具
        console.log(`🔧 执行工具: ${tool.name}`)
        usedTools.push(tool.name)
        
        let toolResult
        try {
          toolResult = await tool.execute(actionInput)
        } catch (error: any) {
          console.error(`❌ 工具执行错误: ${error.message}`)
          toolResult = {
            type: 'error' as const,
            message: `工具执行失败: ${error.message}`
          }
        }
        
        // 处理工具结果
        if (toolResult.type === 'need_input') {
          // 工具需要用户输入，暂停 Agent
          console.log('⏸️ 工具需要用户输入，暂停 Agent')
          
          // 保存暂停状态
          this.pendingToolName = tool.name
          this.pendingToolInput = actionInput
          this.pendingContext = context
          
          return {
            type: 'need_user_input',
            prompt: toolResult.prompt,
            context: toolResult.context,
            metadata: {
              iterations: iteration + 1,
              pendingTool: tool.name,
              toolInput: actionInput
            }
          }
        } else if (toolResult.type === 'error') {
          // 工具执行失败
          console.error(`❌ 工具执行失败: ${toolResult.message}`)
          
          // 记录错误观察
          const observation = `工具 ${tool.name} 执行失败: ${toolResult.message}`
          this.memory.addMessage({
            role: 'assistant',
            content: `Observation: ${observation}`
          })
          
          // 继续下一次迭代，让 Agent 重新推理
          continue
        } else {
          // 工具执行成功
          console.log(`✅ 工具执行成功`)
          
          // 记录观察
          const observation = `工具 ${tool.name} 执行成功。\n结果: ${JSON.stringify(toolResult.data, null, 2)}`
          this.memory.addMessage({
            role: 'assistant',
            content: `Observation: ${observation}`
          })
          
          // 继续下一次迭代
          continue
        }
      }
    }
    
    // ========== 达到最大迭代次数 ==========
    console.log('⚠️ 达到最大迭代次数')
    
    return {
      type: 'error',
      content: `抱歉，我思考的时间有点长了（已进行 ${this.maxIterations} 轮推理）。\n\n请尝试：\n- 简化你的问题\n- 分步骤提问\n- 或者切换到「普通模式」`,
      metadata: {
        iterations: this.maxIterations,
        thoughts: thoughts,
        usedTools: usedTools
      }
    }
  }
}



