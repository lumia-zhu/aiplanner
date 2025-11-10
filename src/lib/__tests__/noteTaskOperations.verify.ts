/**
 * noteTaskOperations.ts 验证脚本
 * 
 * 用于手动验证基础功能是否正常
 * 运行: npx ts-node src/lib/__tests__/noteTaskOperations.verify.ts
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
                }
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

console.log('🧪 ========== noteTaskOperations.ts 验证测试 ==========\n')

try {
  // 测试 1: findAllTasks
  console.log('📋 测试 1: findAllTasks()')
  console.log('---')
  
  const tasks = findAllTasks(mockNoteContent)
  
  console.log(`找到 ${tasks.length} 个任务：`)
  tasks.forEach((task, index) => {
    console.log(`  ${index}. [${task.checked ? '✅' : '⬜'}] ${task.title}`)
    console.log(`     路径: [${task.path.join(', ')}]`)
  })
  
  if (tasks.length !== 3) {
    throw new Error(`❌ 预期找到 3 个任务，实际找到 ${tasks.length} 个`)
  }
  
  if (tasks[0].title !== '买菜') {
    throw new Error(`❌ 第 1 个任务标题错误，预期 "买菜"，实际 "${tasks[0].title}"`)
  }
  
  if (tasks[1].title !== '完成报告 工作') {
    throw new Error(`❌ 第 2 个任务标题错误，预期 "完成报告 工作"，实际 "${tasks[1].title}"`)
  }
  
  if (!tasks[2].checked) {
    throw new Error(`❌ 第 3 个任务应该是已完成状态`)
  }
  
  console.log('✅ findAllTasks 测试通过\n')
  
  // 测试 2: updateTaskInNote - 更新 checked 状态
  console.log('📋 测试 2: updateTaskInNote() - 更新 checked')
  console.log('---')
  
  const updatedContent1 = updateTaskInNote(mockNoteContent, 0, { checked: true })
  const tasksAfterUpdate1 = findAllTasks(updatedContent1)
  
  if (!tasksAfterUpdate1[0].checked) {
    throw new Error(`❌ 更新后第 1 个任务应该是已完成状态`)
  }
  
  // 验证原始内容未被修改
  const tasksOriginal = findAllTasks(mockNoteContent)
  if (tasksOriginal[0].checked) {
    throw new Error(`❌ 原始内容被意外修改`)
  }
  
  console.log('✅ updateTaskInNote (checked) 测试通过\n')
  
  // 测试 3: updateTaskInNote - 更新 title
  console.log('📋 测试 3: updateTaskInNote() - 更新 title')
  console.log('---')
  
  const updatedContent2 = updateTaskInNote(mockNoteContent, 1, { title: '完成季度报告 #工作' })
  const tasksAfterUpdate2 = findAllTasks(updatedContent2)
  
  console.log(`更新后的标题: "${tasksAfterUpdate2[1].title}"`)
  
  if (!tasksAfterUpdate2[1].title.includes('季度报告')) {
    throw new Error(`❌ 标题未正确更新`)
  }
  
  console.log('✅ updateTaskInNote (title) 测试通过\n')
  
  // 测试 4: deleteTaskFromNote
  console.log('📋 测试 4: deleteTaskFromNote()')
  console.log('---')
  
  const deletedContent = deleteTaskFromNote(mockNoteContent, 0)
  const tasksAfterDelete = findAllTasks(deletedContent)
  
  console.log(`删除后剩余 ${tasksAfterDelete.length} 个任务`)
  
  if (tasksAfterDelete.length !== 2) {
    throw new Error(`❌ 预期剩余 2 个任务，实际 ${tasksAfterDelete.length} 个`)
  }
  
  if (tasksAfterDelete[0].title === '买菜') {
    throw new Error(`❌ 第一个任务未被删除`)
  }
  
  // 验证原始内容未被修改
  const tasksOriginal2 = findAllTasks(mockNoteContent)
  if (tasksOriginal2.length !== 3) {
    throw new Error(`❌ 原始内容被意外修改`)
  }
  
  console.log('✅ deleteTaskFromNote 测试通过\n')
  
  // 测试 5: 边界情况 - 删除不存在的任务
  console.log('📋 测试 5: 边界情况 - 删除不存在的任务')
  console.log('---')
  
  try {
    deleteTaskFromNote(mockNoteContent, 999)
    throw new Error(`❌ 应该抛出错误`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('不存在')) {
      console.log(`✅ 正确抛出错误: ${error.message}`)
    } else {
      throw error
    }
  }
  
  console.log('✅ 边界情况测试通过\n')
  
  // 全部测试通过
  console.log('🎉 ========== 所有验证测试通过！==========')
  console.log('\n✅ findAllTasks() 正常工作')
  console.log('✅ updateTaskInNote() 正常工作')
  console.log('✅ deleteTaskFromNote() 正常工作')
  console.log('✅ 深拷贝机制正常（不修改原对象）')
  console.log('✅ 错误处理正常')
  
} catch (error) {
  console.error('\n❌ 测试失败:', error)
  process.exit(1)
}



