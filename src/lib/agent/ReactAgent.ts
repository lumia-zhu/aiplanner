/**
 * ReAct Agent 核心实现
 * 
 * 实现完整的 ReAct（Reasoning + Acting）循环
 */

import type { AgentContext, AgentResponse, AgentTool } from './AgentTypes'
import { AgentMemory } from './AgentMemory'
import { getAllTools } from './tools'
import { buildReActPrompt, parseReActOutput } from './AgentPrompt'
import { DoubaoService } from '@/lib/doubaoService'
import { DEFAULT_AGENT_CONFIG } from './AgentConfig'

export class ReactAgent {
  private memory: AgentMemory
  private tools: AgentTool[]
  private llm: DoubaoService
  private maxIterations: number

  constructor() {
    console.log('✅ ReactAgent 初始化')
    this.memory = new AgentMemory()
    this.tools = getAllTools()
    this.llm = new DoubaoService()
    this.maxIterations = DEFAULT_AGENT_CONFIG.maxIterations
  }

  /**
   * 获取工具
   */
  private getTool(name: string): AgentTool | undefined {
    return this.tools.find(t => t.name === name)
  }

  /**
   * 智能修正批量操作工具的参数
   * 
   * 修正场景：
   * - searchKeyword="所有任务" → 删除 searchKeyword
   * - searchKeyword="全部任务" → 删除 searchKeyword
   * - searchKeyword="所有的任务" → 删除 searchKeyword
   */
  private correctBatchOperationParams(toolName: string, params: any): any {
    console.log(`🔍 [智能修正] 工具: ${toolName}`)
    console.log(`🔍 [智能修正] 原始参数:`, JSON.stringify(params, null, 2))
    
    const batchTools = ['delete_recurring_tasks', 'update_recurring_tasks']
    
    if (!batchTools.includes(toolName)) {
      console.log(`🔍 [智能修正] 不是批量操作工具，跳过修正`)
      return params
    }

    const keyword = params.searchKeyword?.trim()
    console.log(`🔍 [智能修正] searchKeyword="${keyword}"`)
    
    // 检测常见的"所有任务"表述
    const allTasksPatterns = [
      '所有任务',
      '全部任务',
      '所有的任务',
      '全部的任务',
      '所有',
      '全部',
    ]
    
    if (keyword && allTasksPatterns.includes(keyword)) {
      console.warn(`🚨 [智能修正] 检测到错误的 searchKeyword="${keyword}"，自动删除此参数！`)
      const { searchKeyword, ...rest } = params
      console.log(`✅ [智能修正] 修正后参数:`, JSON.stringify(rest, null, 2))
      return rest  // 返回不包含 searchKeyword 的对象
    }
    
    console.log(`🔍 [智能修正] searchKeyword 正常，无需修正`)
    return params
  }

