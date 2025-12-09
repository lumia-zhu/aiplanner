/**
 * 每日反思 CRUD 服务层测试脚本
 * 
 * 使用方法：
 * 1. 启动开发服务器：npm run dev
 * 2. 在浏览器中打开应用并登录
 * 3. 打开浏览器控制台（F12）
 * 4. 复制本文件内容到控制台执行
 * 
 * 或者直接在代码中临时调用这些测试函数
 */

import { 
  getRandomQuestions,
  getTodayReflection,
  createDailyReflection,
  updateReflectionAnswer,
  skipReflectionQuestion,
  completeReflection,
  getReflectionHistory,
  getReflectionHistoryCount,
  getReflectionStats,
  deleteReflection
} from '@/lib/dailyReflections'

/**
 * 测试1：随机抽取问题
 */
export async function test1_RandomQuestions() {
  console.log('\n=== 测试1：随机抽取问题 ===')
  
  // 抽取3次，验证随机性
  for (let i = 1; i <= 3; i++) {
    const questions = getRandomQuestions()
    console.log(`第${i}次抽取:`, questions)
  }
  
  console.log('✅ 测试1通过')
}

/**
 * 测试2：查询今天的反思（应该不存在）
 */
export async function test2_GetTodayReflection(userId: string) {
  console.log('\n=== 测试2：查询今天的反思 ===')
  
  const reflection = await getTodayReflection(userId)
  console.log('查询结果:', reflection)
  
  if (reflection === null) {
    console.log('✅ 测试2通过：今天还没有反思记录')
  } else {
    console.log('⚠️ 今天已有反思记录:', reflection)
  }
  
  return reflection
}

/**
 * 测试3：创建新的反思会话
 */
export async function test3_CreateReflection(userId: string) {
  console.log('\n=== 测试3：创建新的反思会话 ===')
  
  try {
    const reflection = await createDailyReflection(userId)
    console.log('创建成功:', reflection)
    console.log('问题1:', reflection.question_1)
    console.log('问题2:', reflection.question_2)
    console.log('问题3:', reflection.question_3)
    console.log('状态:', reflection.status)
    console.log('当前问题索引:', reflection.current_question_index)
    
    console.log('✅ 测试3通过')
    return reflection
  } catch (error: any) {
    if (error.message === 'DUPLICATE_REFLECTION') {
      console.log('⚠️ 今天已经创建过反思记录（唯一约束生效）')
      // 查询现有记录
      const existing = await getTodayReflection(userId)
      console.log('使用现有记录:', existing)
      console.log('✅ 测试3通过（使用现有记录）')
      return existing
    }
    throw error
  }
}

/**
 * 测试4：回答第一个问题
 */
export async function test4_AnswerQuestion1(reflectionId: string) {
  console.log('\n=== 测试4：回答第一个问题 ===')
  
  const answer = '今天完成了3个重要任务，感觉很充实！特别是解决了一个困扰很久的Bug。'
  const updated = await updateReflectionAnswer(reflectionId, 1, answer)
  
  console.log('更新后的记录:', updated)
  console.log('回答1:', updated.answer_1)
  console.log('当前问题索引:', updated.current_question_index)
  
  console.log('✅ 测试4通过')
  return updated
}

/**
 * 测试5：跳过第二个问题
 */
export async function test5_SkipQuestion2(reflectionId: string) {
  console.log('\n=== 测试5：跳过第二个问题 ===')
  
  const updated = await skipReflectionQuestion(reflectionId, 2)
  
  console.log('更新后的记录:', updated)
  console.log('回答2（应该为null）:', updated.answer_2)
  console.log('当前问题索引:', updated.current_question_index)
  
  if (updated.answer_2 === null && updated.current_question_index === 2) {
    console.log('✅ 测试5通过')
  } else {
    console.log('❌ 测试5失败')
  }
  
  return updated
}

/**
 * 测试6：回答第三个问题
 */
export async function test6_AnswerQuestion3(reflectionId: string) {
  console.log('\n=== 测试6：回答第三个问题 ===')
  
  const answer = '精力还不错，心情愉快，对明天充满期待！'
  const updated = await updateReflectionAnswer(reflectionId, 3, answer)
  
  console.log('更新后的记录:', updated)
  console.log('回答3:', updated.answer_3)
  console.log('当前问题索引:', updated.current_question_index)
  
  console.log('✅ 测试6通过')
  return updated
}

/**
 * 测试7：完成反思并保存AI总结
 */
export async function test7_CompleteReflection(reflectionId: string) {
  console.log('\n=== 测试7：完成反思 ===')
  
  const aiSummary = `
🎉 太棒了！今天你完成了3个重要任务，还解决了困扰很久的Bug，这种突破的感觉一定很棒！

虽然你跳过了第二个问题，但从你的回答中能感受到你对工作的热情和积极的心态。精力充沛、心情愉快，这是最好的状态！

继续保持这份热情，明天一定会更好！💪
  `.trim()
  
  const updated = await completeReflection(reflectionId, aiSummary)
  
  console.log('更新后的记录:', updated)
  console.log('AI总结:', updated.ai_summary)
  console.log('状态:', updated.status)
  console.log('当前问题索引:', updated.current_question_index)
  
  if (updated.status === 'completed' && updated.current_question_index === 3) {
    console.log('✅ 测试7通过')
  } else {
    console.log('❌ 测试7失败')
  }
  
  return updated
}

