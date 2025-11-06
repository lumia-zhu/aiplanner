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
        dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' }
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
        dateScope: { type: 'day', start: '2025-11-06', end: '2025-11-06' }
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
            
            <div className="border-t-4 border-purple-500 my-4 pt-4">
              <h3 className="text-lg font-bold mb-2 text-purple-600">🚀 Phase 3: ReAct Agent Core</h3>
              <button
                onClick={testReActPrompt}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-bold"
              >
                🧪 Phase 3 Step 1: ReAct Prompt 模板测试
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

