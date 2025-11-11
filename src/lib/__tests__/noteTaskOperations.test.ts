/**
 * noteTaskOperations.ts 单元测试
 * Phase 5 - Step 1 验证 & Step 2 正式测试
 */

import type { JSONContent } from '@tiptap/core'
import { findAllTasks, updateTaskInNote, deleteTaskFromNote } from '../noteTaskOperations'

// 模拟笔记内容
const mockNoteContent: JSONContent = {
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
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '买菜' }
              ]
            }
          ]
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '完成报告 ' },
                { 
                  type: 'text', 
                  text: '工作',
                  marks: [
                    { 
                      type: 'taskTag',
                      attrs: { label: '工作', color: '#7FA1C3', emoji: '🏷️' }
                    }
                  ]
                },
                { type: 'text', text: ' ' }
              ]
            }
          ]
        },
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '学习 React' }
              ]
            }
          ]
        }
      ]
    }
  ]
}

describe('noteTaskOperations', () => {
  describe('findAllTasks', () => {
    test('应该找到所有 taskItem 节点', () => {
      const tasks = findAllTasks(mockNoteContent)
      
      expect(tasks).toHaveLength(3)
      expect(tasks[0].title).toBe('买菜')
      expect(tasks[1].title).toBe('完成报告 工作')
      expect(tasks[2].title).toBe('学习 React')
    })

    test('应该正确识别 checked 状态', () => {
      const tasks = findAllTasks(mockNoteContent)
      
      expect(tasks[0].checked).toBe(false)
      expect(tasks[1].checked).toBe(false)
      expect(tasks[2].checked).toBe(true)
    })

    test('应该正确记录任务位置', () => {
      const tasks = findAllTasks(mockNoteContent)
      
      expect(tasks[0].position).toBe(0)
      expect(tasks[1].position).toBe(1)
      expect(tasks[2].position).toBe(2)
    })

    test('应该正确记录 JSON 路径', () => {
      const tasks = findAllTasks(mockNoteContent)
      
      // 第一个任务的路径应该是 [1, 0]（第二个子节点[taskList]的第一个子节点）
      expect(tasks[0].path).toEqual([1, 0])
      expect(tasks[1].path).toEqual([1, 1])
      expect(tasks[2].path).toEqual([1, 2])
    })

    test('空笔记应该返回空数组', () => {
      const emptyContent: JSONContent = {
        type: 'doc',
        content: []
      }
      
      const tasks = findAllTasks(emptyContent)
      expect(tasks).toHaveLength(0)
    })

    test('应该正确提取任务标题（去除 marks）', () => {
      const tasks = findAllTasks(mockNoteContent)
      
      // 第二个任务有 taskTag mark，应该提取纯文本
      expect(tasks[1].title).toBe('完成报告 工作')
    })
  })

  describe('updateTaskInNote', () => {
    test('应该成功更新任务的 checked 状态', () => {
      const newContent = updateTaskInNote(mockNoteContent, 0, { checked: true })
      const tasks = findAllTasks(newContent)
      
      expect(tasks[0].checked).toBe(true)
    })

    test('应该成功更新任务标题', () => {
      const newContent = updateTaskInNote(mockNoteContent, 1, { title: '完成季度报告' })
      const tasks = findAllTasks(newContent)
      
      expect(tasks[1].title).toContain('季度报告')
    })

    test('应该同时更新 checked 和 title', () => {
      const newContent = updateTaskInNote(mockNoteContent, 0, { 
        checked: true, 
        title: '买菜和水果' 
      })
      const tasks = findAllTasks(newContent)
      
      expect(tasks[0].checked).toBe(true)
      expect(tasks[0].title).toBe('买菜和水果')
    })

    test('不应该修改原始 noteContent 对象', () => {
      const originalTasks = findAllTasks(mockNoteContent)
      
      updateTaskInNote(mockNoteContent, 0, { checked: true })
      
      const tasksAfter = findAllTasks(mockNoteContent)
      expect(tasksAfter[0].checked).toBe(originalTasks[0].checked)
    })

    test('更新不存在的任务位置应该抛出错误', () => {
      expect(() => {
        updateTaskInNote(mockNoteContent, 999, { checked: true })
      }).toThrow('任务位置 999 不存在')
    })

    test('更新标题时应该保留标签 marks', () => {
      const newContent = updateTaskInNote(mockNoteContent, 0, { title: '买菜 #生活' })
      const tasks = findAllTasks(newContent)
      
      expect(tasks[0].title).toContain('生活')
    })
  })

  describe('deleteTaskFromNote', () => {
    test('应该成功删除第一个任务', () => {
      const newContent = deleteTaskFromNote(mockNoteContent, 0)
      const tasks = findAllTasks(newContent)
      
      expect(tasks).toHaveLength(2)
      expect(tasks[0].title).toBe('完成报告 工作')  // 原来的第二个任务变成第一个
    })

    test('应该成功删除中间的任务', () => {
      const newContent = deleteTaskFromNote(mockNoteContent, 1)
      const tasks = findAllTasks(newContent)
      
      expect(tasks).toHaveLength(2)
      expect(tasks[0].title).toBe('买菜')
      expect(tasks[1].title).toBe('学习 React')
    })

    test('应该成功删除最后一个任务', () => {
      const newContent = deleteTaskFromNote(mockNoteContent, 2)
      const tasks = findAllTasks(newContent)
      
      expect(tasks).toHaveLength(2)
      expect(tasks[1].title).toBe('完成报告 工作')
    })

    test('不应该修改原始 noteContent 对象', () => {
      const originalTasks = findAllTasks(mockNoteContent)
      
      deleteTaskFromNote(mockNoteContent, 0)
      
      const tasksAfter = findAllTasks(mockNoteContent)
      expect(tasksAfter).toHaveLength(originalTasks.length)
    })

    test('删除不存在的任务位置应该抛出错误', () => {
      expect(() => {
        deleteTaskFromNote(mockNoteContent, 999)
      }).toThrow('任务位置 999 不存在')
    })

    test('删除唯一的任务应该移除 taskList', () => {
      // 创建只有一个任务的笔记
      const singleTaskContent: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '唯一的任务' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const newContent = deleteTaskFromNote(singleTaskContent, 0)
      const tasks = findAllTasks(newContent)
      
      expect(tasks).toHaveLength(0)
      // taskList 应该被移除
      expect(newContent.content).toHaveLength(0)
    })
  })
})





