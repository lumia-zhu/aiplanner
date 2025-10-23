/**
 * 任务上下文问题生成模块
 * 用于在任务拆解前收集用户的背景信息
 */

import type { Task } from '@/types'

/**
 * 根据任务生成2-3个引导性问题
 * 问题会根据任务的标签进行定制化
 */
export function generateContextQuestions(task: Task): string[] {
  const questions: string[] = []
  
  // 基础问题（所有任务都问）
  questions.push('这个任务的最终目标是什么？你希望达到什么样的结果？')
  
  // 根据标签定制第二个问题
  if (task.tags?.includes('difficult')) {
    questions.push('你预计在完成这个任务时会遇到什么困难？')
  } else if (task.tags?.includes('important')) {
    questions.push('这个任务为什么重要？有哪些关键点需要注意？')
  } else if (task.tags?.includes('easy')) {
    questions.push('这个任务需要哪些准备工作？')
  } else {
    questions.push('你在完成这个任务时需要哪些资源或支持？')
  }
  
  // 第三个问题（通用）
  questions.push('有什么特殊的要求或时间限制吗？')
  
  return questions.slice(0, 3) // 确保最多3个问题
}

/**
 * 格式化问题列表为消息文本
 * 用于在聊天界面显示
 */
export function formatQuestionsMessage(task: Task, questions: string[]): string {
  return `Great! Before we start breaking down "${task.title}", I'd like to understand some background information:

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

💡 Please answer these questions in the input box below. You can also provide any other information you know (feel free to describe, no need to strictly follow question numbers)`
}



