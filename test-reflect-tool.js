// 简单测试脚本：验证 ReflectOnTasksTool 是否可以正常导入和实例化

async function testReflectOnTasksTool() {
  try {
    // 动态导入
    const { ReflectOnTasksTool } = await import('./src/lib/agent/tools/ReflectOnTasksTool.ts')
    
    // 创建实例
    const tool = new ReflectOnTasksTool()
    
    console.log('✅ ReflectOnTasksTool 创建成功!')
    console.log('   - name:', tool.name)
    console.log('   - description:', tool.description.substring(0, 50) + '...')
    console.log('   - parameters:', JSON.stringify(tool.parameters, null, 2))
    
    // 测试默认问题生成
    const defaultQuestions = tool.getDefaultQuestions({ 
      triggerType: 'improve', 
      tasks: [{ title: '学习' }] 
    })
    console.log('   - 默认问题数量:', defaultQuestions.length)
    console.log('   - 第一个问题:', defaultQuestions[0]?.text)
    
    return true
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    return false
  }
}

testReflectOnTasksTool()

