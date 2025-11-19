/**
 * 任务执行建议的 Prompt 模板
 * 
 * 根据不同的任务操作类型，生成个性化的建议
 */

import type { UserProfile, TaskContext } from '@/types/advice'

/**
 * 构建用户画像描述
 */
function buildUserProfileDescription(profile: UserProfile): string {
  const parts: string[] = []
  
  if (profile.major) {
    parts.push(`专业：${profile.major}`)
  }
  
  if (profile.grade) {
    parts.push(`年级：${profile.grade}`)
  }
  
  if (profile.challenges && profile.challenges.length > 0) {
    parts.push(`面临的挑战：${profile.challenges.join('、')}`)
  }
  
  if (profile.workplaces && profile.workplaces.length > 0) {
    parts.push(`常去场所：${profile.workplaces.join('、')}`)
  }
  
  return parts.length > 0 ? parts.join('\n') : '暂无个人信息'
}

/**
 * 构建任务上下文描述
 */
function buildTaskContextDescription(context: TaskContext): string {
  const parts: string[] = []
  
  parts.push(`操作：${getActionText(context.action)}`)
  parts.push(`任务：${context.taskTitle}`)
  parts.push(`日期：${context.taskDate}`)
  
  if (context.completed !== undefined) {
    parts.push(`状态：${context.completed ? '已完成 ✅' : '未完成 ⬜'}`)
  }
  
  if (context.isRecurring) {
    parts.push(`类型：周期性任务`)
  }
  
  if (context.affectedDatesCount && context.affectedDatesCount > 1) {
    parts.push(`影响范围：${context.affectedDatesCount} 天`)
  }
  
  return parts.join('\n')
}

/**
 * 获取操作类型的中文描述
 */
function getActionText(action: string): string {
  const actionMap: Record<string, string> = {
    create: '创建任务',
    update: '更新任务',
    delete: '删除任务',
    complete: '完成任务',
    recurring: '批量操作'
  }
  return actionMap[action] || action
}

/**
 * 生成系统提示词
 */
export function buildAdviceSystemPrompt(): string {
  return `你是一个温暖、贴心的任务管理助手。

你的任务是：
1. 根据用户的个人画像和刚完成的任务操作，给出1-2句简短、实用的建议
2. 建议应该具有针对性和可操作性
3. 语气要温暖、鼓励，避免说教

建议类型：
- 🎉 完成任务时：给予肯定和鼓励，可以结合用户的挑战给出建议
- 📝 创建任务时：提供执行建议，可以结合用户的常去场所或习惯
- 🔄 周期性任务：强调坚持的重要性，提供长期规划建议
- ❌ 删除任务时：提醒用户反思，避免过度承诺

注意事项：
- 建议长度：30-60字
- 避免空洞的鸡汤，要有具体内容
- 如果用户信息不足，给出通用但有价值的建议
- 可以适当使用emoji增加亲和力（但不要过多）`
}

/**
 * 生成用户提示词
 */
export function buildAdviceUserPrompt(
  userProfile: UserProfile,
  taskContext: TaskContext,
  currentTime?: Date
): string {
  const userDesc = buildUserProfileDescription(userProfile)
  const taskDesc = buildTaskContextDescription(taskContext)
  
  // 获取时间段（早上/下午/晚上）
  const timeOfDay = getTimeOfDay(currentTime)
  
  return `【用户信息】
${userDesc}

【当前时间】
${timeOfDay}

【任务操作】
${taskDesc}

请基于以上信息，给出1-2句简短、实用的建议。`
}

/**
 * 获取时间段
 */
function getTimeOfDay(time?: Date): string {
  if (!time) {
    time = new Date()
  }
  
  const hour = time.getHours()
  
  if (hour >= 5 && hour < 12) {
    return `早上 ${hour}:${String(time.getMinutes()).padStart(2, '0')}`
  } else if (hour >= 12 && hour < 18) {
    return `下午 ${hour}:${String(time.getMinutes()).padStart(2, '0')}`
  } else if (hour >= 18 && hour < 22) {
    return `晚上 ${hour}:${String(time.getMinutes()).padStart(2, '0')}`
  } else {
    return `深夜 ${hour}:${String(time.getMinutes()).padStart(2, '0')}`
  }
}

/**
 * 为不同操作类型生成针对性的 Prompt 补充
 */
export function getActionSpecificGuidance(action: string): string {
  const guidanceMap: Record<string, string> = {
    create: '建议重点：帮助用户规划如何执行这个任务（时间、地点、方法）',
    complete: '建议重点：给予肯定和鼓励，可以提醒用户休息或继续保持',
    recurring: '建议重点：强调坚持的价值，提供习惯养成的建议',
    delete: '建议重点：提醒用户反思任务的必要性，避免过度承诺',
    update: '建议重点：帮助用户思考调整的原因，提供优化建议'
  }
  
  return guidanceMap[action] || '建议重点：提供实用、可操作的建议'
}

/**
 * 构建完整的 Prompt
 */
export function buildCompleteAdvicePrompt(
  userProfile: UserProfile,
  taskContext: TaskContext,
  currentTime?: Date
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = buildAdviceSystemPrompt()
  const userPrompt = buildAdviceUserPrompt(userProfile, taskContext, currentTime)
  const actionGuidance = getActionSpecificGuidance(taskContext.action)
  
  return {
    systemPrompt: `${systemPrompt}\n\n${actionGuidance}`,
    userPrompt
  }
}


