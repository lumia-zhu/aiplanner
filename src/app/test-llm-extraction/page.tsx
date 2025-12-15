'use client'

import { useState } from 'react'
import { extractContextFromQA } from '@/lib/contextExtractionService'

export default function TestLLMExtractionPage() {
  const [question, setQuestion] = useState('这个原型开发是针对什么产品或项目的？')
  const [answer, setAnswer] = useState('ADHD任务管理是一个研究项目，目前已经有一些需求文档了，我们希望通过这个原型来验证一些想法')
  const [extractedContent, setExtractedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 预设示例
  const examples = [
    {
      name: '示例1：项目背景',
      question: '这个原型开发是针对什么产品或项目的？',
      answer: 'ADHD任务管理是一个研究项目，目前已经有一些需求文档了，我们希望通过这个原型来验证一些想法'
    },
    {
      name: '示例2：期望效果',
      question: '你希望这个原型开发完成后达到什么样的效果？',
      answer: '我希望能够验证我们的研究假设，完成用户测试，收集用户反馈，然后根据反馈进行迭代'
    },
    {
      name: '示例3：已有资源',
      question: '现在已经有哪些关于这个原型的设计文档或需求说明？',
      answer: '有一个需求说明文档，链接是 docs.google.com/xxx，还有一些初步的原型图，存放在 Figma 上'
    },
    {
      name: '示例4：时间估计',
      question: '这个任务预计需要多长时间完成？',
      answer: '我觉得大概需要两周左右吧，如果遇到技术问题可能会更久一些，主要是数据库设计比较复杂'
    }
  ]

  const handleExtract = async () => {
    if (!question || !answer) {
      setMessage('❌ 请输入问题和答案')
      return
    }

    setLoading(true)
    setMessage('🤖 正在调用 LLM 提取...')

    try {
      const result = await extractContextFromQA(question, answer)
      setExtractedContent(result.content)
      setMessage('✅ 提取成功！')
    } catch (error: any) {
      setMessage(`❌ 提取失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (example: typeof examples[0]) => {
    setQuestion(example.question)
    setAnswer(example.answer)
    setExtractedContent('')
    setMessage(`已加载：${example.name}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">LLM 上下文信息提取测试</h1>
        <p className="text-gray-600 mb-8">测试从问答对话中提取关键信息的功能</p>

        {/* 预设示例 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">📚 预设示例</h2>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => loadExample(example)}
                className="px-4 py-2 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>

        {/* 输入区域 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">输入问答</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                问题
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="输入问题..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                回答
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
                placeholder="输入回答..."
              />
            </div>
          </div>

          <button
            onClick={handleExtract}
            disabled={loading || !question || !answer}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ 提取中...' : '🤖 提取关键信息'}
          </button>

          {message && (
            <div
              className={`mt-4 p-3 rounded-md ${
                message.startsWith('✅')
                  ? 'bg-green-50 text-green-800'
                  : message.startsWith('❌')
                  ? 'bg-red-50 text-red-800'
                  : 'bg-blue-50 text-blue-800'
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* 提取结果 */}
        {extractedContent && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">✨ 提取结果</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-500 mb-2">原始回答（{answer.length} 字）：</p>
                <p className="text-gray-700">{answer}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-md border-l-4 border-blue-500">
                <p className="text-sm text-blue-600 font-medium mb-2">
                  💡 提取的核心信息（{extractedContent.length} 字）：
                </p>
                <p className="text-gray-900 font-medium">{extractedContent}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">压缩率：</span>
                  {Math.round((1 - extractedContent.length / answer.length) * 100)}%
                </div>
                <div>
                  <span className="font-medium">原始：</span>
                  {answer.length} 字
                </div>
                <div>
                  <span className="font-medium">提取后：</span>
                  {extractedContent.length} 字
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

