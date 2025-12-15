// ============================================
// 上下文信息提取服务
// ============================================
// 功能：使用 LLM 从问答对话中提取核心信息
// ============================================

import { doubaoService } from './doubaoService'
import type { ExtractedContext, QuestionAnswerPair } from '@/types/task-context'

/**
 * 从问答对话中提取核心信息
 * @param question 原始问题
 * @param answer 原始答案
 * @returns 提取的精简信息
 */
export async function extractContextFromQA(
  question: string,
  answer: string
): Promise<ExtractedContext> {
  try {
    console.log('🤖 开始提取上下文信息...')
    console.log('问题:', question)
    console.log('答案:', answer)

    // 构建 Prompt
    const prompt = buildExtractionPrompt(question, answer)

    // 调用 LLM（不传入图片，使用默认的空历史记录）
    const response = await doubaoService.sendMessage(prompt)

    // 检查响应
    if (!response || !response.success || !response.message) {
      console.error('❌ LLM 响应无效:', response)
      throw new Error(response?.error || 'LLM 响应无效')
    }

    // 提取内容
    const extractedContent = response.message.trim()

    console.log('✅ 提取完成:', extractedContent)

    return {
      content: extractedContent
    }
  } catch (error: any) {
    console.error('❌ 提取上下文信息失败:', error)
    console.error('错误详情:', error.message || error)
    
    // 降级方案：如果 LLM 失败，直接返回原始答案
    console.warn('⚠️ 使用降级方案：返回原始答案')
    return {
      content: answer
    }
  }
}

/**
 * 构建提取信息的 Prompt
 */
function buildExtractionPrompt(question: string, answer: string): string {
  return `你是一个任务管理助手，需要从问答对话中提取关键信息。

【问题】
${question}

【回答】
${answer}

【任务】
请从回答中提取最核心的信息，要求：

1. **组织成完整句子**：用一句话概括关键信息，便于阅读理解
2. **简洁清晰**：控制在 20-60 字，去除冗余表达
3. **保留关键点**：保留最重要的信息，如项目名称、背景、目标、资源、约束等
4. **去除口语化**：去除"嗯"、"啊"、"这个"、"那个"等口语词
5. **自然流畅**：语句通顺，像人说话一样自然

【示例】
问题：这个原型开发是针对什么产品或项目的？
回答：ADHD任务管理是一个研究项目，目前已经有一些需求文档了，我们希望通过这个原型来验证一些想法
提取：这是一个ADHD任务管理研究项目，目前已有需求文档，希望通过原型验证想法

问题：你希望这个原型开发完成后达到什么样的效果？
回答：我希望能够验证我们的研究假设，完成用户测试，收集用户反馈，然后根据反馈进行迭代
提取：希望验证研究假设，通过用户测试收集反馈并迭代

问题：现在已经有哪些关于这个原型的设计文档或需求说明？
回答：有一个需求说明文档，链接是 docs.google.com/xxx，还有一些初步的原型图，存放在 Figma 上
提取：已有需求文档（docs.google.com/xxx）和Figma原型图

问题：这个任务预计需要多长时间完成？
回答：我觉得大概需要两周左右吧，如果遇到技术问题可能会更久一些
提取：预计需要两周，可能因技术问题延长

【注意】
- 直接返回提取的信息文本，不要加任何前缀（如"提取："）
- 不要添加任何解释或说明
- 不要使用 JSON 格式
- 只返回纯文本的一句话

请提取上述回答中的核心信息：`
}

/**
 * 批量提取多个问答的上下文信息
 */
export async function batchExtractContext(
  qaList: Array<{ question: string; answer: string }>
): Promise<ExtractedContext[]> {
  const results: ExtractedContext[] = []

  for (const qa of qaList) {
    try {
      const extracted = await extractContextFromQA(qa.question, qa.answer)
      results.push(extracted)
    } catch (error) {
      console.error('批量提取失败，跳过该项:', error)
      // 失败时使用原始答案
      results.push({ content: qa.answer })
    }
  }

  return results
}

/**
 * 整合多个问答，提取为一个完整的段落
 * @param qaList 多个问答对
 * @returns 整合后的精简段落
 */
export async function extractContextFromMultipleQA(
  qaList: QuestionAnswerPair[]
): Promise<ExtractedContext> {
  try {
    console.log('🤖 开始整合提取多个问答...')
    console.log('问答数量:', qaList.length)

    // 构建整合提取的 Prompt
    const prompt = buildMultipleQAPrompt(qaList)

    // 调用 LLM
    const response = await doubaoService.sendMessage(prompt)

    // 检查响应
    if (!response || !response.success || !response.message) {
      console.error('❌ LLM 响应无效:', response)
      throw new Error(response?.error || 'LLM 响应无效')
    }

    // 提取内容
    const extractedContent = response.message.trim()

    console.log('✅ 整合提取完成:', extractedContent)

    return {
      content: extractedContent
    }
  } catch (error: any) {
    console.error('❌ 整合提取失败:', error)
    console.error('错误详情:', error.message || error)
    
    // 降级方案：简单拼接所有答案
    console.warn('⚠️ 使用降级方案：简单拼接答案')
    const fallback = qaList
      .map((qa, i) => `${i + 1}) ${qa.answer}`)
      .join(' ')
    
    return {
      content: fallback
    }
  }
}

/**
 * 构建整合多个问答的 Prompt
 */
function buildMultipleQAPrompt(qaList: QuestionAnswerPair[]): string {
  // 格式化问答列表
  const formattedQA = qaList
    .map((qa, i) => `【问题${i + 1}】\n${qa.question}\n【回答${i + 1}】\n${qa.answer}`)
    .join('\n\n')

  return `你是一个任务管理助手，需要从多个问答对话中提取关键信息，并整合成一个完整、简洁的段落。

${formattedQA}

【任务】
请将上述多个问答的核心信息整合成一个简洁的段落，要求：

1. **完整段落**：将多个问答的信息整合成一个流畅的段落（50-150字）
2. **分点表达**：如果信息较多，可以用分号或分点（1、2、3）组织
3. **去重合并**：去除重复信息，合并相关内容
4. **突出重点**：优先保留最重要的背景、目标、约束等信息
5. **自然流畅**：语句通顺，像人说话一样自然

【示例】
问题1：这个原型开发是针对什么产品或项目的？
回答1：ADHD任务管理研究项目，目前已经有一些需求文档了

问题2：你希望这个原型开发完成后达到什么样的效果？
回答2：希望能够验证我们的研究假设，完成用户测试

问题3：现在已经有哪些关于这个原型的设计文档或需求说明？
回答3：有一个需求说明文档和一些初步的原型图

整合输出：
这是一个ADHD任务管理研究项目，目前已有需求文档和原型图。希望通过原型验证研究假设，完成用户测试收集反馈。

【注意】
- 直接返回整合后的段落文本，不要加任何前缀
- 不要添加任何解释或说明
- 不要使用 JSON 格式
- 只返回纯文本段落

请整合上述问答的核心信息：`
}