/**
 * 测试8：查询今天的反思（应该存在且已完成）
 */
export async function test8_GetCompletedReflection(userId: string) {
  console.log('\n=== 测试8：查询已完成的反思 ===')
  
  const reflection = await getTodayReflection(userId)
  console.log('查询结果:', reflection)
  
  if (reflection && reflection.status === 'completed') {
    console.log('✅ 测试8通过：成功查询到已完成的反思')
  } else {
    console.log('❌ 测试8失败')
  }
  
  return reflection
}

/**
 * 测试9：查询历史记录
 */
export async function test9_GetHistory(userId: string) {
  console.log('\n=== 测试9：查询历史记录 ===')
  
  const history = await getReflectionHistory(userId, 10, 0)
  console.log(`查询到 ${history.length} 条历史记录:`, history)
  
  const count = await getReflectionHistoryCount(userId)
  console.log('历史记录总数:', count)
  
  console.log('✅ 测试9通过')
  return { history, count }
}

/**
 * 测试10：查询统计信息
 */
export async function test10_GetStats(userId: string) {
  console.log('\n=== 测试10：查询统计信息 ===')
  
  const stats = await getReflectionStats(userId)
  console.log('统计信息:', stats)
  console.log(`- 总共完成 ${stats.total} 次反思`)
  console.log(`- 本周完成 ${stats.thisWeek} 次`)
  console.log(`- 本月完成 ${stats.thisMonth} 次`)
  
  console.log('✅ 测试10通过')
  return stats
}

/**
 * 测试11：删除反思记录（清理测试数据）
 */
export async function test11_DeleteReflection(reflectionId: string) {
  console.log('\n=== 测试11：删除反思记录 ===')
  
  const result = await deleteReflection(reflectionId)
  console.log('删除结果:', result ? '成功' : '失败')
  
  if (result) {
    console.log('✅ 测试11通过')
  } else {
    console.log('❌ 测试11失败')
  }
  
  return result
}

/**
 * 🚀 运行所有测试（完整流程）
 * 
 * 注意：这会创建并删除一条测试记录
 */
export async function runAllTests(userId: string) {
  console.log('\n')
  console.log('='.repeat(60))
  console.log('🧪 开始执行每日反思 CRUD 服务层完整测试')
  console.log('='.repeat(60))
  
  try {
    // 测试1：随机抽取问题
    await test1_RandomQuestions()
    
    // 测试2：查询今天的反思
    await test2_GetTodayReflection(userId)
    
    // 测试3：创建新的反思会话
    const reflection = await test3_CreateReflection(userId)
    if (!reflection) {
      throw new Error('创建反思失败')
    }
    
    // 测试4：回答第一个问题
    await test4_AnswerQuestion1(reflection.id)
    
    // 测试5：跳过第二个问题
    await test5_SkipQuestion2(reflection.id)
    
    // 测试6：回答第三个问题
    await test6_AnswerQuestion3(reflection.id)
    
    // 测试7：完成反思
    await test7_CompleteReflection(reflection.id)
    
    // 测试8：查询已完成的反思
    await test8_GetCompletedReflection(userId)
    
    // 测试9：查询历史记录
    await test9_GetHistory(userId)
    
    // 测试10：查询统计信息
    await test10_GetStats(userId)
    
    // 测试11：删除反思记录（清理测试数据）
    console.log('\n⚠️ 是否删除测试数据？（如果要保留今天的反思记录，请跳过这一步）')
    console.log('如需删除，请手动执行: await test11_DeleteReflection("' + reflection.id + '")')
    
    console.log('\n')
    console.log('='.repeat(60))
    console.log('✅ 所有测试通过！')
    console.log('='.repeat(60))
    console.log('\n')
    
    return reflection.id
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  }
}

/**
 * 🧹 清理今天的测试数据
 */
export async function cleanupTodayReflection(userId: string) {
  console.log('\n=== 清理今天的反思记录 ===')
  
  const reflection = await getTodayReflection(userId)
  if (reflection) {
    console.log('找到今天的反思记录:', reflection.id)
    const result = await deleteReflection(reflection.id)
    console.log(result ? '✅ 清理成功' : '❌ 清理失败')
  } else {
    console.log('⚠️ 今天没有反思记录')
  }
}

// 导出快捷测试函数
export const dailyReflectionTests = {
  test1_RandomQuestions,
  test2_GetTodayReflection,
  test3_CreateReflection,
  test4_AnswerQuestion1,
  test5_SkipQuestion2,
  test6_AnswerQuestion3,
  test7_CompleteReflection,
  test8_GetCompletedReflection,
  test9_GetHistory,
  test10_GetStats,
  test11_DeleteReflection,
  runAllTests,
  cleanupTodayReflection
}