  /**
   * 运行 Agent（主入口）
   */
  async run(message: string, context: AgentContext): Promise<AgentResponse> {
    console.log('\n🤖 ========== ReactAgent 开始运行 ==========')
    console.log(`用户消息: "${message}"`)
    console.log(`用户ID: ${context.userId}`)
    console.log(`最大迭代次数: ${this.maxIterations}`)

    // ✅ 清空本次推理的思考和步骤（保留对话历史作为上下文）
    this.memory.clearCurrentRun()

    // 1. 添加用户消息到记忆
    this.memory.addMessage({ role: 'user', content: message })

    // 2. 如果没有提供 taskContext，自动加载
    let taskContext = context.taskContext
    if (!taskContext) {
      console.log('📥 自动加载任务上下文...')
      await this.memory.ensureTaskContext(context.userId)
      taskContext = this.memory.getTaskContext()
    }

    // 3. 开始 ReAct 循环
    let iteration = 0

    while (iteration < this.maxIterations) {
      iteration++
      console.log(`\n🔄 第 ${iteration}/${this.maxIterations} 轮迭代`)

      try {
        // 3.1 构建 Prompt
        // ⚠️ 重要：第一次迭代传入用户消息，后续迭代传入 undefined 让 LLM 看到 Observation
        const prompt = buildReActPrompt({
          userMessage: iteration === 1 ? message : undefined,
          memory: this.memory.getHistory(),
          tools: this.tools,
          taskContext: taskContext || null,
          userProfile: context.userProfile || null,
          dateScope: context.dateScope,
          userId: context.userId,
        })
        
        // ⭐ 输出当前记忆状态（用于调试）
        const memoryHistory = this.memory.getHistory()
        console.log(`📚 当前记忆历史 (${memoryHistory.length} 条):`)
        memoryHistory.forEach((item, idx) => {
          console.log(`  [${idx}] ${item.role}: ${item.content.substring(0, 100)}...`)
        })
        
        // ⭐ 如果是后续迭代，输出最后一次的 Observation
        if (iteration > 1) {
          const steps = this.memory.getSteps()
          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1]
            console.log(`🔍 上一轮工具执行结果:`)
            console.log(`   工具: ${lastStep.action}`)
            console.log(`   结果:`, JSON.stringify(lastStep.observation, null, 2))
          }
        }

        // 3.2 调用 LLM
        console.log('💭 调用 LLM...')
        const llmResult = await this.llm.sendMessage(prompt)
        if (!llmResult.success || !llmResult.message) {
          throw new Error(llmResult.error || 'LLM 调用失败')
        }
        const llmResponse = llmResult.message
        console.log(`📝 LLM 输出 (前200字):`, llmResponse.substring(0, 200))
        console.log(`📝 LLM 完整输出:`, llmResponse)  // ⭐ 添加完整输出日志

        // 3.3 解析输出（带兜底处理）
        let parsed
        try {
          parsed = parseReActOutput(llmResponse)
          console.log('📊 解析结果:', parsed.type)
          console.log('📊 解析详情:', JSON.stringify(parsed, null, 2))  // ⭐ 添加详细解析结果
        } catch (parseError: any) {
          console.error('❌ 解析失败，使用兜底响应:', parseError.message)
          // 🛡️ 兜底：将 LLM 输出作为普通文本返回
          return {
            type: 'text',
            content: llmResponse || '抱歉，我在处理您的请求时遇到了一些问题。请尝试重新表述您的问题。',
            metadata: {
              iteration,
              thoughts: this.memory.getThoughts(),
              steps: this.memory.getSteps(),
              error: parseError.message
            }
          }
        }

        // 3.4 记录 Thought
        if (parsed.type !== 'error' && parsed.thought) {
          this.memory.addThought(parsed.thought)
        }

        // 3.5 处理不同类型的输出
        if (parsed.type === 'response') {
          // 直接回复用户
          console.log('✅ Agent 决定直接回复')
          this.memory.addMessage({ role: 'assistant', content: parsed.response || '' })
          
          return {
            type: 'text',
            content: parsed.response || '',
            metadata: {
              iteration,
              thoughts: this.memory.getThoughts(),
              steps: this.memory.getSteps()
            }
          }
        }

        if (parsed.type === 'action') {
          // 调用工具
          console.log(`🔧 调用工具: ${parsed.action}`)
          console.log(`📥 工具输入:`, JSON.stringify(parsed.actionInput, null, 2))

          const tool = this.getTool(parsed.action!)
          if (!tool) {
            console.error(`❌ 工具不存在: ${parsed.action}`)
            this.memory.addStep({
              action: parsed.action!,
              input: parsed.actionInput,
              observation: { error: `工具 "${parsed.action}" 不存在` }
            })
            continue
          }

          // ⭐ 智能修正：批量操作工具的 searchKeyword 参数
          const correctedInput = this.correctBatchOperationParams(parsed.action!, parsed.actionInput)
          if (correctedInput !== parsed.actionInput) {
            console.log(`🔧 参数自动修正:`, JSON.stringify(correctedInput, null, 2))
          }

          // 执行工具
          const toolResult = await tool.execute(correctedInput)
          console.log('📤 工具结果:', toolResult.type)

          // 处理工具结果
          if (toolResult.type === 'need_input') {
            // 工具需要用户输入，暂停 ReAct 循环
            console.log('⏸️  工具需要用户输入，暂停 Agent')
            return {
              type: 'need_input',
              content: toolResult.message,
              metadata: {
                iteration,
                pendingTool: parsed.action,
                toolInput: parsed.actionInput,
                thoughts: this.memory.getThoughts(),
                context: toolResult.data
              }
            }
          }

          if (toolResult.type === 'error') {
            console.error('❌ 工具执行失败:', toolResult.message)
            this.memory.addStep({
              action: parsed.action!,
              input: parsed.actionInput,
              observation: { error: toolResult.message }
            })
            // 继续循环，让 Agent 看到错误后决定如何处理
            continue
          }

          if (toolResult.type === 'success') {
            console.log('✅ 工具执行成功')
            this.memory.addStep({
              action: parsed.action!,
              input: parsed.actionInput,
              observation: toolResult.data || { message: toolResult.message }
            })
            
            // ⭐ 对于明确的操作类工具（创建/更新/删除），成功后立即返回，不再让 LLM 思考
            const immediateReturnTools = [
              'create_task',
              'update_task', 
              'delete_task',
              'create_recurring_tasks',
              'update_recurring_tasks',
              'delete_recurring_tasks',
            ]
            
            if (immediateReturnTools.includes(parsed.action!)) {
              console.log(`🎯 ${parsed.action} 执行成功，立即返回结果（跳过后续迭代）`)
              return {
                type: 'text',
                content: toolResult.message || '✅ 操作已成功完成！',
                metadata: {
                  iteration,
                  thoughts: this.memory.getThoughts(),
                  steps: this.memory.getSteps(),
                  stopReason: 'immediate_return_after_action',
                }
              }
            }
            
            // 🚨 防止重复操作：检查最近3次是否都是相同的工具调用
            const recentSteps = this.memory.getSteps().slice(-3)
            if (recentSteps.length >= 3 && 
                recentSteps.every(s => s.action === parsed.action && 
                                     JSON.stringify(s.input) === JSON.stringify(parsed.actionInput))) {
              console.warn('⚠️ 检测到重复操作（连续3次相同调用），强制返回结果')
              return {
                type: 'text',
                content: toolResult.message || '✅ 任务已完成！',
                metadata: {
                  iteration,
                  thoughts: this.memory.getThoughts(),
                  steps: this.memory.getSteps(),
                  stopReason: 'duplicate_action_detected',
                },
              }
            }
            
            // 继续循环，让 Agent 看到结果后决定下一步
            continue
          }
        }

        if (parsed.type === 'error') {
          console.error('❌ LLM 输出解析失败:', parsed.error)
          // 继续循环，给 Agent 一次机会纠正
          continue
        }

      } catch (error) {
        console.error(`❌ 第 ${iteration} 轮迭代出错:`, error)
        return {
          type: 'error',
          content: `Agent 执行出错: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error.message : String(error),
          iteration
        }
      }
    }

    // 达到最大迭代次数
    console.log('⚠️ 达到最大迭代次数')
    return {
      type: 'error',
      content: '思考时间过长，请简化您的请求或稍后再试',
      error: '达到最大迭代次数',
      iteration: this.maxIterations,
      metadata: {
        iteration: this.maxIterations,
        thoughts: this.memory.getThoughts(),
        steps: this.memory.getSteps()
      }
    }
  }

  /**
   * 恢复被中断的流程（用户提供输入后）
   */
  async resume(userInput: string, context: any): Promise<AgentResponse> {
    console.log('🔄 ReactAgent.resume() 被调用')
    console.log('用户输入:', userInput)
    
    // 添加用户输入到记忆
    this.memory.addMessage({ role: 'user', content: userInput })
    
    // TODO: 实现恢复逻辑，继续之前被中断的流程
    
    return {
      type: 'error',
      content: '🚧 Agent 恢复功能正在开发中'
    }
  }
}
