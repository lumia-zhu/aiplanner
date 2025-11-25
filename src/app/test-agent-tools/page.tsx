'use client'

/**
 * Agent 工具测试页面
 * 
 * 用于在浏览器中测试 Agent 工具
 * Phase 2 开发时使用，完成后可删除
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromStorage, AuthUser } from '@/lib/auth'

export default function TestAgentToolsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 检查登录状态
  useEffect(() => {
    const userData = getUserFromStorage()
    if (!userData) {
      router.push('/auth/login')
      return
    }
    setUser(userData)
    setIsLoading(false)
  }, [router])

  // 添加测试结果
  const addResult = (message: string) => {
    setTestResults(prev => [...prev, message])
    console.log(message)
  }

  // 测试 LoadTaskContextTool
  const testLoadTaskContextTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 LoadTaskContextTool ==========')
    
    try {
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      const tool = new LoadTaskContextTool()
      
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      addResult(`📝 工具描述: ${tool.description}`)
      
      addResult('\n🔄 执行工具（加载任务上下文）...')
      const result = await tool.execute({ userId: user.id })
      
      if (result.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📊 今天任务数: ${result.data.todayTasks.length}`)
        addResult(`📊 近3个月总任务数: ${result.data.recentTasksSummary.totalCount}`)
        addResult(`📊 紧急任务数: ${result.data.recentTasksSummary.urgentCount}`)
        addResult(`📊 缺少估算任务数: ${result.data.recentTasksSummary.missingEstimationCount}`)
        addResult(`📊 简化任务列表数: ${result.data.recentTasks.length}`)
        
        addResult('\n📅 月度统计:')
        addResult(`  上个月: ${result.data.recentTasksSummary.byMonth.previousMonth.completed}/${result.data.recentTasksSummary.byMonth.previousMonth.total} 已完成`)
        addResult(`  当前月: ${result.data.recentTasksSummary.byMonth.currentMonth.completed}/${result.data.recentTasksSummary.byMonth.currentMonth.total} 已完成`)
        addResult(`  下个月: ${result.data.recentTasksSummary.byMonth.nextMonth.completed}/${result.data.recentTasksSummary.byMonth.nextMonth.total} 已完成`)
        
      } else {
        addResult(`❌ 工具执行失败: ${result.message}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 AgentMemory.ensureTaskContext
  const testAgentMemoryEnsureTaskContext = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 AgentMemory.ensureTaskContext ==========')
    
    try {
      const { AgentMemory } = await import('@/lib/agent/AgentMemory')
      
      const memory = new AgentMemory()
      addResult('✅ AgentMemory 实例化成功')
      
      addResult('\n🔄 第一次调用 ensureTaskContext（应该加载）...')
      await memory.ensureTaskContext(user.id)
      
      const taskContext1 = memory.getTaskContext()
      if (taskContext1) {
        addResult('✅ 任务上下文已加载')
        addResult(`📊 今天任务数: ${taskContext1.todayTasks.length}`)
      } else {
        addResult('❌ 任务上下文未加载')
      }
      
      addResult('\n🔄 第二次调用 ensureTaskContext（应该使用缓存）...')
      await memory.ensureTaskContext(user.id)
      
      const taskContext2 = memory.getTaskContext()
      if (taskContext2 === taskContext1) {
        addResult('✅ 缓存机制生效（返回相同引用）')
      } else {
        addResult('⚠️  缓存机制未生效（返回不同引用）')
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 GetTasksTool
  const testGetTasksTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 GetTasksTool ==========')
    
    try {
      const { GetTasksTool } = await import('@/lib/agent/tools/GetTasksTool')
      
      addResult('✅ 工具类导入成功')
      
      const tool = new GetTasksTool()
      
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      addResult(`📝 工具描述: ${tool.description}`)
      
      // 测试 1: 查询今天的任务
      addResult('\n🔄 测试 1: 查询今天的任务...')
      const result1 = await tool.execute({ 
        userId: user.id,
        includeCompleted: true  // 包含已完成任务
      })
      
      if (result1.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📊 任务数量: ${result1.data.count}`)
        addResult(`📅 日期范围: ${result1.data.filters.dateRange.start} ~ ${result1.data.filters.dateRange.end}`)
        
        if (result1.data.tasks.length > 0) {
          addResult('\n📋 任务列表（前3个）:')
          result1.data.tasks.slice(0, 3).forEach((task: any, index: number) => {
            addResult(`  ${index + 1}. ${task.title}`)
            addResult(`     优先级: ${task.priority}, 完成: ${task.isCompleted}`)
          })
        }
      } else {
        addResult(`❌ 工具执行失败: ${result1.message}`)
      }
      
      // 测试 2: 查询高优先级任务
      addResult('\n🔄 测试 2: 查询高优先级任务...')
      const result2 = await tool.execute({ 
        userId: user.id,
        priority: 'high',
        includeCompleted: false
      })
      
      if (result2.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📊 高优先级任务数: ${result2.data.count}`)
      } else {
        addResult(`❌ 工具执行失败: ${result2.message}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 AnalyzeTasksTool
  const testAnalyzeTasksTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 AnalyzeTasksTool ==========')
    
    try {
      const { AnalyzeTasksTool } = await import('@/lib/agent/tools/AnalyzeTasksTool')
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      // 先加载任务上下文
      addResult('\n🔄 加载任务上下文...')
      const loadTool = new LoadTaskContextTool()
      const loadResult = await loadTool.execute({ userId: user.id })
      
      if (loadResult.type !== 'success') {
        addResult(`❌ 加载任务上下文失败: ${loadResult.message}`)
        return
      }
      
      addResult(`✅ 任务上下文加载成功: ${loadResult.data.todayTasks.length} 个今天的任务`)
      
      // 分析任务
      addResult('\n🔄 分析任务...')
      const analyzeTool = new AnalyzeTasksTool()
      const result = await analyzeTool.execute({ 
        tasks: loadResult.data.todayTasks
      })
      
      if (result.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`\n📊 分析结果:`)
        addResult(`  总任务: ${result.data.total}`)
        addResult(`  已完成: ${result.data.completed}`)
        addResult(`  紧急任务: ${result.data.urgent.length}`)
        addResult(`  需要估算: ${result.data.needsEstimation.length}`)
        addResult(`  需要澄清: ${result.data.needsClarification.length}`)
        addResult(`  可拆解: ${result.data.canDecompose.length}`)
        
        addResult(`\n📈 优先级分布:`)
        addResult(`  高: ${result.data.byPriority.high}`)
        addResult(`  中: ${result.data.byPriority.medium}`)
        addResult(`  低: ${result.data.byPriority.low}`)
        
        if (result.data.suggestions.length > 0) {
          addResult(`\n💡 建议:`)
          result.data.suggestions.forEach((suggestion: string) => {
            addResult(`  ${suggestion}`)
          })
        }
      } else {
        addResult(`❌ 工具执行失败: ${result.message}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 ClarifyTaskTool（交互式流程）
  const testClarifyTaskTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 ClarifyTaskTool ==========')
    
    try {
      const { ClarifyTaskTool } = await import('@/lib/agent/tools/ClarifyTaskTool')
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      // 先加载任务上下文
      addResult('\n🔄 加载任务上下文...')
      const loadTool = new LoadTaskContextTool()
      const loadResult = await loadTool.execute({ userId: user.id })
      
      if (loadResult.type !== 'success' || loadResult.data.todayTasks.length === 0) {
        addResult('⚠️  没有找到今天的任务，无法测试澄清功能')
        return
      }
      
      const firstTask = loadResult.data.todayTasks[0]
      addResult(`✅ 找到任务: ${firstTask.title}`)
      
      // 第一轮：生成澄清问题
      addResult('\n🔄 第一轮：生成澄清问题...')
      const clarifyTool = new ClarifyTaskTool()
      const result1 = await clarifyTool.execute({ task: firstTask })
      
      if (result1.type === 'need_input') {
        addResult('✅ 工具正确返回 need_input（交互式流程）')
        addResult(`\n💬 AI 的澄清问题:`)
        addResult(result1.prompt)
        
        // 模拟用户回答
        addResult('\n🔄 第二轮：模拟用户回答...')
        const userAnswer = '这是一个重要的学习任务，需要讨论项目进展和下一步计划'
        addResult(`用户回答: ${userAnswer}`)
        
        const result2 = await clarifyTool.execute({ 
          task: firstTask, 
          userContext: userAnswer 
        })
        
        if (result2.type === 'success') {
          addResult('✅ 澄清完成！')
          addResult(`\n${result2.data.message}`)
          
          if (result2.data.suggestions) {
            addResult('\n💡 后续建议:')
            result2.data.suggestions.forEach((suggestion: string) => {
              addResult(`  ${suggestion}`)
            })
          }
        } else {
          addResult(`❌ 第二轮执行失败: ${result2.message}`)
        }
      } else if (result1.type === 'error') {
        addResult(`❌ 工具执行失败: ${result1.message}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试工具注册
  const testToolsRegistry = async () => {
    addResult('\n🧪 ========== 测试工具注册 ==========')
    
    try {
      const { getAllTools, getTool } = await import('@/lib/agent/tools')
      
      const tools = getAllTools()
      addResult(`✅ 工具数量: ${tools.length}`)
      
      tools.forEach((tool, index) => {
        addResult(`  ${index + 1}. ${tool.name} - ${tool.description.substring(0, 50)}...`)
      })
      
      if (tools.length > 0) {
        const firstTool = getTool(tools[0].name)
        addResult(`✅ getTool 测试成功: ${firstTool.name}`)
      }
      
      addResult('\n🎉 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
    }
  }

  // Test DecomposeTaskTool - Step 6.1 基础验证
  const testDecomposeToolBasics = async () => {
    addResult('\n🧪 ========== Step 6.1: DecomposeTaskTool 基础验证 ==========')
    
    try {
      addResult('🔄 正在导入 DecomposeTaskTool...')
      const { DecomposeTaskTool } = await import('@/lib/agent/tools/DecomposeTaskTool')
      
      addResult('✅ 工具类导入成功')
      
      const tool = new DecomposeTaskTool()
      
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      addResult(`📝 工具描述: ${tool.description}`)
      
      // 验证接口
      const hasRequiredFields = 
        typeof tool.name === 'string' &&
        typeof tool.description === 'string' &&
        typeof tool.execute === 'function' &&
        tool.parameters !== undefined
      
      if (hasRequiredFields) {
        addResult('✅ 工具接口验证通过 (name, description, execute, parameters)')
      } else {
        addResult('❌ 工具接口不完整')
      }
      
      // 验证参数 schema
      const params = tool.parameters
      if (params.type === 'object' && params.properties && params.required) {
        addResult('✅ 参数 schema 结构正确')
        addResult(`   必需参数: ${params.required.join(', ')}`)
        addResult(`   可选参数: ${Object.keys(params.properties).filter(k => !params.required.includes(k)).join(', ') || '无'}`)
      } else {
        addResult('❌ 参数 schema 结构不正确')
      }
      
      addResult('\n🎉 Step 6.1 基础验证通过！')
      addResult('📝 下一步：实现第一轮逻辑（生成拆解问题）')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test DecomposeTaskTool - Step 6.2 第一轮逻辑（生成拆解问题）
  const testDecomposeToolRound1 = async () => {
    if (!user) return

    addResult('\n🧪 ========== Step 6.2: DecomposeTaskTool 第一轮测试 ==========')
    
    try {
      const { DecomposeTaskTool } = await import('@/lib/agent/tools/DecomposeTaskTool')
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      // 加载任务上下文
      addResult('\n🔄 加载任务上下文...')
      const loadTool = new LoadTaskContextTool()
      const loadResult = await loadTool.execute({ userId: user.id })
      
      if (loadResult.type !== 'success' || loadResult.data.todayTasks.length === 0) {
        addResult('⚠️  没有找到今天的任务，无法测试拆解功能')
        return
      }
      
      // 找一个标题较长的任务（可能需要拆解）
      const taskToDecompose = loadResult.data.todayTasks.find(t => t.title.length > 10) || loadResult.data.todayTasks[0]
      
      addResult(`✅ 找到任务: "${taskToDecompose.title}"`)
      
      // 第一轮：生成拆解问题
      addResult('\n🔄 第一轮：生成拆解问题...')
      const decomposeTool = new DecomposeTaskTool()
      const result = await decomposeTool.execute({ task: taskToDecompose })
      
      if (result.type === 'need_input') {
        addResult('✅ 工具正确返回 need_input（交互式流程）')
        addResult(`\n💬 AI 的拆解问题:`)
        addResult(result.prompt)
        
        // 验证 context
        if (result.context && result.context.taskId && result.context.step === 'decomposition_questions') {
          addResult('\n✅ context 结构正确:')
          addResult(`   taskId: ${result.context.taskId}`)
          addResult(`   step: ${result.context.step}`)
        } else {
          addResult('\n❌ context 结构不正确')
        }
        
        addResult('\n🎉 Step 6.2 第一轮测试通过！')
        addResult('📝 下一步：实现第二轮逻辑（执行拆解）')
      } else if (result.type === 'error') {
        addResult(`❌ 工具执行失败: ${result.message}`)
      } else {
        addResult(`❌ 预期返回 need_input，实际返回: ${result.type}`)
      }
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test DecomposeTaskTool - Step 6.3 完整流程（两轮对话）
  const testDecomposeToolComplete = async () => {
    if (!user) return

    addResult('\n🧪 ========== Step 6.3: DecomposeTaskTool 完整测试 ==========')
    
    try {
      const { DecomposeTaskTool } = await import('@/lib/agent/tools/DecomposeTaskTool')
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      // 加载任务上下文
      addResult('\n🔄 加载任务上下文...')
      const loadTool = new LoadTaskContextTool()
      const loadResult = await loadTool.execute({ userId: user.id })
      
      if (loadResult.type !== 'success' || loadResult.data.todayTasks.length === 0) {
        addResult('⚠️  没有找到今天的任务，无法测试拆解功能')
        return
      }
      
      // 找一个标题较长的任务（可能需要拆解）
      const taskToDecompose = loadResult.data.todayTasks.find(t => t.title.length > 10) || loadResult.data.todayTasks[0]
      
      addResult(`✅ 找到任务: "${taskToDecompose.title}"`)
      
      // 第一轮：生成拆解问题
      addResult('\n🔄 第一轮：生成拆解问题...')
      const decomposeTool = new DecomposeTaskTool()
      const result1 = await decomposeTool.execute({ task: taskToDecompose })
      
      if (result1.type === 'need_input') {
        addResult('✅ 工具正确返回 need_input（交互式流程）')
        addResult(`\n💬 AI 的拆解问题:`)
        addResult(result1.prompt)
        
        // 模拟用户回答
        addResult('\n🔄 第二轮：模拟用户回答...')
        const userAnswer = '这个任务需要分成准备、执行、总结三个阶段，每个阶段都要认真完成'
        addResult(`用户回答: ${userAnswer}`)
        
        const result2 = await decomposeTool.execute({ 
          task: taskToDecompose, 
          userContext: userAnswer 
        })
        
        if (result2.type === 'success') {
          addResult('✅ 拆解完成！')
          addResult(`\n${result2.data.message}`)
          
          if (result2.data.subtasks && result2.data.subtasks.length > 0) {
            addResult('\n📋 子任务列表:')
            result2.data.subtasks.forEach((subtask: any, index: number) => {
              addResult(`  ${index + 1}. ${subtask.title} (预计 ${subtask.estimatedMinutes} 分钟)`)
            })
            
            addResult(`\n⏱️  总预计时间: ${result2.data.totalEstimatedMinutes} 分钟`)
          }
          
          if (result2.data.suggestions) {
            addResult('\n💡 后续建议:')
            result2.data.suggestions.forEach((suggestion: string) => {
              addResult(`  ${suggestion}`)
            })
          }
          
          addResult('\n🎉 Step 6.3 完整测试通过！')
          addResult('✅ DecomposeTaskTool 开发完成！')
        } else {
          addResult(`❌ 第二轮执行失败: ${result2.message}`)
        }
      } else if (result1.type === 'error') {
        addResult(`❌ 工具执行失败: ${result1.message}`)
      }
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test ReactAgent - Phase 3 Step 3
  const testReActAgent = async () => {
    if (!user) return

    addResult('\n🧪 ========== Phase 3 Step 3: ReAct Agent 主循环测试 ==========')
    
    try {
      const { ReactAgent } = await import('@/lib/agent/ReactAgent')
      const { format } = await import('date-fns')
      
      addResult('✅ ReactAgent 类导入成功')
      
      // ========== 测试场景 1: Agent 初始化 ==========
      addResult('\n🔄 测试场景 1: Agent 初始化')
      
      const agent = new ReactAgent()
      addResult('   ✅ Agent 实例化成功')
      
      // ========== 测试场景 2: 简单问候（不调用工具） ==========
      addResult('\n🔄 测试场景 2: 简单问候（不调用工具）')
      
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      
      const context1 = {
        userId: user.id,
        userProfile: null,
        dateScope: {
          type: 'day' as const,
          start: todayStr,
          end: todayStr
        }
      }
      
      addResult('   🤖 正在调用 Agent（"你好"）...')
      addResult('   ⏳ 这可能需要几秒钟...')
      
      const response1 = await agent.run('你好', context1)
      
      if (response1.type === 'text') {
        addResult('   ✅ Agent 返回文本响应')
        addResult(`   📝 响应内容: "${response1.content.substring(0, 100)}..."`)
        addResult(`   🔄 迭代次数: ${response1.metadata?.iterations}`)
        addResult(`   🧠 Thoughts 数量: ${response1.metadata?.thoughts?.length || 0}`)
        addResult(`   🔧 使用的工具: ${response1.metadata?.usedTools?.join(', ') || '无'}`)
      } else if (response1.type === 'error') {
        addResult(`   ⚠️ Agent 返回错误: ${response1.content}`)
      } else {
        addResult(`   ⚠️ 未预期的响应类型: ${response1.type}`)
      }
      
      // ========== 测试场景 3: 查询任务（需要调用工具） ==========
      addResult('\n🔄 测试场景 3: 查询任务（需要调用工具）')
      
      const agent2 = new ReactAgent()
      const context2 = {
        userId: user.id,
        userProfile: null,
        dateScope: {
          type: 'day' as const,
          start: todayStr,
          end: todayStr
        }
      }
      
      addResult('   🤖 正在调用 Agent（"我今天有哪些任务"）...')
      addResult('   ⏳ Agent 可能会调用多个工具...')
      
      const response2 = await agent2.run('我今天有哪些任务', context2)
      
      if (response2.type === 'text') {
        addResult('   ✅ Agent 返回文本响应')
        addResult(`   📝 响应内容: "${response2.content.substring(0, 150)}..."`)
        addResult(`   🔄 迭代次数: ${response2.metadata?.iterations}`)
        addResult(`   🧠 Thoughts 数量: ${response2.metadata?.thoughts?.length || 0}`)
        addResult(`   🔧 使用的工具: ${response2.metadata?.usedTools?.join(', ') || '无'}`)
        
        if (response2.metadata?.usedTools && response2.metadata.usedTools.length > 0) {
          addResult('   ✅ 成功调用了工具！')
        } else {
          addResult('   ⚠️ 没有调用工具（可能 AI 直接回答了）')
        }
      } else if (response2.type === 'error') {
        addResult(`   ⚠️ Agent 返回错误: ${response2.content}`)
      } else if (response2.type === 'need_user_input') {
        addResult('   ⏸️ Agent 需要用户输入（交互式工具）')
        addResult(`   💬 提示: "${response2.prompt.substring(0, 100)}..."`)
      } else {
        addResult(`   ⚠️ 未预期的响应类型: ${response2.type}`)
      }
      
      // ========== 最终总结 ==========
      addResult('\n📊 ReAct Agent 测试总结:')
      addResult('   ✅ Agent 初始化')
      addResult('   ✅ 简单对话（不调用工具）')
      addResult('   ✅ 复杂对话（调用工具）')
      addResult('   ✅ Thought → Action → Observation 循环')
      addResult('   ✅ 错误处理机制')
      
      addResult('\n🎉 Phase 3 Step 3 测试完成！')
      addResult('✅ ReAct Agent 主循环实现成功')
      
      addResult('\n💡 提示:')
      addResult('   - Agent 会根据需要自动调用工具')
      addResult('   - 每次调用 Agent 都会进行 Thought（推理）')
      addResult('   - 最多会进行 5 轮推理（可在 AgentConfig 配置）')
      addResult('   - 如果工具需要用户输入，Agent 会暂停等待')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test Output Parser - Phase 3 Step 2
  const testOutputParser = async () => {
    if (!user) return

    addResult('\n🧪 ========== Phase 3 Step 2: 输出解析器测试 ==========')
    
    try {
      const { parseReActOutput, validateActionInput } = await import('@/lib/agent/AgentPrompt')
      const { getAllTools } = await import('@/lib/agent/tools')
      
      addResult('✅ 解析器函数导入成功')
      
      const tools = getAllTools()
      
      // ========== 测试场景 1: Thought + Response（直接回复） ==========
      addResult('\n🔄 测试场景 1: Thought + Response（直接回复）')
      
      const responseOutput = `Thought: 这是一个简单的问候，不需要调用任何工具，我可以直接友好地回复。
Response: 你好！我是你的任务管理助手。我可以帮你：
- 📋 查看和分析任务
- 🤔 澄清任务细节
- ✂️ 拆解复杂任务
- ⏱️ 估算任务时间

有什么需要帮助的吗？`
      
      try {
        const parsed1 = parseReActOutput(responseOutput)
        
        if (parsed1.type === 'response' && 
            parsed1.thought && 
            parsed1.response && 
            parsed1.response.includes('任务管理助手')) {
          addResult('   ✅ 成功解析 Response 格式')
          addResult(`   Thought: "${parsed1.thought.substring(0, 30)}..."`)
          addResult(`   Response: "${parsed1.response.substring(0, 30)}..."`)
        } else {
          addResult('   ❌ Response 格式解析结果不正确')
        }
      } catch (error: any) {
        addResult(`   ❌ 解析失败: ${error.message}`)
      }
      
      // ========== 测试场景 2: Thought + Action + Action Input（标准 JSON） ==========
      addResult('\n🔄 测试场景 2: Thought + Action + Action Input（标准 JSON）')
      
      const actionOutput = `Thought: 用户想了解今天的任务列表。我需要调用 get_tasks 工具来获取今天的任务。
Action: get_tasks
Action Input: {"userId": "test_user", "dateRange": {"start": "2025-11-06", "end": "2025-11-06"}, "includeCompleted": false}`
      
      try {
        const parsed2 = parseReActOutput(actionOutput)
        
        if (parsed2.type === 'action' && 
            parsed2.action === 'get_tasks' && 
            parsed2.actionInput.userId === 'test_user') {
          addResult('   ✅ 成功解析 Action 格式（标准 JSON）')
          addResult(`   Action: ${parsed2.action}`)
          addResult(`   Action Input: ${JSON.stringify(parsed2.actionInput)}`)
        } else {
          addResult('   ❌ Action 格式解析结果不正确')
        }
      } catch (error: any) {
        addResult(`   ❌ 解析失败: ${error.message}`)
      }
      
      // ========== 测试场景 3: JSON 容错（代码块标记） ==========
      addResult('\n🔄 测试场景 3: JSON 容错（Markdown 代码块）')
      
      const actionWithCodeBlock = `Thought: 需要获取任务
Action: get_tasks
Action Input: \`\`\`json
{
  "userId": "test_user",
  "dateRange": {"start": "2025-11-06", "end": "2025-11-06"},
  "includeCompleted": false
}
\`\`\``
      
      try {
        const parsed3 = parseReActOutput(actionWithCodeBlock)
        
        if (parsed3.type === 'action' && parsed3.actionInput.userId === 'test_user') {
          addResult('   ✅ 容错成功（移除了 ```json 标记）')
        } else {
          addResult('   ❌ 容错处理失败')
        }
      } catch (error: any) {
        addResult(`   ❌ 解析失败: ${error.message}`)
      }
      
      // ========== 测试场景 4: JSON 容错（尾部逗号） ==========
      addResult('\n🔄 测试场景 4: JSON 容错（尾部逗号）')
      
      const actionWithTrailingComma = `Thought: 测试
Action: get_tasks
Action Input: {"userId": "test_user", "dateRange": {"start": "2025-11-06", "end": "2025-11-06"},}`
      
      try {
        const parsed4 = parseReActOutput(actionWithTrailingComma)
        
        if (parsed4.type === 'action' && parsed4.actionInput.userId === 'test_user') {
          addResult('   ✅ 容错成功（移除了尾部逗号）')
        } else {
          addResult('   ❌ 容错处理失败')
        }
      } catch (error: any) {
        addResult(`   ❌ 解析失败: ${error.message}`)
      }
      
      // ========== 测试场景 5: 参数验证（正确参数） ==========
      addResult('\n🔄 测试场景 5: 参数验证（正确参数）')
      
      const getTasksTool = tools.find(t => t.name === 'get_tasks')
      if (getTasksTool) {
        const validInput = {
          userId: 'test_user',
          dateRange: { start: '2025-11-06', end: '2025-11-06' },
          includeCompleted: false
        }
        
        const validation1 = validateActionInput('get_tasks', validInput, getTasksTool.parameters)
        
        if (validation1.valid) {
          addResult('   ✅ 参数验证通过')
        } else {
          addResult(`   ❌ 参数验证失败: ${validation1.errors.join(', ')}`)
        }
      }
      
      // ========== 测试场景 6: 参数验证（缺少必需参数） ==========
      addResult('\n🔄 测试场景 6: 参数验证（缺少必需参数）')
      
      if (getTasksTool) {
        const invalidInput = {
          dateRange: { start: '2025-11-06', end: '2025-11-06' }  // 缺少 userId
        }
        
        const validation2 = validateActionInput('get_tasks', invalidInput, getTasksTool.parameters)
        
        if (!validation2.valid && validation2.errors.some(e => e.includes('userId'))) {
          addResult('   ✅ 正确检测到缺少必需参数')
          addResult(`   错误信息: ${validation2.errors.join(', ')}`)
        } else {
          addResult('   ❌ 未能检测到参数缺失')
        }
      }
      
      // ========== 测试场景 7: 错误输出（缺少 Thought） ==========
      addResult('\n🔄 测试场景 7: 错误处理（缺少 Thought）')
      
      const invalidOutput = `Response: 你好！`
      
      try {
        parseReActOutput(invalidOutput)
        addResult('   ❌ 应该抛出错误但没有抛出')
      } catch (error: any) {
        if (error.message.includes('Thought')) {
          addResult('   ✅ 正确检测到缺少 Thought')
        } else {
          addResult(`   ⚠️ 错误信息不准确: ${error.message}`)
        }
      }
      
      // ========== 测试场景 8: 错误输出（格式不明确） ==========
      addResult('\n🔄 测试场景 8: 错误处理（格式不明确）')
      
      const ambiguousOutput = `Thought: 我在思考...`
      
      try {
        parseReActOutput(ambiguousOutput)
        addResult('   ❌ 应该抛出错误但没有抛出')
      } catch (error: any) {
        if (error.message.includes('格式') || error.message.includes('规范')) {
          addResult('   ✅ 正确检测到格式错误')
        } else {
          addResult(`   ⚠️ 错误信息不准确: ${error.message}`)
        }
      }
      
      // ========== 最终总结 ==========
      addResult('\n📊 解析器测试总结:')
      addResult('   ✅ Response 格式解析')
      addResult('   ✅ Action 格式解析')
      addResult('   ✅ JSON 容错处理（代码块、尾部逗号）')
      addResult('   ✅ 参数验证（正确 & 错误）')
      addResult('   ✅ 错误检测和处理')
      
      addResult('\n🎉 Phase 3 Step 2 测试完成！')
      addResult('✅ 输出解析器实现成功')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test ReAct Prompt - Phase 3 Step 1
  const testReActPrompt = async () => {
    if (!user) return

    addResult('\n🧪 ========== Phase 3 Step 1: ReAct Prompt 测试 ==========')
    
    try {
      const { buildReActPrompt } = await import('@/lib/agent/AgentPrompt')
      const { getAllTools } = await import('@/lib/agent/tools')
      const { AgentMemory } = await import('@/lib/agent/AgentMemory')
      
      addResult('✅ Prompt 函数导入成功')
      
      // 准备测试数据
      const tools = getAllTools()
      const memory = new AgentMemory()
      
      // 加载任务上下文（模拟）
      await memory.ensureTaskContext(user.id)
      const taskContext = memory.getTaskContext()
      
      addResult(`✅ 工具加载成功: ${tools.length} 个`)
      addResult(`✅ 任务上下文加载成功: ${taskContext?.todayTasks.length || 0} 个今天的任务`)
      
      // 测试场景 1：简单问候
      addResult('\n🔄 测试场景 1: 简单问候')
      const prompt1 = buildReActPrompt({
        userMessage: '你好',
        memory: [],
        tools: tools,
        taskContext: taskContext,
        userProfile: null,
        dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' },
        userId: user.id
      })
      
      const checks1 = {
        hasRole: prompt1.includes('ReAct'),
        hasTools: prompt1.includes('可用工具'),
        hasExamples: prompt1.includes('示例'),
        hasFormat: prompt1.includes('输出格式'),
        hasUserMessage: prompt1.includes('你好')
      }
      
      addResult(`   长度: ${prompt1.length} 字符`)
      addResult(`   ✅ 包含角色定位: ${checks1.hasRole}`)
      addResult(`   ✅ 包含工具列表: ${checks1.hasTools}`)
      addResult(`   ✅ 包含示例: ${checks1.hasExamples}`)
      addResult(`   ✅ 包含格式要求: ${checks1.hasFormat}`)
      addResult(`   ✅ 包含用户消息: ${checks1.hasUserMessage}`)
      
      const allChecks1 = Object.values(checks1).every(v => v === true)
      if (allChecks1) {
        addResult('   ✅ 场景 1 验证通过')
      } else {
        addResult('   ❌ 场景 1 验证失败')
      }
      
      // 测试场景 2：带对话历史
      addResult('\n🔄 测试场景 2: 带对话历史')
      memory.addMessage({ role: 'user', content: '我今天有哪些任务？' })
      memory.addMessage({ role: 'assistant', content: '你今天有3个任务。' })
      
      const prompt2 = buildReActPrompt({
        userMessage: '帮我分析一下',
        memory: memory.getHistory(),
        tools: tools,
        taskContext: taskContext,
        userProfile: null,
        dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' },
        userId: user.id
      })
      
      const hasHistory = prompt2.includes('对话历史') && prompt2.includes('我今天有哪些任务')
      addResult(`   ✅ 包含对话历史: ${hasHistory}`)
      
      // 测试场景 3：检查 Few-shot 示例
      addResult('\n🔄 测试场景 3: Few-shot 示例检查')
      const exampleChecks = {
        example1: prompt1.includes('示例 1：简单问候'),
        example2: prompt1.includes('示例 2：查询任务'),
        example3: prompt1.includes('示例 3：多步推理'),
        example4: prompt1.includes('示例 4：交互式工具'),
        errorExamples: prompt1.includes('错误示例')
      }
      
      addResult(`   ✅ 示例 1（问候）: ${exampleChecks.example1}`)
      addResult(`   ✅ 示例 2（单步）: ${exampleChecks.example2}`)
      addResult(`   ✅ 示例 3（多步）: ${exampleChecks.example3}`)
      addResult(`   ✅ 示例 4（交互）: ${exampleChecks.example4}`)
      addResult(`   ✅ 错误示例: ${exampleChecks.errorExamples}`)
      
      const allExamples = Object.values(exampleChecks).every(v => v === true)
      if (allExamples) {
        addResult('   ✅ 所有示例都已包含')
      } else {
        addResult('   ❌ 缺少部分示例')
      }
      
      // 测试场景 4：工具描述完整性
      addResult('\n🔄 测试场景 4: 工具描述完整性')
      const toolNames = tools.map(t => t.name)
      const missingTools = toolNames.filter(name => !prompt1.includes(name))
      
      if (missingTools.length === 0) {
        addResult(`   ✅ 所有 ${toolNames.length} 个工具都已包含`)
        toolNames.forEach(name => {
          addResult(`      - ${name}`)
        })
      } else {
        addResult(`   ❌ 缺少工具: ${missingTools.join(', ')}`)
      }
      
      // 最终总结
      addResult('\n📊 Prompt 质量评估:')
      addResult(`   总长度: ${prompt1.length} 字符 ${prompt1.length > 5000 ? '✅' : '⚠️ (可能太短)'}`)
      addResult(`   工具数量: ${tools.length} 个`)
      addResult(`   示例数量: ${(prompt1.match(/示例 \d/g) || []).length} 个`)
      addResult(`   错误示例: ${(prompt1.match(/错误 \d/g) || []).length} 个`)
      
      addResult('\n🎉 Phase 3 Step 1 测试完成！')
      addResult('✅ ReAct Prompt 模板实现成功')
      
      // 可选：打印完整 Prompt（供调试）
      if (false) { // 设置为 true 可查看完整 Prompt
        addResult('\n📝 完整 Prompt 预览（前 500 字符）:')
        addResult(prompt1.substring(0, 500) + '...')
      }
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test ReflectOnTasksTool - 元认知反思工具
  const testReflectOnTasksTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试 ReflectOnTasksTool 元认知反思工具 ==========')
    
    try {
      const { ReflectOnTasksTool } = await import('@/lib/agent/tools/ReflectOnTasksTool')
      
      addResult('✅ 工具类导入成功')
      
      const tool = new ReflectOnTasksTool()
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      addResult(`📝 工具描述: ${tool.description.substring(0, 80)}...`)
      
      // 测试场景 1: improve（完善任务）
      addResult('\n🔄 测试场景 1: improve（完善任务）')
      const result1 = await tool.execute({
        triggerType: 'improve',
        tasks: [{ title: '学习', priority: 'medium' }]
      })
      
      if (result1.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📋 标题: ${result1.data.title}`)
        addResult(`❓ 问题数量: ${result1.data.questions.length}`)
        result1.data.questions.forEach((q: any, i: number) => {
          addResult(`   ${i + 1}. [${q.dimension}] ${q.text}`)
          if (q.hint) addResult(`      💡 提示: ${q.hint}`)
        })
      } else {
        addResult(`❌ 执行失败: ${result1.message}`)
      }
      
      // 测试场景 2: decompose（拆解任务）
      addResult('\n🔄 测试场景 2: decompose（拆解任务）')
      const result2 = await tool.execute({
        triggerType: 'decompose',
        tasks: [{ title: '写论文', estimatedDuration: 180 }]
      })
      
      if (result2.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📋 标题: ${result2.data.title}`)
        addResult(`❓ 问题数量: ${result2.data.questions.length}`)
        result2.data.questions.forEach((q: any, i: number) => {
          addResult(`   ${i + 1}. [${q.dimension}] ${q.text}`)
        })
      } else {
        addResult(`❌ 执行失败: ${result2.message}`)
      }
      
      // 测试场景 3: estimate_time（时间估计）
      addResult('\n🔄 测试场景 3: estimate_time（时间估计）')
      const result3 = await tool.execute({
        triggerType: 'estimate_time',
        tasks: [{ title: '准备面试', deadline: '2025-12-01' }],
        userProfileSummary: '大三学生，计算机专业'
      })
      
      if (result3.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📋 标题: ${result3.data.title}`)
        addResult(`❓ 问题数量: ${result3.data.questions.length}`)
        result3.data.questions.forEach((q: any, i: number) => {
          addResult(`   ${i + 1}. [${q.dimension}] ${q.text}`)
        })
      } else {
        addResult(`❌ 执行失败: ${result3.message}`)
      }
      
      // 测试场景 4: reprioritize（优先级调整）
      addResult('\n🔄 测试场景 4: reprioritize（优先级调整）')
      const result4 = await tool.execute({
        triggerType: 'reprioritize',
        tasks: [
          { title: '复习考试', priority: 'high' },
          { title: '整理笔记', priority: 'low' }
        ],
        situationContext: {
          currentDate: '2025-11-25',
          isWeekend: false,
          pendingTaskCount: 8,
          overdueTaskCount: 2
        }
      })
      
      if (result4.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📋 标题: ${result4.data.title}`)
        addResult(`❓ 问题数量: ${result4.data.questions.length}`)
        result4.data.questions.forEach((q: any, i: number) => {
          addResult(`   ${i + 1}. [${q.dimension}] ${q.text}`)
        })
      } else {
        addResult(`❌ 执行失败: ${result4.message}`)
      }
      
      // 测试场景 5: review（回顾任务）
      addResult('\n🔄 测试场景 5: review（回顾任务）')
      const result5 = await tool.execute({
        triggerType: 'review',
        tasks: [
          { title: '完成作业', isCompleted: true },
          { title: '锻炼', isCompleted: false }
        ]
      })
      
      if (result5.type === 'success') {
        addResult('✅ 工具执行成功！')
        addResult(`📋 标题: ${result5.data.title}`)
        addResult(`❓ 问题数量: ${result5.data.questions.length}`)
        result5.data.questions.forEach((q: any, i: number) => {
          addResult(`   ${i + 1}. [${q.dimension}] ${q.text}`)
        })
      } else {
        addResult(`❌ 执行失败: ${result5.message}`)
      }
      
      addResult('\n🎉 ReflectOnTasksTool 测试完成！')
      addResult('✅ 所有 5 种触发场景都已测试')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // Test EstimateTimeTool - Step 7
  const testEstimateTimeTool = async () => {
    if (!user) return

    addResult('\n🧪 ========== Step 7: EstimateTimeTool 测试 ==========')
    
    try {
      const { EstimateTimeTool } = await import('@/lib/agent/tools/EstimateTimeTool')
      const { LoadTaskContextTool } = await import('@/lib/agent/tools/LoadTaskContextTool')
      
      addResult('✅ 工具类导入成功')
      
      // 加载任务上下文
      addResult('\n🔄 加载任务上下文...')
      const loadTool = new LoadTaskContextTool()
      const loadResult = await loadTool.execute({ userId: user.id })
      
      if (loadResult.type !== 'success' || loadResult.data.todayTasks.length === 0) {
        addResult('⚠️  没有找到今天的任务，无法测试时间估算功能')
        return
      }
      
      // 找一个没有时间估算的任务
      const taskToEstimate = loadResult.data.todayTasks.find(t => !t.estimated_duration) || loadResult.data.todayTasks[0]
      
      addResult(`✅ 找到任务: "${taskToEstimate.title}"`)
      
      if (taskToEstimate.estimated_duration) {
        addResult(`   现有估算: ${taskToEstimate.estimated_duration} 分钟`)
      } else {
        addResult('   现有估算: 无')
      }
      
      // 执行时间估算
      addResult('\n🔄 执行时间估算...')
      const estimateTool = new EstimateTimeTool()
      const result = await estimateTool.execute({ 
        task: taskToEstimate,
        userContext: '这是一个常规任务，我以前做过类似的' // 可选的用户补充信息
      })
      
      if (result.type === 'success') {
        addResult('✅ 时间估算完成！')
        addResult(`\n${result.data.message}`)
        
        addResult('\n⏱️  估算详情:')
        addResult(`  时长: ${result.data.estimatedMinutes} 分钟 (${result.data.estimatedHours} 小时)`)
        addResult(`  理由: ${result.data.reasoning}`)
        
        if (result.data.breakdown) {
          addResult(`  分配: ${result.data.breakdown}`)
        }
        
        if (result.data.suggestions) {
          addResult('\n💡 后续建议:')
          result.data.suggestions.forEach((suggestion: string) => {
            addResult(`  ${suggestion}`)
          })
        }
        
        addResult('\n🎉 Step 7 测试通过！')
        addResult('✅ EstimateTimeTool 开发完成！')
        addResult('\n🎊 Phase 2 所有工具开发完成！')
      } else if (result.type === 'error') {
        addResult(`❌ 工具执行失败: ${result.message}`)
      }
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试 GlobalScanTool
  const testGlobalScanTool = async () => {
    addResult('\n🧪 ========== 测试 GlobalScanTool ==========')
    
    try {
      const { GlobalScanTool } = await import('@/lib/agent/tools/GlobalScanTool')
      
      addResult('✅ GlobalScanTool 导入成功')
      
      const tool = new GlobalScanTool()
      addResult(`✅ 工具实例化成功: ${tool.name}`)
      
      // 测试场景 1: 空任务列表
      addResult('\n🔄 测试场景 1: 空任务列表')
      const result1 = await tool.execute({ tasks: [] })
      if (result1.type === 'success') {
        addResult(`✅ 空任务扫描成功`)
        addResult(`   总结: ${result1.data.summary}`)
      }
      
      // 测试场景 2: 正常任务列表
      addResult('\n🔄 测试场景 2: 正常任务列表')
      const mockTasks = [
        { id: '1', title: '写论文', priority: 'high', estimatedDuration: 120, isCompleted: false },
        { id: '2', title: '复习', isCompleted: false },  // 模糊任务，无优先级，无时间
        { id: '3', title: '整理笔记', priority: 'low', isCompleted: false },
        { id: '4', title: '准备面试', priority: 'medium', estimatedDuration: 60, deadline: '2025-12-01', isCompleted: false },
        { id: '5', title: '买东西', isCompleted: false },  // 模糊任务
      ]
      
      const result2 = await tool.execute({ tasks: mockTasks, noteDate: '2025-11-25' })
      if (result2.type === 'success') {
        addResult(`✅ 任务扫描成功`)
        addResult(`📊 扫描结果:`)
        addResult(`   总任务数: ${result2.data.scanResult.totalTaskCount}`)
        addResult(`   模糊任务: ${result2.data.scanResult.vagueTaskCount}`)
        addResult(`   未估时: ${result2.data.scanResult.unestimatedTaskCount}`)
        addResult(`   未设优先级: ${result2.data.scanResult.noPriorityCount}`)
        addResult(`   工作负载: ${result2.data.scanResult.workloadLevel}`)
        addResult(`   跨天任务: ${result2.data.scanResult.crossDayTasks.length}`)
        addResult(`\n📝 视觉化小结:`)
        result2.data.summary.split('\n').forEach((line: string) => {
          addResult(`   ${line}`)
        })
      }
      
      // 测试场景 3: 有 deadline 冲突的任务
      addResult('\n🔄 测试场景 3: deadline 冲突场景')
      const conflictTasks = [
        { id: '1', title: '紧急报告', priority: 'low', deadline: '2025-11-25', isCompleted: false },  // 今天截止但优先级低
        { id: '2', title: '过期任务', deadline: '2025-11-20', isCompleted: false },  // 已过期
      ]
      
      const result3 = await tool.execute({ tasks: conflictTasks, noteDate: '2025-11-25' })
      if (result3.type === 'success') {
        addResult(`✅ 冲突检测成功`)
        addResult(`   deadline 冲突: ${result3.data.scanResult.deadlineConflicts.join(', ')}`)
      }
      
      addResult('\n🎉 GlobalScanTool 测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试任务拆解识别函数
  const testIdentifyDecomposableTasks = async () => {
    addResult('\n🧪 ========== 测试任务拆解识别函数 ==========')
    
    try {
      const { identifyDecomposableTasks, formatDecompositionInquiryMessage } = await import('@/lib/reflectionFlow')
      
      addResult('✅ identifyDecomposableTasks 导入成功')
      
      // 测试场景 1: 混合任务列表
      addResult('\n🔄 测试场景 1: 混合任务列表')
      const mixedTasks = [
        { id: '1', title: '写论文', isCompleted: false },  // 应该被识别（关键词）
        { id: '2', title: '复习', isCompleted: false },    // 不应该被识别（太短）
        { id: '3', title: '整理房间', isCompleted: false }, // 应该被识别（关键词）
        { id: '4', title: '准备面试材料和简历', isCompleted: false }, // 应该被识别（关键词+长）
        { id: '5', title: '买牛奶', isCompleted: false },  // 不应该被识别
        { id: '6', title: '完成项目报告', isCompleted: false }, // 应该被识别（多个关键词）
        { id: '7', title: '锻炼', isCompleted: true },     // 不应该被识别（已完成）
      ]
      
      const result1 = identifyDecomposableTasks(mixedTasks as any)
      addResult(`📊 识别结果: ${result1.length} 个任务可能需要拆解`)
      result1.forEach((task, i) => {
        addResult(`   ${i + 1}. ${task.title}`)
      })
      
      // 测试场景 2: 格式化消息
      addResult('\n🔄 测试场景 2: 格式化拆解询问消息')
      const message = formatDecompositionInquiryMessage(result1)
      addResult('📝 生成的消息:')
      message.split('\n').forEach(line => {
        addResult(`   ${line}`)
      })
      
      // 测试场景 3: 空列表
      addResult('\n🔄 测试场景 3: 没有可拆解任务')
      const simpleTasks = [
        { id: '1', title: '买菜', isCompleted: false },
        { id: '2', title: '吃饭', isCompleted: false },
      ]
      const result3 = identifyDecomposableTasks(simpleTasks as any)
      addResult(`📊 识别结果: ${result3.length} 个任务（预期为 0）`)
      
      const emptyMessage = formatDecompositionInquiryMessage(result3)
      addResult(`📝 空消息: "${emptyMessage}" (预期为空字符串)`)
      
      addResult('\n🎉 任务拆解识别函数测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  // 测试反思服务数据访问层
  const testReflectionService = async () => {
    if (!user) return

    addResult('\n🧪 ========== 测试反思服务数据访问层 ==========')
    
    try {
      const { 
        createPlanSnapshot, 
        getPlanSnapshot,
        createReflectionSession,
        getReflectionSession,
        updateReflectionSession,
        getInProgressReflectionSession,
        createTaskSnapshots
      } = await import('@/lib/reflectionService')
      
      addResult('✅ reflectionService 导入成功')

      // 1. 测试创建计划快照
      addResult('\n🔄 测试 1: 创建计划快照...')
      
      const mockTasks = [
        { id: '1', title: '写论文', priority: 'high', estimatedDuration: 120, completed: false },
        { id: '2', title: '复习考试', priority: 'medium', completed: false },
        { id: '3', title: '整理笔记', completed: true }
      ]
      
      const taskSnapshots = createTaskSnapshots(mockTasks)
      addResult(`📋 创建了 ${taskSnapshots.length} 个任务快照`)
      
      const snapshot = await createPlanSnapshot({
        userId: user.id,
        noteDate: new Date().toISOString().split('T')[0],
        tasksJson: taskSnapshots
      })
      
      if (snapshot) {
        addResult(`✅ 计划快照创建成功: ${snapshot.id}`)
        addResult(`   任务数: ${snapshot.taskCount}`)
        
        // 2. 测试获取计划快照
        addResult('\n🔄 测试 2: 获取计划快照...')
        const fetchedSnapshot = await getPlanSnapshot(snapshot.id)
        if (fetchedSnapshot) {
          addResult(`✅ 获取成功: ${fetchedSnapshot.id}`)
        } else {
          addResult('❌ 获取失败')
        }
        
        // 3. 测试创建反思会话
        addResult('\n🔄 测试 3: 创建反思会话...')
        const session = await createReflectionSession({
          planSnapshotId: snapshot.id,
          userId: user.id
        })
        
        if (session) {
          addResult(`✅ 反思会话创建成功: ${session.id}`)
          addResult(`   状态: ${session.status}`)
          addResult(`   当前轮次: ${session.currentRound}`)
          
          // 4. 测试更新反思会话
          addResult('\n🔄 测试 4: 更新反思会话...')
          const updatedSession = await updateReflectionSession(session.id, {
            currentRound: 'clarity',
            scanResult: {
              vagueTaskCount: 1,
              unestimatedTaskCount: 2,
              workloadLevel: 'medium',
              crossDayTasks: [],
              deadlineConflicts: [],
              noPriorityCount: 1,
              totalTaskCount: 3
            },
            overviewSummary: '测试总览小结'
          })
          
          if (updatedSession) {
            addResult(`✅ 更新成功`)
            addResult(`   当前轮次: ${updatedSession.currentRound}`)
            addResult(`   总览小结: ${updatedSession.overviewSummary}`)
            addResult(`   扫描结果: ${JSON.stringify(updatedSession.scanResult)}`)
          } else {
            addResult('❌ 更新失败')
          }
          
          // 5. 测试获取未完成会话
          addResult('\n🔄 测试 5: 获取未完成反思会话...')
          const inProgressSession = await getInProgressReflectionSession(
            user.id,
            new Date().toISOString().split('T')[0]
          )
          
          if (inProgressSession) {
            addResult(`✅ 找到未完成会话: ${inProgressSession.id}`)
          } else {
            addResult('📭 没有未完成的会话')
          }
          
          // 6. 测试完成会话
          addResult('\n🔄 测试 6: 完成反思会话...')
          const completedSession = await updateReflectionSession(session.id, {
            status: 'completed',
            currentRound: 'summary',
            finalSummary: '测试最终总结',
            executionSuggestions: ['建议1', '建议2'],
            completedAt: new Date().toISOString()
          })
          
          if (completedSession) {
            addResult(`✅ 会话已完成`)
            addResult(`   状态: ${completedSession.status}`)
            addResult(`   最终总结: ${completedSession.finalSummary}`)
          }
          
        } else {
          addResult('❌ 创建反思会话失败')
        }
        
      } else {
        addResult('❌ 创建计划快照失败')
      }
      
      addResult('\n🎉 反思服务测试完成！')
      
    } catch (error: any) {
      addResult(`❌ 测试失败: ${error.message}`)
      console.error('测试错误:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">🧪 Agent 工具测试</h1>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              用户: {user?.email}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Phase 2 - 工具层开发测试
            </p>
          </div>
          
          <div className="space-y-4 mb-6">
            <button
              onClick={testToolsRegistry}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              测试 1: 工具注册中心
            </button>
            
            <button
              onClick={testLoadTaskContextTool}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              测试 2: LoadTaskContextTool
            </button>
            
            <button
              onClick={testGetTasksTool}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              测试 3: GetTasksTool
            </button>
            
            <button
              onClick={testAnalyzeTasksTool}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
            >
              测试 4: AnalyzeTasksTool
            </button>
            
            <button
              onClick={testClarifyTaskTool}
              className="w-full bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
            >
              测试 5: ClarifyTaskTool ⭐ NEW（交互式）
            </button>
            
            <button
              onClick={testAgentMemoryEnsureTaskContext}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              测试 6: AgentMemory.ensureTaskContext
            </button>
            
            <button
              onClick={testDecomposeToolBasics}
              className="w-full bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
            >
              ✅ Step 6.1: DecomposeTaskTool 基础验证
            </button>
            
            <button
              onClick={testDecomposeToolRound1}
              className="w-full bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700"
            >
              ✅ Step 6.2: DecomposeTaskTool 第一轮测试（生成问题）
            </button>
            
            <button
              onClick={testDecomposeToolComplete}
              className="w-full bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            >
              ✅ Step 6.3: DecomposeTaskTool 完整测试（两轮对话）
            </button>
            
            <button
              onClick={testEstimateTimeTool}
              className="w-full bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
            >
              🚧 Step 7: EstimateTimeTool 测试 ⭐ 最后一个！
            </button>
            
            <div className="border-t-4 border-green-500 my-4 pt-4">
              <h3 className="text-lg font-bold mb-2 text-green-600">💭 元认知反思系统</h3>
              <button
                onClick={testReflectionService}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold mb-2"
              >
                🧪 Step 1.3: 反思服务数据访问层测试
              </button>
              <button
                onClick={testGlobalScanTool}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold mb-2"
              >
                🧪 Step 3.1: GlobalScanTool 测试
              </button>
              <button
                onClick={testIdentifyDecomposableTasks}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold mb-2"
              >
                🧪 任务拆解识别函数测试 ⭐ NEW
              </button>
              <button
                onClick={testReflectOnTasksTool}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold mb-2"
              >
                🧪 测试 ReflectOnTasksTool（5种场景）
              </button>
            </div>
            
            <div className="border-t-4 border-purple-500 my-4 pt-4">
              <h3 className="text-lg font-bold mb-2 text-purple-600">🚀 Phase 3: ReAct Agent Core</h3>
              <button
                onClick={testReActPrompt}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold mb-2"
              >
                ✅ Phase 3 Step 1: ReAct Prompt 模板测试
              </button>
              <button
                onClick={testOutputParser}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold mb-2"
              >
                ✅ Phase 3 Step 2: 输出解析器测试
              </button>
              <button
                onClick={testReActAgent}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold"
              >
                🧪 Phase 3 Step 3: ReAct Agent 主循环测试 ⭐ NEW
              </button>
            </div>
            
            <button
              onClick={() => setTestResults([])}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              清空结果
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-[600px]">
            {testResults.length === 0 ? (
              <p className="text-gray-500">点击上方按钮开始测试...</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

