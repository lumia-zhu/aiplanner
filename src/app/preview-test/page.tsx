'use client'

import { useState } from 'react'
import NotePreviewTooltip from '@/components/NotePreviewTooltip'
import { extractPreviewLines, extractTaskStats, countChars } from '@/utils/notePreviewUtils'

/**
 * 测试页面：验证 NotePreviewTooltip 组件和工具函数
 */
export default function PreviewTestPage() {
  const [showTooltip, setShowTooltip] = useState(false)
  const [testCase, setTestCase] = useState<'loading' | 'empty' | 'simple' | 'complex'>('simple')

  // 模拟笔记数据
  const mockNoteSimple = {
    id: '1',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '今天的计划' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '这是一个简单的笔记测试' }]
        }
      ]
    },
    plain_text: '今天的计划\n这是一个简单的笔记测试',
    note_date: '2025-10-30'
  }

  const mockNoteComplex = {
    id: '2',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '今天的任务' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '去图书馆' }]
                }
              ]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '做TA工作' }]
                }
              ]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '和导师Meeting' }]
                }
              ]
            }
          ]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '今天是个美好的一天！' }]
        }
      ]
    },
    plain_text: '今天的任务\n去图书馆\n做TA工作\n和导师Meeting\n今天是个美好的一天！',
    note_date: '2025-10-30'
  }

  // 根据测试用例选择数据
  const currentNote = testCase === 'simple' ? mockNoteSimple : testCase === 'complex' ? mockNoteComplex : null
  const isLoading = testCase === 'loading'

  // 测试工具函数
  const testUtilFunctions = () => {
    if (!mockNoteComplex.content) return

    console.log('=== 测试工具函数 ===')
    
    const lines = extractPreviewLines(mockNoteComplex.content, 10)
    console.log('预览行:', lines)
    
    const stats = extractTaskStats(mockNoteComplex.content)
    console.log('任务统计:', stats)
    
    const charCount = countChars(mockNoteComplex.plain_text || '')
    console.log('字数:', charCount)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">NotePreviewTooltip 测试页面</h1>

        {/* 测试控制面板 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">测试控制</h2>
          
          <div className="space-y-4">
            {/* 测试用例选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择测试用例：
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTestCase('loading')}
                  className={`px-4 py-2 rounded ${
                    testCase === 'loading'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  加载状态
                </button>
                <button
                  onClick={() => setTestCase('empty')}
                  className={`px-4 py-2 rounded ${
                    testCase === 'empty'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  空笔记
                </button>
                <button
                  onClick={() => setTestCase('simple')}
                  className={`px-4 py-2 rounded ${
                    testCase === 'simple'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  简单笔记
                </button>
                <button
                  onClick={() => setTestCase('complex')}
                  className={`px-4 py-2 rounded ${
                    testCase === 'complex'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  复杂笔记（带任务）
                </button>
              </div>
            </div>

            {/* 显示/隐藏 Tooltip */}
            <div>
              <button
                onClick={() => setShowTooltip(!showTooltip)}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                {showTooltip ? '隐藏' : '显示'} Tooltip
              </button>
            </div>

            {/* 测试工具函数 */}
            <div>
              <button
                onClick={testUtilFunctions}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                测试工具函数（查看 Console）
              </button>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">✅ Phase 1 验证清单：</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>□ 组件能够渲染</li>
            <li>□ 显示日期标题</li>
            <li>□ 显示"暂无笔记"状态</li>
            <li>□ 显示加载状态（骨架屏）</li>
            <li>□ 工具函数能正确提取文本</li>
            <li>□ 工具函数能识别 checkbox 状态</li>
            <li>□ 工具函数能统计任务数量</li>
          </ul>
        </div>

        {/* 悬浮区域 */}
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">
            点击上方"显示 Tooltip"按钮查看预览效果
          </p>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <NotePreviewTooltip
            date={new Date(2025, 9, 30)} // 2025年10月30日
            note={currentNote}
            position={{ x: 400, y: 300 }}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}









